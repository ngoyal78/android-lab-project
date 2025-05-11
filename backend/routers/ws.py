from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, List, Any, Optional
import uuid
import asyncio
import json
import subprocess
import os
from datetime import datetime

from ..database import get_db
from ..models import User, TargetDevice, DeviceStatus
from ..auth import get_current_active_user, get_developer_user
from ..notifications import notification_manager

router = APIRouter(
    prefix="/ws",
    tags=["websocket"],
)

# Store active connections
class ConnectionManager:
    def __init__(self):
        # target_id -> {user_id -> WebSocket}
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}
        # target_id -> {user_id -> process}
        self.active_processes: Dict[int, Dict[int, asyncio.subprocess.Process]] = {}
    
    async def connect(self, websocket: WebSocket, target_id: int, user_id: int):
        await websocket.accept()
        
        if target_id not in self.active_connections:
            self.active_connections[target_id] = {}
            self.active_processes[target_id] = {}
        
        self.active_connections[target_id][user_id] = websocket
    
    def disconnect(self, target_id: int, user_id: int):
        if target_id in self.active_connections and user_id in self.active_connections[target_id]:
            del self.active_connections[target_id][user_id]
            
            # Clean up if no more connections for this target
            if not self.active_connections[target_id]:
                del self.active_connections[target_id]
        
        # Kill process if exists
        if target_id in self.active_processes and user_id in self.active_processes[target_id]:
            process = self.active_processes[target_id][user_id]
            try:
                process.kill()
            except:
                pass
            del self.active_processes[target_id][user_id]
            
            # Clean up if no more processes for this target
            if not self.active_processes[target_id]:
                del self.active_processes[target_id]
    
    async def send_message(self, message: str, target_id: int, user_id: int):
        if target_id in self.active_connections and user_id in self.active_connections[target_id]:
            websocket = self.active_connections[target_id][user_id]
            await websocket.send_text(message)
    
    async def broadcast(self, message: str, target_id: int):
        if target_id in self.active_connections:
            for user_id, websocket in self.active_connections[target_id].items():
                await websocket.send_text(message)
    
    def set_process(self, process: asyncio.subprocess.Process, target_id: int, user_id: int):
        if target_id not in self.active_processes:
            self.active_processes[target_id] = {}
        
        self.active_processes[target_id][user_id] = process
    
    def get_process(self, target_id: int, user_id: int) -> asyncio.subprocess.Process:
        if target_id in self.active_processes and user_id in self.active_processes[target_id]:
            return self.active_processes[target_id][user_id]
        return None

manager = ConnectionManager()

# Store active gateway connections
class GatewayConnectionManager:
    def __init__(self):
        # gateway_id -> WebSocket
        self.active_gateways: Dict[str, WebSocket] = {}
        # gateway_id -> last heartbeat time
        self.last_heartbeat: Dict[str, datetime] = {}
        # client_id -> (gateway_id, target_id)
        self.client_connections: Dict[str, tuple] = {}
    
    async def connect(self, websocket: WebSocket, gateway_id: str):
        await websocket.accept()
        self.active_gateways[gateway_id] = websocket
        self.last_heartbeat[gateway_id] = datetime.utcnow()
        
    def disconnect(self, gateway_id: str):
        if gateway_id in self.active_gateways:
            del self.active_gateways[gateway_id]
        
        if gateway_id in self.last_heartbeat:
            del self.last_heartbeat[gateway_id]
        
        # Clean up client connections for this gateway
        to_remove = []
        for client_id, (gw_id, _) in self.client_connections.items():
            if gw_id == gateway_id:
                to_remove.append(client_id)
        
        for client_id in to_remove:
            del self.client_connections[client_id]
    
    def register_client_connection(self, client_id: str, gateway_id: str, target_id: str):
        self.client_connections[client_id] = (gateway_id, target_id)
    
    def unregister_client_connection(self, client_id: str):
        if client_id in self.client_connections:
            del self.client_connections[client_id]
    
    async def send_to_gateway(self, gateway_id: str, message: Dict[str, Any]) -> bool:
        if gateway_id in self.active_gateways:
            websocket = self.active_gateways[gateway_id]
            try:
                await websocket.send_text(json.dumps(message))
                return True
            except Exception as e:
                print(f"Error sending to gateway {gateway_id}: {str(e)}")
                return False
        return False
    
    def get_gateway_for_target(self, target_id: str) -> Optional[str]:
        """Find which gateway is managing a specific target"""
        # In a real implementation, we would query the database
        # For now, we'll just return the first active gateway
        if self.active_gateways:
            return list(self.active_gateways.keys())[0]
        return None
    
    def is_gateway_online(self, gateway_id: str) -> bool:
        return gateway_id in self.active_gateways

