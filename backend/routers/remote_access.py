from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, List, Any, Optional
import json
import asyncio
import jwt
import uuid
from datetime import datetime, timedelta

from ..database import get_db
from ..models import User, TargetDevice, DeviceStatus
from ..auth import get_current_active_user, get_admin_user, get_developer_user
from ..notifications import notification_manager

router = APIRouter(
    prefix="/api/remote-access",
    tags=["remote-access"],
)

# Store active sessions
class RemoteAccessSessionManager:
    def __init__(self):
        # device_id -> session info
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        
        # device_id -> device info
        self.registered_devices: Dict[str, Dict[str, Any]] = {}
        
        # device_id -> health status
        self.device_health: Dict[str, Dict[str, Any]] = {}
        
        # user_id -> list of session_ids
        self.user_sessions: Dict[str, List[str]] = {}
    
    def register_device(self, device_id: str, device_info: Dict[str, Any], public_key: str):
        """Register a device with its public key and info"""
        self.registered_devices[device_id] = {
            "device_info": device_info,
            "public_key": public_key,
            "registered_at": datetime.utcnow(),
            "last_updated": datetime.utcnow()
        }
    
    def update_device_health(self, device_id: str, health_data: Dict[str, Any]):
        """Update device health status"""
        self.device_health[device_id] = {
            "status": health_data.get("health_status", "unknown"),
            "timestamp": datetime.utcnow(),
            "session_id": health_data.get("session_id"),
            "local_port": health_data.get("local_port"),
            "remote_port": health_data.get("remote_port")
        }
    
    def start_session(self, device_id: str, user_id: str, session_data: Dict[str, Any]) -> str:
        """Start a new remote access session"""
        session_id = session_data.get("session_id", f"{device_id}_{user_id}_{uuid.uuid4().hex[:8]}")
        
        self.active_sessions[session_id] = {
            "device_id": device_id,
            "user_id": user_id,
            "start_time": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "status": "active",
            "local_port": session_data.get("local_port", 5555),
            "remote_port": session_data.get("remote_port", 5555)
        }
        
        # Add to user sessions
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = []
        
        self.user_sessions[user_id].append(session_id)
        
        return session_id
    
    def end_session(self, session_id: str):
        """End a remote access session"""
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            user_id = session.get("user_id")
            
            # Update session status
            session["status"] = "ended"
            session["end_time"] = datetime.utcnow()
            
            # Remove from active sessions
            del self.active_sessions[session_id]
            
            # Remove from user sessions
            if user_id in self.user_sessions and session_id in self.user_sessions[user_id]:
                self.user_sessions[user_id].remove(session_id)
    
    def get_device_sessions(self, device_id: str) -> List[Dict[str, Any]]:
        """Get all sessions for a device"""
        return [
            session for session_id, session in self.active_sessions.items()
            if session.get("device_id") == device_id
        ]
    
    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all sessions for a user"""
        session_ids = self.user_sessions.get(user_id, [])
        return [
            {**session, "session_id": session_id}
            for session_id, session in self.active_sessions.items()
            if session_id in session_ids
        ]
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific session"""
        return self.active_sessions.get(session_id)
    
    def get_device_info(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get device info"""
        return self.registered_devices.get(device_id)
    
    def get_device_health(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get device health status"""
        return self.device_health.get(device_id)
    
    def get_all_devices(self) -> List[Dict[str, Any]]:
        """Get all registered devices with their health status"""
        devices = []
        
        for device_id, device_info in self.registered_devices.items():
            health = self.device_health.get(device_id, {})
            sessions = self.get_device_sessions(device_id)
            
            devices.append({
                "device_id": device_id,
                "device_info": device_info.get("device_info", {}),
                "registered_at": device_info.get("registered_at"),
                "last_updated": device_info.get("last_updated"),
                "health_status": health.get("status", "unknown"),
                "last_health_check": health.get("timestamp"),
                "active_sessions": len(sessions),
                "sessions": sessions
            })
        
        return devices

# Create session manager
session_manager = RemoteAccessSessionManager()

@router.post("/register")
async def register_device(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_developer_user)
):
    """
    Register a device with the gateway.
    
    This endpoint is called by the remote access agent to register its public key
    and device information with the gateway.
    """
    try:
        # Get request body
        data = await request.json()
        
        device_id = data.get("device_id")
        gateway_id = data.get("gateway_id")
        public_key = data.get("public_key")
        device_info = data.get("device_info", {})
        
        if not device_id or not public_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device ID and public key are required"
            )
        
        # Register the device
        session_manager.register_device(device_id, device_info, public_key)
        
        # Update target device in database if it exists
        result = await db.execute(select(TargetDevice).filter(TargetDevice.serial_number == device_id))
        target = result.scalars().first()
        
        if target:
            # Update target with device info
            target.last_heartbeat = datetime.utcnow()
            target.adb_status = True
            
            # Update other fields if available
            if "android_version" in device_info:
                target.android_version = device_info["android_version"]
            
            if "api_level" in device_info:
                target.api_level = int(device_info["api_level"])
            
            if "manufacturer" in device_info:
                target.manufacturer = device_info["manufacturer"]
            
            if "model" in device_info:
                target.model = device_info["model"]
            
            # Set status to available if it was offline
            if target.status == DeviceStatus.OFFLINE:
                target.status = DeviceStatus.AVAILABLE
            
            await db.commit()
        
        # Notify about device registration
        await notification_manager.broadcast({
            "type": "device_registered",
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {"status": "success", "message": "Device registered successfully"}
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registering device: {str(e)}"
        )

@router.post("/health")
async def update_health(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_developer_user)
):
    """
    Update device health status.
    
    This endpoint is called by the remote access agent to update its health status.
    """
    try:
        # Get request body
        data = await request.json()
        
        device_id = data.get("device_id")
        
        if not device_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device ID is required"
            )
        
        # Update device health
        session_manager.update_device_health(device_id, data)
        
        # Update target device in database if it exists
        result = await db.execute(select(TargetDevice).filter(TargetDevice.serial_number == device_id))
        target = result.scalars().first()
        
        if target:
            # Update target with health info
            target.last_heartbeat = datetime.utcnow()
            
            # Update status based on health
            health_status = data.get("health_status", "unknown")
            
            if health_status == "connected":
                if target.status == DeviceStatus.OFFLINE:
                    target.status = DeviceStatus.AVAILABLE
                
                target.adb_status = True
            
            elif health_status == "disconnected" or health_status == "error":
                if target.status == DeviceStatus.AVAILABLE:
                    target.status = DeviceStatus.OFFLINE
                
                target.adb_status = False
            
            await db.commit()
        
        # Notify about health update
        await notification_manager.broadcast({
            "type": "device_health_update",
            "device_id": device_id,
            "health_status": data.get("health_status", "unknown"),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {"status": "success", "message": "Health status updated successfully"}
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating health status: {str(e)}"
        )

@router.post("/session/start")
async def start_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_developer_user)
):
    """
    Start a remote access session.
    
    This endpoint is called by the frontend to start a remote access session
    for a specific device.
    """
    try:
        # Get request body
        data = await request.json()
        
        device_id = data.get("device_id")
        local_port = data.get("local_port", 5555)
        remote_port = data.get("remote_port", 5555)
        
        if not device_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device ID is required"
            )
        
        # Check if device is registered
        device_info = session_manager.get_device_info(device_id)
        
        if not device_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not registered"
            )
        
        # Check if device is healthy
        device_health = session_manager.get_device_health(device_id)
        
        if not device_health or device_health.get("status") != "connected":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device is not connected or unhealthy"
            )
        
        # Check if target exists in database
        result = await db.execute(select(TargetDevice).filter(TargetDevice.serial_number == device_id))
        target = result.scalars().first()
        
        if target and target.status != DeviceStatus.AVAILABLE and target.status != DeviceStatus.RESERVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target device is not available (status: {target.status.value})"
            )
        
        # Start session
        session_data = {
            "local_port": local_port,
            "remote_port": remote_port
        }
        
        session_id = session_manager.start_session(device_id, str(current_user.id), session_data)
        
        # Update target status if it exists
        if target:
            target.status = DeviceStatus.RESERVED
            target.reserved_by = current_user.id
            target.reserved_at = datetime.utcnow()
            
            await db.commit()
        
        # Notify about session start
        await notification_manager.broadcast({
            "type": "session_started",
            "session_id": session_id,
            "device_id": device_id,
            "user_id": str(current_user.id),
            "username": current_user.username,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Generate JWT token for the session
        payload = {
            "sub": str(current_user.id),
            "username": current_user.username,
            "role": current_user.role,
            "session_id": session_id,
            "device_id": device_id,
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        # In a real implementation, this would use a proper secret key
        session_token = jwt.encode(payload, "secret", algorithm="HS256")
        
        return {
            "status": "success",
            "message": "Session started successfully",
            "session_id": session_id,
            "session_token": session_token,
            "device_id": device_id,
            "connection_info": {
                "host": "localhost",  # In a real implementation, this would be the gateway host
                "port": remote_port
            }
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting session: {str(e)}"
        )

@router.post("/session/end/{session_id}")
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_developer_user)
):
    """
    End a remote access session.
    
    This endpoint is called by the frontend to end a remote access session.
    """
    try:
        # Check if session exists
        session = session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check if user owns the session or is an admin
        if str(current_user.id) != session.get("user_id") and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to end this session"
            )
        
        device_id = session.get("device_id")
        
        # End session
        session_manager.end_session(session_id)
        
        # Update target status if it exists
        if device_id:
            result = await db.execute(select(TargetDevice).filter(TargetDevice.serial_number == device_id))
            target = result.scalars().first()
            
            if target and target.status == DeviceStatus.RESERVED and target.reserved_by == current_user.id:
                target.status = DeviceStatus.AVAILABLE
                target.reserved_by = None
                target.reserved_at = None
                
                await db.commit()
        
        # Notify about session end
        await notification_manager.broadcast({
            "type": "session_ended",
            "session_id": session_id,
            "device_id": device_id,
            "user_id": str(current_user.id),
            "username": current_user.username,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "status": "success",
            "message": "Session ended successfully"
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ending session: {str(e)}"
        )

@router.get("/sessions")
async def get_sessions(
    current_user: User = Depends(get_developer_user)
):
    """
    Get all sessions for the current user.
    
    This endpoint is called by the frontend to get all active sessions
    for the current user.
    """
    try:
        # Get user sessions
        sessions = session_manager.get_user_sessions(str(current_user.id))
        
        return {
            "status": "success",
            "sessions": sessions
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting sessions: {str(e)}"
        )

@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_developer_user)
):
    """
    Get a specific session.
    
    This endpoint is called by the frontend to get details about a specific session.
    """
    try:
        # Check if session exists
        session = session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check if user owns the session or is an admin
        if str(current_user.id) != session.get("user_id") and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this session"
            )
        
        return {
            "status": "success",
            "session": {**session, "session_id": session_id}
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting session: {str(e)}"
        )

