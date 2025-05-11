#!/usr/bin/env python3
"""
Android Lab Platform Gateway Agent

This script runs on a host machine with physical or virtual Android devices connected.
It periodically scans for connected devices and reports their status to the server.
It also listens for WebSocket commands to execute shell commands, ADB tunnels, or serial proxying.
"""

import os
import sys
import json
import argparse
import subprocess
import logging
import platform
import asyncio
import signal
import time
import re
import websockets
import requests
import serial
import serial.tools.list_ports
from datetime import datetime
from typing import List, Dict, Any, Optional, Set, Tuple
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('gateway_agent.log')
    ]
)
logger = logging.getLogger('gateway_agent')

class DeviceEventHandler(FileSystemEventHandler):
    """
    Watchdog event handler for monitoring device connections.
    This watches for changes in the /dev directory on Linux or
    device manager events on Windows.
    """
    def __init__(self, callback):
        self.callback = callback
        
    def on_created(self, event):
        if not event.is_directory and self._is_device_file(event.src_path):
            logger.info(f"Device connected: {event.src_path}")
            self.callback()
    
    def on_deleted(self, event):
        if not event.is_directory and self._is_device_file(event.src_path):
            logger.info(f"Device disconnected: {event.src_path}")
            self.callback()
    
    def _is_device_file(self, path):
        """Check if the file path is a potential device file"""
        if platform.system() == "Linux":
            # On Linux, check for USB or tty devices
            return ("/dev/bus/usb" in path or 
                    "/dev/ttyUSB" in path or 
                    "/dev/ttyACM" in path)
        elif platform.system() == "Windows":
            # On Windows, this is more complex and may require different approach
            return False
        return False