gateway_manager = GatewayConnectionManager()

async def get_target_if_available(target_id: int, user: User, db: AsyncSession):
    """Check if target exists and is available or reserved by the user"""
    result = await db.execute(select(TargetDevice).filter(TargetDevice.id == target_id))
    target = result.scalars().first()
    
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target device not found"
        )
    
    # Check if target is available or reserved
    if target.status == DeviceStatus.OFFLINE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target device is offline"
        )
    
    # In a real implementation, we would check if the user has reserved the device
    # For now, we'll just check if it's available or reserved
    
    return target

@router.websocket("/gateway")
async def gateway_websocket(websocket: WebSocket):
    """WebSocket endpoint for gateway agents"""
    # For now, we'll accept any connection without authentication
    # In a real implementation, we would validate a token
    
    gateway_id = None
    
    try:
        # Accept the connection
        await websocket.accept()
        
        # Wait for the initial message with gateway ID
        data = await websocket.receive_text()
        try:
            message = json.loads(data)
            gateway_id = message.get("gateway_id")
            
            if not gateway_id:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Gateway ID is required"
                }))
                await websocket.close()
                return
            
            # Register the gateway
            await gateway_manager.connect(websocket, gateway_id)
            
            # Send welcome message
            await websocket.send_text(json.dumps({
                "type": "system",
                "message": f"Connected as gateway {gateway_id}"
            }))
            
            # Handle messages
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "heartbeat":
                    # Update last heartbeat time
                    gateway_manager.last_heartbeat[gateway_id] = datetime.utcnow()
                    
                    # Send acknowledgement
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_ack",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                
                elif message_type == "device_update":
                    # Process device updates
                    devices = message.get("devices", [])
                    serial_ports = message.get("serial_ports", [])
                    
                    # In a real implementation, we would update the database
                    # For now, we'll just log the update
                    print(f"Received device update from gateway {gateway_id}: {len(devices)} devices, {len(serial_ports)} serial ports")
                
                elif message_type == "test_log":
                    # Process test log
                    job_id = message.get("job_id")
                    log = message.get("log")
                    is_error = message.get("is_error", False)
                    
                    # In a real implementation, we would store the log and forward to clients
                    print(f"Test log for job {job_id}: {'ERROR: ' if is_error else ''}{log}")
                
                elif message_type == "test_completion":
                    # Process test completion
                    job_id = message.get("job_id")
                    exit_code = message.get("exit_code")
                    error = message.get("error")
                    
                    # In a real implementation, we would update the database and notify clients
                    print(f"Test job {job_id} completed with exit code {exit_code}{f', error: {error}' if error else ''}")
                
                else:
                    # Unknown message type
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    }))
        
        except json.JSONDecodeError:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Invalid JSON format"
            }))
        
        except Exception as e:
            print(f"Error processing gateway message: {str(e)}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error: {str(e)}"
            }))
    
    except WebSocketDisconnect:
        # Gateway disconnected
        if gateway_id:
            gateway_manager.disconnect(gateway_id)
            print(f"Gateway {gateway_id} disconnected")
    
    except Exception as e:
        print(f"Gateway WebSocket error: {str(e)}")
        try:
            await websocket.close()
        except:
            pass