@router.get("/devices")
async def get_devices(
    current_user: User = Depends(get_developer_user)
):
    """
    Get all registered devices.
    
    This endpoint is called by the frontend to get all registered devices
    with their health status and active sessions.
    """
    try:
        # Get all devices
        devices = session_manager.get_all_devices()
        
        return {
            "status": "success",
            "devices": devices
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting devices: {str(e)}"
        )

@router.get("/devices/{device_id}")
async def get_device(
    device_id: str,
    current_user: User = Depends(get_developer_user)
):
    """
    Get a specific device.
    
    This endpoint is called by the frontend to get details about a specific device.
    """
    try:
        # Check if device is registered
        device_info = session_manager.get_device_info(device_id)
        
        if not device_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not registered"
            )
        
        # Get device health
        device_health = session_manager.get_device_health(device_id)
        
        # Get device sessions
        sessions = session_manager.get_device_sessions(device_id)
        
        return {
            "status": "success",
            "device": {
                "device_id": device_id,
                "device_info": device_info.get("device_info", {}),
                "registered_at": device_info.get("registered_at"),
                "last_updated": device_info.get("last_updated"),
                "health_status": device_health.get("status", "unknown") if device_health else "unknown",
                "last_health_check": device_health.get("timestamp") if device_health else None,
                "active_sessions": len(sessions),
                "sessions": sessions
            }
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting device: {str(e)}"
        )

@router.websocket("/ws/session/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: str
):
    """
    WebSocket endpoint for session monitoring.
    
    This endpoint is used by the frontend to receive real-time updates
    about a specific session.
    """
    try:
        # Accept the connection
        await websocket.accept()
        
        # Check if session exists
        session = session_manager.get_session(session_id)
        
        if not session:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Session not found"
            }))
            await websocket.close()
            return
        
        # Send initial session data
        await websocket.send_text(json.dumps({
            "type": "session_info",
            "session": {**session, "session_id": session_id}
        }))
        
        # Keep the connection open and send updates
        while True:
            # Check if session still exists
            session = session_manager.get_session(session_id)
            
            if not session:
                await websocket.send_text(json.dumps({
                    "type": "session_ended",
                    "message": "Session has ended"
                }))
                break
            
            # Send heartbeat
            await websocket.send_text(json.dumps({
                "type": "heartbeat",
                "timestamp": datetime.utcnow().isoformat()
            }))
            
            # Wait for a while
            await asyncio.sleep(5)
    
    except WebSocketDisconnect:
        pass
    
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error: {str(e)}"
            }))
        except:
            pass
    
    finally:
        try:
            await websocket.close()
        except:
            pass