class GatewayAgent:
    def __init__(self, server_url: str, gateway_id: str, websocket_url: str = None, 
                 interval: int = 30, device_scan_interval: int = 10,
                 serial_port_scan_interval: int = 30, serial_port_baud_rate: int = 115200):
        """
        Initialize the gateway agent.
        
        Args:
            server_url: URL of the Android Lab Platform server
            gateway_id: Unique identifier for this gateway
            websocket_url: WebSocket URL for receiving commands
            interval: Heartbeat interval in seconds
            device_scan_interval: Interval for scanning devices in seconds
            serial_port_scan_interval: Interval for scanning serial ports in seconds
            serial_port_baud_rate: Default baud rate for serial ports
        """
        self.server_url = server_url.rstrip('/')
        self.gateway_id = gateway_id
        self.websocket_url = websocket_url
        self.interval = interval
        self.device_scan_interval = device_scan_interval
        self.serial_port_scan_interval = serial_port_scan_interval
        self.serial_port_baud_rate = serial_port_baud_rate
        
        self.api_token = None
        self.active_processes = {}  # Store active processes by job_id
        self.active_adb_tunnels = {}  # Store active ADB tunnels by device_id
        self.active_serial_connections = {}  # Store active serial connections by port
        self.active_websockets = {}  # Store active WebSocket connections by client_id
        
        self.known_devices = set()  # Set of known device serials
        self.known_serial_ports = set()  # Set of known serial ports
        
        self.running = False
        self.tasks = []
        
        logger.info(f"Gateway Agent initialized with ID: {gateway_id}")
        logger.info(f"Server URL: {server_url}")
        logger.info(f"WebSocket URL: {websocket_url}")
        logger.info(f"Heartbeat interval: {interval} seconds")
    
    async def authenticate(self, username: str, password: str) -> bool:
        """
        Authenticate with the server and get an API token.
        
        Args:
            username: Username for authentication
            password: Password for authentication
            
        Returns:
            bool: True if authentication was successful
        """
        try:
            response = await asyncio.to_thread(
                requests.post,
                f"{self.server_url}/auth/login/json",
                json={"username": username, "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.api_token = data["access_token"]
                logger.info("Authentication successful")
                return True
            else:
                logger.error(f"Authentication failed: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return False
    
    async def get_adb_devices(self) -> List[Dict[str, Any]]:
        """
        Get a list of connected Android devices using ADB.
        
        Returns:
            List of device dictionaries with device information
        """
        devices = []
        
        try:
            # Run ADB devices command
            process = await asyncio.create_subprocess_exec(
                "adb", "devices", "-l",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"Error running adb devices: {stderr.decode()}")
                return devices
            
            # Parse output
            lines = stdout.decode().strip().split('\n')
            if len(lines) <= 1:
                logger.info("No devices found")
                return devices
            
            # Track current devices
            current_devices = set()
            
            # Skip the first line (header)
            for line in lines[1:]:
                if not line.strip():
                    continue
                
                parts = line.strip().split()
                if len(parts) < 2:
                    continue
                
                serial = parts[0]
                status = parts[1]
                
                current_devices.add(serial)
                
                if status != "device":
                    # Skip offline or unauthorized devices
                    logger.warning(f"Skipping device {serial} with status {status}")
                    continue
                
                # Get device properties
                device = {
                    "name": serial,
                    "serial_number": serial,
                    "gateway_id": self.gateway_id,
                    "device_type": "physical",
                    "adb_status": True,
                    "serial_status": False  # We'll check serial status separately
                }
                
                # Get additional device properties
                try:
                    # Get manufacturer
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "getprop", "ro.product.manufacturer",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    device["manufacturer"] = stdout.decode().strip()
                    
                    # Get model
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "getprop", "ro.product.model",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    device["model"] = stdout.decode().strip()
                    
                    # Get Android version
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "getprop", "ro.build.version.release",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    device["android_version"] = stdout.decode().strip()
                    
                    # Get API level
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "getprop", "ro.build.version.sdk",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    device["api_level"] = int(stdout.decode().strip())
                    
                    # Get IP address (if available)
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "ip", "route",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    
                    if proc.returncode == 0:
                        for line in stdout.decode().strip().split('\n'):
                            if "wlan0" in line and "src" in line:
                                parts = line.strip().split()
                                ip_index = parts.index("src") + 1
                                if ip_index < len(parts):
                                    device["ip_address"] = parts[ip_index]
                    
                except Exception as e:
                    logger.warning(f"Error getting device properties for {serial}: {str(e)}")
                
                devices.append(device)
            
            # Check for disconnected devices
            disconnected = self.known_devices - current_devices
            if disconnected:
                logger.info(f"Devices disconnected: {disconnected}")
                # We could send a notification here
            
            # Check for new devices
            new_devices = current_devices - self.known_devices
            if new_devices:
                logger.info(f"New devices connected: {new_devices}")
                # We could send a notification here
            
            # Update known devices
            self.known_devices = current_devices
        
        except Exception as e:
            logger.error(f"Error getting ADB devices: {str(e)}")
        
        return devices
    
    async def get_emulators(self) -> List[Dict[str, Any]]:
        """
        Get a list of running Android emulators.
        
        Returns:
            List of device dictionaries with emulator information
        """
        emulators = []
        
        try:
            # Run emulator -list-avds command
            process = await asyncio.create_subprocess_exec(
                "emulator", "-list-avds",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.warning(f"Failed to list Android emulators: {stderr.decode()}")
                return emulators
            
            avd_names = stdout.decode().strip().split('\n')
            
            # Check which emulators are running
            for avd_name in avd_names:
                if not avd_name.strip():
                    continue
                
                # Check if this AVD is running in ADB devices
                process = await asyncio.create_subprocess_exec(
                    "adb", "devices",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, _ = await process.communicate()
                
                # Look for emulator in the list
                emulator_found = False
                serial = None
                
                for line in stdout.decode().strip().split('\n'):
                    if "emulator-" in line and "device" in line:
                        serial = line.split()[0]
                        
                        # Check if this emulator is running the current AVD
                        try:
                            proc = await asyncio.create_subprocess_exec(
                                "adb", "-s", serial, "emu", "avd", "name",
                                stdout=asyncio.subprocess.PIPE,
                                stderr=asyncio.subprocess.PIPE
                            )
                            stdout, _ = await proc.communicate()
                            
                            if proc.returncode == 0 and avd_name in stdout.decode():
                                emulator_found = True
                                break
                        except:
                            pass
                
                if not emulator_found:
                    continue
                
                # Get emulator properties
                emulator = {
                    "name": f"Emulator: {avd_name}",
                    "serial_number": serial,
                    "gateway_id": self.gateway_id,
                    "device_type": "virtual",
                    "adb_status": True,
                    "serial_status": False
                }
                
                # Get additional emulator properties
                try:
                    # Get Android version
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "getprop", "ro.build.version.release",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    emulator["android_version"] = stdout.decode().strip()
                    
                    # Get API level
                    proc = await asyncio.create_subprocess_exec(
                        "adb", "-s", serial, "shell", "getprop", "ro.build.version.sdk",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    emulator["api_level"] = int(stdout.decode().strip())
                    
                    # Get IP address
                    emulator["ip_address"] = "localhost"
                    
                except Exception as e:
                    logger.warning(f"Error getting emulator properties for {avd_name}: {str(e)}")
                
                emulators.append(emulator)
        
        except Exception as e:
            logger.error(f"Error getting emulators: {str(e)}")
        
        return emulators
    
    async def get_serial_ports(self) -> List[Dict[str, Any]]:
        """
        Get a list of available serial ports.
        
        Returns:
            List of serial port dictionaries
        """
        ports = []
        current_ports = set()
        
        try:
            # List all serial ports
            available_ports = list(serial.tools.list_ports.comports())
            
            for port in available_ports:
                port_name = port.device
                current_ports.add(port_name)
                
                # Create port info
                port_info = {
                    "port": port_name,
                    "description": port.description,
                    "hardware_id": port.hwid,
                    "manufacturer": port.manufacturer,
                    "gateway_id": self.gateway_id,
                    "status": "available"
                }
                
                ports.append(port_info)
            
            # Check for disconnected ports
            disconnected = self.known_serial_ports - current_ports
            if disconnected:
                logger.info(f"Serial ports disconnected: {disconnected}")
                # We could send a notification here
            
            # Check for new ports
            new_ports = current_ports - self.known_serial_ports
            if new_ports:
                logger.info(f"New serial ports connected: {new_ports}")
                # We could send a notification here
            
            # Update known ports
            self.known_serial_ports = current_ports
            
        except Exception as e:
            logger.error(f"Error getting serial ports: {str(e)}")
        
        return ports
    
    async def execute_test(self, job_id: str, target_serial: str, command: str, artifact_path: Optional[str] = None) -> bool:
        """
        Execute a test command on a target device.
        
        Args:
            job_id: Unique identifier for the test job
            target_serial: Serial number of the target device
            command: Command to execute
            artifact_path: Path to the artifact file (optional)
            
        Returns:
            bool: True if the test was started successfully
        """
        if not self.api_token:
            logger.error("Not authenticated. Cannot execute test.")
            return False
        
        try:
            # Replace placeholders in command
            command = command.replace("{target}", target_serial)
            if artifact_path:
                command = command.replace("{artifact}", artifact_path)
            
            logger.info(f"Executing test command: {command}")
            
            # Start process
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Store process
            self.active_processes[job_id] = {
                "process": process,
                "target_serial": target_serial,
                "command": command,
                "start_time": datetime.utcnow(),
                "logs": []
            }
            
            # Start tasks to read output
            asyncio.create_task(self._read_process_output(job_id, process))
            
            return True
        
        except Exception as e:
            logger.error(f"Error executing test: {str(e)}")
            
            # Send error to server
            await self.send_test_completion(job_id, -1, str(e))
            
            return False
    
    async def _read_process_output(self, job_id: str, process: asyncio.subprocess.Process):
        """
        Read output from a process and send it to the server.
        
        Args:
            job_id: Unique identifier for the job
            process: Process to read output from
        """
        try:
            # Read stdout
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                log_line = line.decode().strip()
                
                # Store log
                if job_id in self.active_processes:
                    self.active_processes[job_id]["logs"].append(log_line)
                
                # Send log to server
                await self.send_test_log(job_id, log_line, False)
                
                # Log locally
                logger.info(f"Test {job_id}: {log_line}")
            
            # Read stderr
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                
                log_line = line.decode().strip()
                
                # Store log
                if job_id in self.active_processes:
                    self.active_processes[job_id]["logs"].append(f"ERROR: {log_line}")
                
                # Send log to server
                await self.send_test_log(job_id, log_line, True)
                
                # Log locally
                logger.error(f"Test {job_id}: {log_line}")
            
            # Wait for process to complete
            exit_code = await process.wait()
            
            # Process completed
            logger.info(f"Test {job_id} completed with exit code {exit_code}")
            
            # Send completion to server
            await self.send_test_completion(job_id, exit_code)
            
            # Remove process
            if job_id in self.active_processes:
                del self.active_processes[job_id]
        
        except Exception as e:
            logger.error(f"Error reading process output: {str(e)}")
            
            # Send error to server
            await self.send_test_completion(job_id, -1, str(e))
    
    async def send_test_log(self, job_id: str, log_line: str, is_error: bool = False) -> bool:
        """
        Send a test log line to the server.
        
        Args:
            job_id: Unique identifier for the test job
            log_line: Log line to send
            is_error: Whether this is an error log
            
        Returns:
            bool: True if the log was sent successfully
        """
        if not self.api_token:
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "job_id": job_id,
                "log": log_line,
                "is_error": is_error,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            response = await asyncio.to_thread(
                requests.post,
                f"{self.server_url}/tests/logs",
                headers=headers,
                json=data
            )
            
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error sending test log: {str(e)}")
            return False
    
    async def send_test_completion(self, job_id: str, exit_code: int, error: Optional[str] = None) -> bool:
        """
        Send test completion status to the server.
        
        Args:
            job_id: Unique identifier for the test job
            exit_code: Exit code of the test process
            error: Error message if the test failed to start
            
        Returns:
            bool: True if the completion status was sent successfully
        """
        if not self.api_token:
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "job_id": job_id,
                "exit_code": exit_code,
                "end_time": datetime.utcnow().isoformat()
            }
            
            if error:
                data["error"] = error
            
            response = await asyncio.to_thread(
                requests.post,
                f"{self.server_url}/tests/completion",
                headers=headers,
                json=data
            )
            
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error sending test completion: {str(e)}")
            return False
    
    async def send_heartbeat(self, devices: List[Dict[str, Any]], serial_ports: List[Dict[str, Any]]) -> bool:
        """
        Send a heartbeat to the server with the list of devices and serial ports.
        
        Args:
            devices: List of device dictionaries
            serial_ports: List of serial port dictionaries
            
        Returns:
            bool: True if heartbeat was successful
        """
        if not self.api_token:
            logger.error("Not authenticated. Cannot send heartbeat.")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "gateway_id": self.gateway_id,
                "devices": devices,
                "serial_ports": serial_ports,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            response = await asyncio.to_thread(
                requests.post,
                f"{self.server_url}/targets/heartbeat",
                headers=headers,
                json=data
            )
            
            if response.status_code == 200:
                logger.info(f"Heartbeat sent successfully with {len(devices)} devices and {len(serial_ports)} serial ports")
                return True
            else:
                logger.error(f"Failed to send heartbeat: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error sending heartbeat: {str(e)}")
            return False
    
    async def check_pending_tests(self) -> bool:
        """
        Check for pending test jobs from the server.
        
        Returns:
            bool: True if check was successful
        """
        if not self.api_token:
            logger.error("Not authenticated. Cannot check for pending tests.")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            
            response = await asyncio.to_thread(
                requests.get,
                f"{self.server_url}/tests/pending?gateway_id={self.gateway_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                pending_tests = data.get("tests", [])
                
                if pending_tests:
                    logger.info(f"Found {len(pending_tests)} pending test jobs")
                    
                    for test in pending_tests:
                        job_id = test.get("id")
                        target_serial = test.get("target_serial")
                        command = test.get("command")
                        artifact_path = test.get("artifact_path")
                        
                        # Execute test
                        await self.execute_test(job_id, target_serial, command, artifact_path)
                
                return True
            else:
                logger.error(f"Failed to check pending tests: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error checking pending tests: {str(e)}")
            return False
    
    async def start_adb_shell(self, target_serial: str, client_id: str, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Start an ADB shell for a target device and connect it to a WebSocket.
        
        Args:
            target_serial: Serial number of the target device
            client_id: Unique identifier for the client
            websocket: WebSocket connection to the client
        """
        try:
            logger.info(f"Starting ADB shell for device {target_serial}, client {client_id}")
            
            # Start ADB shell process
            process = await asyncio.create_subprocess_exec(
                "adb", "-s", target_serial, "shell",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Store connection
            connection_id = f"adb_{target_serial}_{client_id}"
            self.active_adb_tunnels[connection_id] = {
                "process": process,
                "target_serial": target_serial,
                "client_id": client_id,
                "websocket": websocket,
                "start_time": datetime.utcnow()
            }
            
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "system",
                "message": f"Connected to ADB shell for device {target_serial}"
            }))
            
            # Start tasks to handle I/O
            read_task = asyncio.create_task(self._read_process_to_websocket(process, websocket))
            write_task = asyncio.create_task(self._read_websocket_to_process(websocket, process, connection_id))
            
            # Wait for either task to complete
            done, pending = await asyncio.wait(
                [read_task, write_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Cancel pending tasks
            for task in pending:
                task.cancel()
            
            # Clean up
            if connection_id in self.active_adb_tunnels:
                del self.active_adb_tunnels[connection_id]
            
            # Kill process if still running
            try:
                process.kill()
            except:
                pass
            
            logger.info(f"ADB shell for device {target_serial}, client {client_id} closed")
        
        except Exception as e:
            logger.error(f"Error in ADB shell: {str(e)}")
            
            # Send error to client
            try:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                }))
            except:
                pass
    
    async def start_serial_console(self, port: str, client_id: str, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Start a serial console for a port and connect it to a WebSocket.
        
        Args:
            port: Serial port to connect to
            client_id: Unique identifier for the client
            websocket: WebSocket connection to the client
        """
        try:
            logger.info(f"Starting serial console for port {port}, client {client_id}")
            
            # Open serial port
            ser = serial.Serial(port, self.serial_port_baud_rate, timeout=1)
            
            # Store connection
            connection_id = f"serial_{port}_{client_id}"
            self.active_serial_connections[connection_id] = {
                "serial": ser,
                "port": port,
                "client_id": client_id,
                "websocket": websocket,
                "start_time": datetime.utcnow()
            }
            
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "system",
                "message": f"Connected to serial console for port {port} at {self.serial_port_baud_rate} baud"
            }))
            
            # Start tasks to handle I/O
            read_task = asyncio.create_task(self._read_serial_to_websocket(ser, websocket))
            write_task = asyncio.create_task(self._read_websocket_to_serial(websocket, ser, connection_id))
            
            # Wait for either task to complete
            done, pending = await asyncio.wait(
                [read_task, write_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Cancel pending tasks
            for task in pending:
                task.cancel()
            
            # Clean up
            if connection_id in self.active_serial_connections:
                del self.active_serial_connections[connection_id]
            
            # Close serial port
            try:
                ser.close()
            except:
                pass
            
            logger.info(f"Serial console for port {port}, client {client_id} closed")
        
        except Exception as e:
            logger.error(f"Error in serial console: {str(e)}")
            
            # Send error to client
            try:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                }))
            except:
                pass
    
    async def _read_process_to_websocket(self, process: asyncio.subprocess.Process, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Read output from a process and send it to a WebSocket.
        
        Args:
            process: Process to read from
            websocket: WebSocket to send to
        """
        try:
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                await websocket.send(json.dumps({
                    "type": "output",
                    "message": line.decode()
                }))
            
            # Read stderr
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": line.decode()
                }))
        
        except Exception as e:
            logger.error(f"Error reading process output: {str(e)}")
    
    async def _read_websocket_to_process(self, websocket: websockets.WebSocketServerProtocol, process: asyncio.subprocess.Process, connection_id: str) -> None:
        """
        Read commands from a WebSocket and send them to a process.
        
        Args:
            websocket: WebSocket to read from
            process: Process to send to
            connection_id: Identifier for the connection
        """
        try:
            while True:
                message = await websocket.recv()
                
                try:
                    data = json.loads(message)
                    
                    if data.get("type") == "command":
                        command = data.get("message", "")
                        
                        # Send command to process
                        if command:
                            process.stdin.write(f"{command}\n".encode())
                            await process.stdin.drain()
                
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON from WebSocket: {message}")
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {str(e)}")
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket connection closed for {connection_id}")
        except Exception as e:
            logger.error(f"Error reading from WebSocket: {str(e)}")
    
    async def _read_serial_to_websocket(self, ser: serial.Serial, websocket: websockets.WebSocketServerProtocol) -> None:
        """
        Read data from a serial port and send it to a WebSocket.
        
        Args:
            ser: Serial port to read from
            websocket: WebSocket to send to
        """
        try:
            while True:
                # Read from serial port
                data = await asyncio.to_thread(ser.read, 1024)
                
                if data:
                    # Send to WebSocket
                    await websocket.send(json.dumps({
                        "type": "output",
                        "message": data.decode(errors="replace")
                    }))
                
                # Small delay to prevent CPU hogging
                await asyncio.sleep(0.01)
        
        except Exception as e:
            logger.error(f"Error reading from serial port: {str(e)}")
    
    async def _read_websocket_to_serial(self, websocket: websockets.WebSocketServerProtocol, ser: serial.Serial, connection_id: str) -> None:
        """
        Read commands from a WebSocket and send them to a serial port.
        
        Args:
            websocket: WebSocket to read from
            ser: Serial port to send to
            connection_id: Identifier for the connection
        """
        try:
            while True:
                message = await websocket.recv()
                
                try:
                    data = json.loads(message)
                    
                    if data.get("type") == "command":
                        command = data.get("message", "")
                        
                        # Send command to serial port
                        if command:
                            await asyncio.to_thread(ser.write, f"{command}\n".encode())
                
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON from WebSocket: {message}")
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {str(e)}")
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket connection closed for {connection_id}")
        except Exception as e:
            logger.error(f"Error reading from WebSocket: {str(e)}")
    
    async def websocket_handler(self, websocket: websockets.WebSocketServerProtocol, path: str) -> None:
        """
        Handle WebSocket connections from the server.
        
        Args:
            websocket: WebSocket connection
            path: WebSocket path
        """
        try:
            # Generate a unique client ID
            client_id = f"client_{len(self.active_websockets) + 1}_{int(time.time())}"
            
            # Store WebSocket connection
            self.active_websockets[client_id] = {
                "websocket": websocket,
                "path": path,
                "connected_at": datetime.utcnow()
            }
            
            logger.info(f"WebSocket connection established: {client_id} on {path}")
            
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "system",
                "message": f"Connected to Android Lab Platform Gateway Agent {self.gateway_id}"
            }))
            
            # Handle messages
            while True:
                message = await websocket.recv()
                
                try:
                    data = json.loads(message)
                    command_type = data.get("type")
                    
                    if command_type == "adb_shell":
                        # Start ADB shell
                        target_serial = data.get("target_serial")
                        if target_serial:
                            await self.start_adb_shell(target_serial, client_id, websocket)
                    
                    elif command_type == "serial_console":
                        # Start serial console
                        port = data.get("port")
                        if port:
                            await self.start_serial_console(port, client_id, websocket)
                    
                    elif command_type == "execute_test":
                        # Execute test
                        job_id = data.get("job_id")
                        target_serial = data.get("target_serial")
                        command = data.get("command")
                        artifact_path = data.get("artifact_path")
                        
                        if job_id and target_serial and command:
                            success = await self.execute_test(job_id, target_serial, command, artifact_path)
                            
                            await websocket.send(json.dumps({
                                "type": "test_status",
                                "job_id": job_id,
                                "success": success,
                                "message": "Test started" if success else "Failed to start test"
                            }))
                    
                    elif command_type == "ping":
                        # Ping-pong for keepalive
                        await websocket.send(json.dumps({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                    
                    else:
                        logger.warning(f"Unknown command type: {command_type}")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": f"Unknown command type: {command_type}"
                        }))
                
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON from WebSocket: {message}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }))
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {str(e)}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": f"Error: {str(e)}"
                    }))
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket connection closed: {client_id}")
        except Exception as e:
            logger.error(f"WebSocket handler error: {str(e)}")
        finally:
            # Clean up
            if client_id in self.active_websockets:
                del self.active_websockets[client_id]
    
    async def start_websocket_server(self) -> None:
        """Start WebSocket server for receiving commands"""
        if not self.websocket_url:
            logger.warning("WebSocket URL not provided, skipping WebSocket server")
            return
        
        try:
            # Parse WebSocket URL
            url_parts = self.websocket_url.split(":")
            if len(url_parts) >= 3:
                host = url_parts[1].strip("/")
                port = int(url_parts[2].split("/")[0])
            else:
                host = "localhost"
                port = 8765
            
            # Start WebSocket server
            logger.info(f"Starting WebSocket server on {host}:{port}")
            
            async with websockets.serve(self.websocket_handler, host, port):
                while self.running:
                    await asyncio.sleep(1)
        
        except Exception as e:
            logger.error(f"Error starting WebSocket server: {str(e)}")
    
    async def device_monitor_task(self) -> None:
        """Task to monitor devices and send heartbeats"""
        while self.running:
            try:
                # Get physical devices
                physical_devices = await self.get_adb_devices()
                
                # Get virtual devices (emulators)
                virtual_devices = await self.get_emulators()
                
                # Get serial ports
                serial_ports = await self.get_serial_ports()
                
                # Combine all devices
                all_devices = physical_devices + virtual_devices
                
                # Send heartbeat
                await self.send_heartbeat(all_devices, serial_ports)
                
                # Check for pending test jobs
                await self.check_pending_tests()
            
            except Exception as e:
                logger.error(f"Error in device monitor task: {str(e)}")
            
            # Sleep until next scan
            await asyncio.sleep(self.device_scan_interval)
    
    async def setup_watchdog(self) -> None:
        """Set up watchdog for device monitoring"""
        try:
            # Set up watchdog observer
            observer = Observer()
            
            # Set up event handler
            handler = DeviceEventHandler(self.trigger_device_scan)
            
            # Add watches
            if platform.system() == "Linux":
                # Watch /dev directory for device changes
                observer.schedule(handler, "/dev", recursive=False)
            
            # Start observer
            observer.start()
            logger.info("Watchdog observer started")
            
            # Keep observer running
            while self.running:
                await asyncio.sleep(1)
            
            # Stop observer
            observer.stop()
            observer.join()
        
        except Exception as e:
            logger.error(f"Error setting up watchdog: {str(e)}")
    
    def trigger_device_scan(self) -> None:
        """Trigger an immediate device scan"""
        if self.running:
            # Create a task to scan devices
            asyncio.create_task(self.scan_devices())
    
    async def scan_devices(self) -> None:
        """Scan for devices and send heartbeat"""
        try:
            # Get physical devices
            physical_devices = await self.get_adb_devices()
            
            # Get virtual devices (emulators)
            virtual_devices = await self.get_emulators()
            
            # Get serial ports
            serial_ports = await self.get_serial_ports()
            
            # Combine all devices
            all_devices = physical_devices + virtual_devices
            
            # Send heartbeat
            await self.send_heartbeat(all_devices, serial_ports)
        
        except Exception as e:
            logger.error(f"Error scanning devices: {str(e)}")
    
    async def start(self, username: str = None, password: str = None) -> None:
        """
        Start the gateway agent.
        
        Args:
            username: Username for authentication (optional)
            password: Password for authentication (optional)
        """
        self.running = True
        
        # Authenticate if credentials provided
        if username and password:
            if not await self.authenticate(username, password):
                logger.error("Authentication failed. Exiting.")
                self.running = False
                return
        
        # Start tasks
        self.tasks = [
            asyncio.create_task(self.device_monitor_task()),
            asyncio.create_task(self.setup_watchdog())
        ]
        
        # Start WebSocket server if URL provided
        if self.websocket_url:
            self.tasks.append(asyncio.create_task(self.start_websocket_server()))
        
        # Wait for tasks to complete
        await asyncio.gather(*self.tasks)
    
    async def stop(self) -> None:
        """Stop the gateway agent"""
        self.running = False
        
        # Cancel tasks
        for task in self.tasks:
            task.cancel()
        
        # Clean up processes
        for job_id, job in self.active_processes.items():
            try:
                job["process"].kill()
            except:
                pass
        
        # Clean up ADB tunnels
        for connection_id, connection in self.active_adb_tunnels.items():
            try:
                connection["process"].kill()
            except:
                pass
        
        # Clean up serial connections
        for connection_id, connection in self.active_serial_connections.items():
            try:
                connection["serial"].close()
            except:
                pass
        
        # Clean up WebSocket connections
        for client_id, connection in self.active_websockets.items():
            try:
                await connection["websocket"].close()
            except:
                pass
        
        logger.info("Gateway agent stopped")

async def main_async():
    """Async main entry point"""
    parser = argparse.ArgumentParser(description="Android Lab Platform Gateway Agent")
    parser.add_argument("--server", help="Server URL")
    parser.add_argument("--gateway-id", help="Gateway ID")
    parser.add_argument("--websocket-url", help="WebSocket URL")
    parser.add_argument("--interval", type=int, help="Heartbeat interval in seconds")
    parser.add_argument("--device-scan-interval", type=int, help="Device scan interval in seconds")
    parser.add_argument("--serial-port-scan-interval", type=int, help="Serial port scan interval in seconds")
    parser.add_argument("--serial-port-baud-rate", type=int, help="Serial port baud rate")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--no-auth", action="store_true", help="Run without authentication")
    parser.add_argument("--log-level", help="Logging level")
    
    args = parser.parse_args()
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Get settings from environment or command line
    server_url = args.server or os.getenv("SERVER_URL", "http://localhost:8000")
    gateway_id = args.gateway_id or os.getenv("GATEWAY_ID", f"gateway-{os.getenv('HOSTNAME', 'unknown')}")
    websocket_url = args.websocket_url or os.getenv("WEBSOCKET_URL")
    interval = args.interval or int(os.getenv("INTERVAL", "30"))
    device_scan_interval = args.device_scan_interval or int(os.getenv("DEVICE_SCAN_INTERVAL", "10"))
    serial_port_scan_interval = args.serial_port_scan_interval or int(os.getenv("SERIAL_PORT_SCAN_INTERVAL", "30"))
    serial_port_baud_rate = args.serial_port_baud_rate or int(os.getenv("SERIAL_PORT_BAUD_RATE", "115200"))
    username = args.username or os.getenv("USERNAME")
    password = args.password or os.getenv("PASSWORD")
    log_level = args.log_level or os.getenv("LOG_LEVEL", "INFO")
    
    # Set log level
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Create gateway agent
    agent = GatewayAgent(
        server_url=server_url,
        gateway_id=gateway_id,
        websocket_url=websocket_url,
        interval=interval,
        device_scan_interval=device_scan_interval,
        serial_port_scan_interval=serial_port_scan_interval,
        serial_port_baud_rate=serial_port_baud_rate
    )
    
    # Set up signal handlers
    loop = asyncio.get_running_loop()
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(agent.stop()))
    
    # Start the agent
    try:
        if not args.no_auth and username and password:
            logger.info(f"Starting gateway agent with authentication as {username}")
            await agent.start(username, password)
        else:
            logger.info("Starting gateway agent without authentication")
            await agent.start()
    except Exception as e:
        logger.error(f"Gateway agent error: {str(e)}")
        sys.exit(1)

def main():
    """Main entry point"""
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\nGateway agent stopped by user")
    except Exception as e:
        print(f"Gateway agent error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