@router.websocket("/adb/{target_id}")
async def adb_shell(websocket: WebSocket, target_id: int, db: AsyncSession = Depends(get_db)):
    """WebSocket endpoint for ADB shell access"""
    # Authenticate the WebSocket connection
    # In a real implementation, we would extract the token from the query parameters
    # and validate it. For now, we'll assume the user is authenticated.
    
    # For demonstration purposes, we'll use a mock user
    user = User(id=1, username="demo", role="developer")
    
    try:
        # Check if target exists and is available
        target = await get_target_if_available(target_id, user, db)
        
        # Connect to WebSocket
        await manager.connect(websocket, target_id, user.id)
        
        # Send welcome message
        await manager.send_message(
            json.dumps({
                "type": "system",
                "message": f"Connected to ADB shell for {target.name}"
            }),
            target_id,
            user.id
        )
        
        # Start ADB shell process
        # In a real implementation, we would use the actual ADB command
        # For now, we'll use a mock command
        process = await asyncio.create_subprocess_shell(
            f"echo 'ADB shell for {target.name}' && bash",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        manager.set_process(process, target_id, user.id)
        
        # Handle process output
        async def read_output():
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                await manager.send_message(
                    json.dumps({
                        "type": "output",
                        "message": line.decode()
                    }),
                    target_id,
                    user.id
                )
        
        # Handle process errors
        async def read_errors():
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "message": line.decode()
                    }),
                    target_id,
                    user.id
                )
        
        # Start reading output and errors
        asyncio.create_task(read_output())
        asyncio.create_task(read_errors())
        
        # Handle WebSocket messages (commands from the user)
        while True:
            data = await websocket.receive_text()
            
            try:
                command = json.loads(data)
                
                if command["type"] == "command":
                    # Send command to process
                    process.stdin.write(f"{command['message']}\n".encode())
                    await process.stdin.drain()
            except json.JSONDecodeError:
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }),
                    target_id,
                    user.id
                )
            except Exception as e:
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "message": f"Error: {str(e)}"
                    }),
                    target_id,
                    user.id
                )
    
    except WebSocketDisconnect:
        manager.disconnect(target_id, user.id)
    except Exception as e:
        try:
            await websocket.send_text(
                json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                })
            )
        except:
            pass
        manager.disconnect(target_id, user.id)

@router.websocket("/adb/gateway/{target_id}")
async def adb_shell_via_gateway(websocket: WebSocket, target_id: int, db: AsyncSession = Depends(get_db)):
    """WebSocket endpoint for ADB shell access via gateway"""
    # Authenticate the WebSocket connection
    # In a real implementation, we would extract the token from the query parameters
    # and validate it. For now, we'll assume the user is authenticated.
    
    # For demonstration purposes, we'll use a mock user
    user = User(id=1, username="demo", role="developer")
    client_id = None
    gateway_id = None
    
    try:
        # Check if target exists and is available
        target = await get_target_if_available(target_id, user, db)
        
        # Find the gateway for this target
        gateway_id = gateway_manager.get_gateway_for_target(target.serial_number)
        
        if not gateway_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No gateway available for this target"
            )
        
        if not gateway_manager.is_gateway_online(gateway_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gateway is offline"
            )
        
        # Connect to WebSocket
        await websocket.accept()
        
        # Generate a unique client ID
        client_id = f"adb_{target_id}_{user.id}_{uuid.uuid4().hex[:8]}"
        
        # Register client connection
        gateway_manager.register_client_connection(client_id, gateway_id, target.serial_number)
        
        # Send request to gateway
        success = await gateway_manager.send_to_gateway(gateway_id, {
            "type": "adb_shell",
            "client_id": client_id,
            "target_serial": target.serial_number
        })
        
        if not success:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Failed to connect to gateway"
            }))
            await websocket.close()
            return
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "system",
            "message": f"Connected to ADB shell for {target.name} via gateway"
        }))
        
        # Handle WebSocket messages (commands from the user)
        while True:
            data = await websocket.receive_text()
            
            try:
                command = json.loads(data)
                
                if command["type"] == "command":
                    # Forward command to gateway
                    await gateway_manager.send_to_gateway(gateway_id, {
                        "type": "adb_command",
                        "client_id": client_id,
                        "command": command["message"]
                    })
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                }))
    
    except WebSocketDisconnect:
        # Unregister client connection
        if client_id:
            gateway_manager.unregister_client_connection(client_id)
        
        # Notify gateway
        if gateway_id and client_id:
            await gateway_manager.send_to_gateway(gateway_id, {
                "type": "client_disconnect",
                "client_id": client_id
            })
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error: {str(e)}"
            }))
        except:
            pass
        
        # Unregister client connection
        if client_id:
            gateway_manager.unregister_client_connection(client_id)

@router.websocket("/serial/gateway/{target_id}")
async def serial_console_via_gateway(websocket: WebSocket, target_id: int, db: AsyncSession = Depends(get_db)):
    """WebSocket endpoint for serial console access via gateway"""
    # Authenticate the WebSocket connection
    # In a real implementation, we would extract the token from the query parameters
    # and validate it. For now, we'll assume the user is authenticated.
    
    # For demonstration purposes, we'll use a mock user
    user = User(id=1, username="demo", role="developer")
    client_id = None
    gateway_id = None
    
    try:
        # Check if target exists and is available
        target = await get_target_if_available(target_id, user, db)
        
        # Find the gateway for this target
        gateway_id = gateway_manager.get_gateway_for_target(target.serial_number)
        
        if not gateway_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No gateway available for this target"
            )
        
        if not gateway_manager.is_gateway_online(gateway_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gateway is offline"
            )
        
        # Connect to WebSocket
        await websocket.accept()
        
        # Generate a unique client ID
        client_id = f"serial_{target_id}_{user.id}_{uuid.uuid4().hex[:8]}"
        
        # Register client connection
        gateway_manager.register_client_connection(client_id, gateway_id, target.serial_number)
        
        # Send request to gateway
        success = await gateway_manager.send_to_gateway(gateway_id, {
            "type": "serial_console",
            "client_id": client_id,
            "target_serial": target.serial_number
        })
        
        if not success:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Failed to connect to gateway"
            }))
            await websocket.close()
            return
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "system",
            "message": f"Connected to serial console for {target.name} via gateway"
        }))
        
        # Handle WebSocket messages (commands from the user)
        while True:
            data = await websocket.receive_text()
            
            try:
                command = json.loads(data)
                
                if command["type"] == "command":
                    # Forward command to gateway
                    await gateway_manager.send_to_gateway(gateway_id, {
                        "type": "serial_command",
                        "client_id": client_id,
                        "command": command["message"]
                    })
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                }))
    
    except WebSocketDisconnect:
        # Unregister client connection
        if client_id:
            gateway_manager.unregister_client_connection(client_id)
        
        # Notify gateway
        if gateway_id and client_id:
            await gateway_manager.send_to_gateway(gateway_id, {
                "type": "client_disconnect",
                "client_id": client_id
            })
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error: {str(e)}"
            }))
        except:
            pass
        
        # Unregister client connection
        if client_id:
            gateway_manager.unregister_client_connection(client_id)

@router.websocket("/notifications")
async def notifications_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications"""
    # Authenticate the WebSocket connection
    # In a real implementation, we would extract the token from the query parameters
    # and validate it. For now, we'll assume the user is authenticated.
    
    # For demonstration purposes, we'll use a mock user
    user = User(id=1, username="demo", role="developer")
    
    try:
        # Connect to notification manager
        await notification_manager.connect(websocket, user.id)
        
        # Handle WebSocket messages (not used for notifications, but we need to keep the connection open)
        while True:
            await websocket.receive_text()
    
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket, user.id)
    except Exception as e:
        try:
            await websocket.send_text(
                json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                })
            )
        except:
            pass
        notification_manager.disconnect(websocket, user.id)

@router.websocket("/serial/{target_id}")
async def serial_console(websocket: WebSocket, target_id: int, db: AsyncSession = Depends(get_db)):
    """WebSocket endpoint for serial console access"""
    # Authenticate the WebSocket connection
    # In a real implementation, we would extract the token from the query parameters
    # and validate it. For now, we'll assume the user is authenticated.
    
    # For demonstration purposes, we'll use a mock user
    user = User(id=1, username="demo", role="developer")
    
    try:
        # Check if target exists and is available
        target = await get_target_if_available(target_id, user, db)
        
        # Connect to WebSocket
        await manager.connect(websocket, target_id, user.id)
        
        # Send welcome message
        await manager.send_message(
            json.dumps({
                "type": "system",
                "message": f"Connected to serial console for {target.name}"
            }),
            target_id,
            user.id
        )
        
        # Start serial console process
        # In a real implementation, we would use the actual serial command
        # For now, we'll use a mock command
        process = await asyncio.create_subprocess_shell(
            f"echo 'Serial console for {target.name}' && bash",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        manager.set_process(process, target_id, user.id)
        
        # Handle process output
        async def read_output():
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                await manager.send_message(
                    json.dumps({
                        "type": "output",
                        "message": line.decode()
                    }),
                    target_id,
                    user.id
                )
        
        # Handle process errors
        async def read_errors():
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "message": line.decode()
                    }),
                    target_id,
                    user.id
                )
        
        # Start reading output and errors
        asyncio.create_task(read_output())
        asyncio.create_task(read_errors())
        
        # Handle WebSocket messages (commands from the user)
        while True:
            data = await websocket.receive_text()
            
            try:
                command = json.loads(data)
                
                if command["type"] == "command":
                    # Send command to process
                    process.stdin.write(f"{command['message']}\n".encode())
                    await process.stdin.drain()
            except json.JSONDecodeError:
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }),
                    target_id,
                    user.id
                )
            except Exception as e:
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "message": f"Error: {str(e)}"
                    }),
                    target_id,
                    user.id
                )
    
    except WebSocketDisconnect:
        manager.disconnect(target_id, user.id)
    except Exception as e:
        try:
            await websocket.send_text(
                json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                })
            )
        except:
            pass
        manager.disconnect(target_id, user.id)
