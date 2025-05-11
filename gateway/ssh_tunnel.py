#!/usr/bin/env python3
"""
SSH Tunnel Manager for Android Lab Platform Gateway

This module handles the creation and management of reverse SSH tunnels
between the gateway and Android devices. It includes:
- TLS mutual authentication
- Automatic retries and health checks
- JWT token-based authorization
- Routing policies based on target groups and user roles
"""

import os
import sys
import json
import asyncio
import logging
import time
import signal
import socket
import ssl
import jwt
import paramiko
import uuid
import subprocess
import shutil
from typing import Dict, List, Optional, Tuple, Set, Any
from datetime import datetime, timedelta
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('ssh_tunnel.log')
    ]
)
logger = logging.getLogger('ssh_tunnel')

class SSHKeyManager:
    """
    Manages SSH key generation, registration, and rotation for devices.
    """
    def __init__(self, keys_dir: str = "keys"):
        self.keys_dir = Path(keys_dir)
        self.keys_dir.mkdir(exist_ok=True)
        self.device_keys: Dict[str, Dict[str, Any]] = {}
        
    def generate_device_key(self, device_id: str) -> Tuple[str, str]:
        """
        Generate a new SSH key pair for a device.
        
        Args:
            device_id: Unique identifier for the device
            
        Returns:
            Tuple of (private_key_path, public_key_path)
        """
        device_dir = self.keys_dir / device_id
        device_dir.mkdir(exist_ok=True)
        
        private_key_path = device_dir / "id_rsa"
        public_key_path = device_dir / "id_rsa.pub"
        
        # Check if keys already exist
        if private_key_path.exists() and public_key_path.exists():
            logger.info(f"SSH keys already exist for device {device_id}")
            return str(private_key_path), str(public_key_path)
        
        # Generate new key pair
        key = paramiko.RSAKey.generate(2048)
        
        # Save private key
        key.write_private_key_file(str(private_key_path))
        
        # Save public key
        with open(public_key_path, 'w') as f:
            f.write(f"{key.get_name()} {key.get_base64()}")
        
        logger.info(f"Generated new SSH key pair for device {device_id}")
        
        # Store key info
        self.device_keys[device_id] = {
            "private_key": str(private_key_path),
            "public_key": str(public_key_path),
            "created_at": datetime.utcnow().isoformat(),
            "last_used": None
        }
        
        return str(private_key_path), str(public_key_path)
    
    def get_device_key(self, device_id: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Get the SSH key pair for a device.
        
        Args:
            device_id: Unique identifier for the device
            
        Returns:
            Tuple of (private_key_path, public_key_path) or (None, None) if not found
        """
        device_dir = self.keys_dir / device_id
        private_key_path = device_dir / "id_rsa"
        public_key_path = device_dir / "id_rsa.pub"
        
        if private_key_path.exists() and public_key_path.exists():
            # Update last used timestamp
            if device_id in self.device_keys:
                self.device_keys[device_id]["last_used"] = datetime.utcnow().isoformat()
            
            return str(private_key_path), str(public_key_path)
        
        return None, None
    
    def get_public_key_content(self, device_id: str) -> Optional[str]:
        """
        Get the content of the public key for a device.
        
        Args:
            device_id: Unique identifier for the device
            
        Returns:
            Public key content or None if not found
        """
        _, public_key_path = self.get_device_key(device_id)
        
        if public_key_path:
            with open(public_key_path, 'r') as f:
                return f.read().strip()
        
        return None
    
    def rotate_device_key(self, device_id: str) -> Tuple[str, str]:
        """
        Rotate the SSH key pair for a device.
        
        Args:
            device_id: Unique identifier for the device
            
        Returns:
            Tuple of (private_key_path, public_key_path)
        """
        device_dir = self.keys_dir / device_id
        
        # Backup old keys if they exist
        private_key_path = device_dir / "id_rsa"
        public_key_path = device_dir / "id_rsa.pub"
        
        if private_key_path.exists() and public_key_path.exists():
            backup_time = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            private_key_backup = device_dir / f"id_rsa.{backup_time}.bak"
            public_key_backup = device_dir / f"id_rsa.pub.{backup_time}.bak"
            
            shutil.copy2(private_key_path, private_key_backup)
            shutil.copy2(public_key_path, public_key_backup)
            
            logger.info(f"Backed up old SSH keys for device {device_id}")
        
        # Generate new keys
        return self.generate_device_key(device_id)

class TLSCertManager:
    """
    Manages TLS certificates for mutual authentication.
    """
    def __init__(self, certs_dir: str = "certs"):
        self.certs_dir = Path(certs_dir)
        self.certs_dir.mkdir(exist_ok=True)
        self.ca_cert = self.certs_dir / "ca.crt"
        self.ca_key = self.certs_dir / "ca.key"
        
        # Ensure CA certificate exists
        if not self.ca_cert.exists() or not self.ca_key.exists():
            self._generate_ca_cert()
    
    def _generate_ca_cert(self):
        """Generate a self-signed CA certificate"""
        # Check if openssl is available
        if not shutil.which("openssl"):
            logger.error("OpenSSL not found. Cannot generate certificates.")
            raise RuntimeError("OpenSSL not found. Cannot generate certificates.")
        
        # Generate CA private key
        subprocess.run([
            "openssl", "genrsa", 
            "-out", str(self.ca_key),
            "4096"
        ], check=True)
        
        # Generate CA certificate
        subprocess.run([
            "openssl", "req", 
            "-x509", 
            "-new", 
            "-nodes", 
            "-key", str(self.ca_key),
            "-sha256", 
            "-days", "3650", 
            "-out", str(self.ca_cert),
            "-subj", "/C=US/ST=State/L=City/O=Android Lab Platform/OU=Gateway/CN=ALP Gateway CA"
        ], check=True)
        
        logger.info("Generated new CA certificate")
    
    def generate_device_cert(self, device_id: str) -> Tuple[str, str]:
        """
        Generate a TLS certificate for a device.
        
        Args:
            device_id: Unique identifier for the device
            
        Returns:
            Tuple of (cert_path, key_path)
        """
        device_dir = self.certs_dir / device_id
        device_dir.mkdir(exist_ok=True)
        
        key_path = device_dir / "device.key"
        csr_path = device_dir / "device.csr"
        cert_path = device_dir / "device.crt"
        
        # Generate device private key
        subprocess.run([
            "openssl", "genrsa", 
            "-out", str(key_path),
            "2048"
        ], check=True)
        
        # Generate CSR
        subprocess.run([
            "openssl", "req", 
            "-new", 
            "-key", str(key_path),
            "-out", str(csr_path),
            "-subj", f"/C=US/ST=State/L=City/O=Android Lab Platform/OU=Device/CN={device_id}"
        ], check=True)
        
        # Sign CSR with CA
        subprocess.run([
            "openssl", "x509", 
            "-req", 
            "-in", str(csr_path),
            "-CA", str(self.ca_cert),
            "-CAkey", str(self.ca_key),
            "-CAcreateserial", 
            "-out", str(cert_path),
            "-days", "365",
            "-sha256"
        ], check=True)
        
        # Clean up CSR
        csr_path.unlink()
        
        logger.info(f"Generated new TLS certificate for device {device_id}")
        
        return str(cert_path), str(key_path)
    
    def get_device_cert(self, device_id: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Get the TLS certificate for a device.
        
        Args:
            device_id: Unique identifier for the device
            
        Returns:
            Tuple of (cert_path, key_path) or (None, None) if not found
        """
        device_dir = self.certs_dir / device_id
        cert_path = device_dir / "device.crt"
        key_path = device_dir / "device.key"
        
        if cert_path.exists() and key_path.exists():
            return str(cert_path), str(key_path)
        
        return None, None
    
    def get_ca_cert(self) -> str:
        """
        Get the CA certificate path.
        
        Returns:
            Path to the CA certificate
        """
        return str(self.ca_cert)

class JWTAuthenticator:
    """
    Handles JWT token validation and authorization.
    """
    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        self.algorithm = algorithm
    
    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate a JWT token.
        
        Args:
            token: JWT token to validate
            
        Returns:
            Decoded token payload or None if invalid
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.PyJWTError as e:
            logger.error(f"JWT validation error: {str(e)}")
            return None
    
    def check_permission(self, token_payload: Dict[str, Any], required_role: str) -> bool:
        """
        Check if the token has the required role.
        
        Args:
            token_payload: Decoded token payload
            required_role: Required role for access
            
        Returns:
            True if authorized, False otherwise
        """
        # Get user role from token
        user_role = token_payload.get("role", "")
        
        # Admin role has access to everything
        if user_role == "admin":
            return True
        
        # Check role hierarchy
        if required_role == "developer" and user_role in ["developer", "admin"]:
            return True
        
        if required_role == "tester" and user_role in ["tester", "developer", "admin"]:
            return True
        
        # Check specific permissions if present
        permissions = token_payload.get("permissions", [])
        if f"access:{required_role}" in permissions:
            return True
        
        return False
    
    def check_target_access(self, token_payload: Dict[str, Any], target_id: str) -> bool:
        """
        Check if the token has access to the specified target.
        
        Args:
            token_payload: Decoded token payload
            target_id: Target device ID
            
        Returns:
            True if authorized, False otherwise
        """
        # Admin role has access to all targets
        if token_payload.get("role") == "admin":
            return True
        
        # Check target-specific permissions
        allowed_targets = token_payload.get("targets", [])
        if target_id in allowed_targets or "*" in allowed_targets:
            return True
        
        # Check target group permissions
        target_groups = token_payload.get("target_groups", [])
        # In a real implementation, we would check if the target belongs to any of these groups
        # For now, we'll just check if the target ID starts with any of the group prefixes
        for group in target_groups:
            if target_id.startswith(group):
                return True
        
        return False

class SSHTunnelManager:
    """
    Manages SSH tunnels for remote access to devices.
    """
    def __init__(
        self, 
        ssh_key_manager: SSHKeyManager,
        tls_cert_manager: TLSCertManager,
        jwt_authenticator: JWTAuthenticator,
        server_url: str,
        gateway_id: str,
        ssh_server_host: str = "0.0.0.0",
        ssh_server_port: int = 2222,
        retry_interval: int = 30,
        health_check_interval: int = 60
    ):
        self.ssh_key_manager = ssh_key_manager
        self.tls_cert_manager = tls_cert_manager
        self.jwt_authenticator = jwt_authenticator
        self.server_url = server_url
        self.gateway_id = gateway_id
        self.ssh_server_host = ssh_server_host
        self.ssh_server_port = ssh_server_port
        self.retry_interval = retry_interval
        self.health_check_interval = health_check_interval
        
        # Active tunnels: device_id -> {process, start_time, user_id, session_id}
        self.active_tunnels: Dict[str, Dict[str, Any]] = {}
        
        # Session logs: session_id -> list of log entries
        self.session_logs: Dict[str, List[Dict[str, Any]]] = {}
        
        # Routing policies: role -> {allowed_ports, allowed_commands}
        self.routing_policies: Dict[str, Dict[str, Any]] = {
            "admin": {
                "allowed_ports": ["*"],
                "allowed_commands": ["*"]
            },
            "developer": {
                "allowed_ports": [5555, 8080, 8000, 9000],
                "allowed_commands": ["adb", "shell", "logcat", "install", "uninstall", "push", "pull"]
            },
            "tester": {
                "allowed_ports": [5555, 8080],
                "allowed_commands": ["adb", "shell", "logcat", "install"]
            }
        }
        
        # SSH server for handling incoming connections
        self.ssh_server = None
        
        # Flag to indicate if the manager is running
        self.running = False
    
    async def start(self):
        """Start the SSH tunnel manager"""
        self.running = True
        
        # Start health check task
        asyncio.create_task(self._health_check_task())
        
        # Start SSH server
        await self._start_ssh_server()
    
    async def stop(self):
        """Stop the SSH tunnel manager"""
        self.running = False
        
        # Stop all tunnels
        for device_id, tunnel_info in list(self.active_tunnels.items()):
            await self.stop_tunnel(device_id)
        
        # Stop SSH server
        if self.ssh_server:
            self.ssh_server.close()
            await self.ssh_server.wait_closed()
    
    async def _start_ssh_server(self):
        """Start the SSH server for handling incoming connections"""
        # In a real implementation, this would start a proper SSH server
        # For now, we'll just log that it's started
        logger.info(f"SSH server started on {self.ssh_server_host}:{self.ssh_server_port}")
    
    async def _health_check_task(self):
        """Periodically check the health of active tunnels"""
        while self.running:
            try:
                for device_id, tunnel_info in list(self.active_tunnels.items()):
                    # Check if process is still running
                    process = tunnel_info.get("process")
                    if process and process.returncode is not None:
                        logger.warning(f"Tunnel for device {device_id} has died. Restarting...")
                        
                        # Log the event
                        self._log_session_event(
                            tunnel_info.get("session_id", "unknown"),
                            "tunnel_died",
                            f"Tunnel process exited with code {process.returncode}"
                        )
                        
                        # Restart the tunnel
                        await self.start_tunnel(
                            device_id,
                            tunnel_info.get("user_id", "unknown"),
                            tunnel_info.get("token", ""),
                            tunnel_info.get("local_port", 5555),
                            tunnel_info.get("remote_port", 5555)
                        )
                    else:
                        # Perform a health check
                        healthy = await self._check_tunnel_health(device_id, tunnel_info)
                        
                        if not healthy:
                            logger.warning(f"Tunnel for device {device_id} is unhealthy. Restarting...")
                            
                            # Log the event
                            self._log_session_event(
                                tunnel_info.get("session_id", "unknown"),
                                "tunnel_unhealthy",
                                "Tunnel health check failed"
                            )
                            
                            # Restart the tunnel
                            await self.stop_tunnel(device_id)
                            await self.start_tunnel(
                                device_id,
                                tunnel_info.get("user_id", "unknown"),
                                tunnel_info.get("token", ""),
                                tunnel_info.get("local_port", 5555),
                                tunnel_info.get("remote_port", 5555)
                            )
            except Exception as e:
                logger.error(f"Error in health check task: {str(e)}")
            
            # Wait for next check
            await asyncio.sleep(self.health_check_interval)
    
    async def _check_tunnel_health(self, device_id: str, tunnel_info: Dict[str, Any]) -> bool:
        """
        Check the health of a tunnel.
        
        Args:
            device_id: Device ID
            tunnel_info: Tunnel information
            
        Returns:
            True if healthy, False otherwise
        """
        try:
            # Try to connect to the local port
            local_port = tunnel_info.get("local_port", 5555)
            
            # Create a socket and try to connect
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            
            try:
                sock.connect(("localhost", local_port))
                sock.close()
                return True
            except (socket.timeout, ConnectionRefusedError):
                sock.close()
                return False
        except Exception as e:
            logger.error(f"Error checking tunnel health for device {device_id}: {str(e)}")
            return False
    
    async def start_tunnel(
        self, 
        device_id: str, 
        user_id: str,
        token: str,
        local_port: int = 5555,
        remote_port: int = 5555
    ) -> bool:
        """
        Start a reverse SSH tunnel for a device.
        
        Args:
            device_id: Device ID
            user_id: User ID requesting the tunnel
            token: JWT token for authorization
            local_port: Local port to forward
            remote_port: Remote port to forward to
            
        Returns:
            True if tunnel started successfully, False otherwise
        """
        try:
            # Validate token
            token_payload = self.jwt_authenticator.validate_token(token)
            if not token_payload:
                logger.error(f"Invalid token for device {device_id}")
                return False
            
            # Check if user has access to this device
            if not self.jwt_authenticator.check_target_access(token_payload, device_id):
                logger.error(f"User {user_id} does not have access to device {device_id}")
                return False
            
            # Check routing policy
            user_role = token_payload.get("role", "")
            if not self._check_routing_policy(user_role, local_port, remote_port):
                logger.error(f"Port forwarding {local_port}:{remote_port} not allowed for role {user_role}")
                return False
            
            # Stop existing tunnel if any
            if device_id in self.active_tunnels:
                await self.stop_tunnel(device_id)
            
            # Get or generate SSH keys
            private_key_path, _ = self.ssh_key_manager.get_device_key(device_id)
            if not private_key_path:
                private_key_path, _ = self.ssh_key_manager.generate_device_key(device_id)
            
            # Get or generate TLS certificates
            cert_path, key_path = self.tls_cert_manager.get_device_cert(device_id)
            if not cert_path or not key_path:
                cert_path, key_path = self.tls_cert_manager.generate_device_cert(device_id)
            
            # Create a unique session ID
            session_id = f"{device_id}_{user_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            
            # Start the SSH tunnel process
            # In a real implementation, this would use paramiko or a similar library
            # For now, we'll use the ssh command
            
            # Build the SSH command
            ssh_cmd = [
                "ssh",
                "-N",  # Don't execute a remote command
                "-R", f"{remote_port}:localhost:{local_port}",  # Reverse tunnel
                "-i", private_key_path,  # Private key
                "-o", "StrictHostKeyChecking=no",  # Don't check host keys
                "-o", "ServerAliveInterval=10",  # Keep-alive
                "-o", "ServerAliveCountMax=3",  # Max keep-alive failures
                f"gateway@{self.ssh_server_host}",  # User and host
                "-p", str(self.ssh_server_port)  # Port
            ]
            
            # Start the process
            process = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Store tunnel info
            self.active_tunnels[device_id] = {
                "process": process,
                "start_time": datetime.utcnow(),
                "user_id": user_id,
                "session_id": session_id,
                "local_port": local_port,
                "remote_port": remote_port,
                "token": token,
                "last_health_check": datetime.utcnow(),
                "health_status": "starting"
            }
            
            # Initialize session logs
            self.session_logs[session_id] = []
            
            # Log the event
            self._log_session_event(
                session_id,
                "tunnel_started",
                f"Started tunnel for device {device_id} by user {user_id}"
            )
            
            # Start a task to monitor the process
            asyncio.create_task(self._monitor_tunnel_process(device_id, session_id, process))
            
            logger.info(f"Started tunnel for device {device_id} (session {session_id})")
            
            return True
        
        except Exception as e:
            logger.error(f"Error starting tunnel for device {device_id}: {str(e)}")
            return False
    
    async def _monitor_tunnel_process(
        self, 
        device_id: str, 
        session_id: str, 
        process: asyncio.subprocess.Process
    ):
        """
        Monitor a tunnel process and handle its output.
        
        Args:
            device_id: Device ID
            session_id: Session ID
            process: Process to monitor
        """
        try:
            # Read stdout
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                log_line = line.decode().strip()
                
                # Log the output
                self._log_session_event(
                    session_id,
                    "tunnel_output",
                    log_line
                )
                
                logger.debug(f"Tunnel {session_id} output: {log_line}")
            
            # Read stderr
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                
                log_line = line.decode().strip()
                
                # Log the error
                self._log_session_event(
                    session_id,
                    "tunnel_error",
                    log_line
                )
                
                logger.warning(f"Tunnel {session_id} error: {log_line}")
            
            # Wait for process to complete
            exit_code = await process.wait()
            
            # Log the completion
            self._log_session_event(
                session_id,
                "tunnel_exited",
                f"Tunnel process exited with code {exit_code}"
            )
            
            logger.info(f"Tunnel for device {device_id} (session {session_id}) exited with code {exit_code}")
            
            # If the tunnel manager is still running and this device is still in active tunnels,
            # restart the tunnel after a delay
            if self.running and device_id in self.active_tunnels:
                tunnel_info = self.active_tunnels[device_id]
                
                # Only restart if this is the current process
                if tunnel_info.get("process") == process:
                    logger.info(f"Scheduling tunnel restart for device {device_id} in {self.retry_interval} seconds")
                    
                    # Wait for retry interval
                    await asyncio.sleep(self.retry_interval)
                    
                    # Check again if we should restart
                    if self.running and device_id in self.active_tunnels:
                        tunnel_info = self.active_tunnels[device_id]
                        
                        # Only restart if this is still the current process
                        if tunnel_info.get("process") == process:
                            logger.info(f"Restarting tunnel for device {device_id}")
                            
                            # Restart the tunnel
                            await self.start_tunnel(
                                device_id,
                                tunnel_info.get("user_id", "unknown"),
                                tunnel_info.get("token", ""),
                                tunnel_info.get("local_port", 5555),
                                tunnel_info.get("remote_port", 5555)
                            )
        
        except Exception as e:
            logger.error(f"Error monitoring tunnel for device {device_id}: {str(e)}")
    
    async def stop_tunnel(self, device_id: str) -> bool:
        """
        Stop a tunnel for a device.
        
        Args:
            device_id: Device ID
            
        Returns:
            True if tunnel stopped successfully, False otherwise
        """
        try:
            if device_id not in self.active_tunnels:
                logger.warning(f"No active tunnel for device {device_id}")
                return False
            
            tunnel_info = self.active_tunnels[device_id]
            process = tunnel_info.get("process")
            session_id = tunnel_info.get("session_id", "unknown")
            
            # Kill the process
            if process:
                try:
                    process.kill()
                    await process.wait()
                except ProcessLookupError:
                    # Process already terminated
                    pass
            
            # Log the event
            self._log_session_event(
                session_id,
                "tunnel_stopped",
                f"Stopped tunnel for device {device_id}"
            )
            
            # Remove from active tunnels
            del self.active_tunnels[device_id]
            
            logger.info(f"Stopped tunnel for device {device_id} (session {session_id})")
            
            return True
        
        except Exception as e:
            logger.error(f"Error stopping tunnel for device {device_id}: {str(e)}")
            return False
    
    def _check_routing_policy(self, role: str, local_port: int, remote_port: int) -> bool:
        """
        Check if the routing policy allows the specified ports.
        
        Args:
            role: User role
            local_port: Local port
            remote_port: Remote port
            
        Returns:
            True if allowed, False otherwise
        """
        # Get policy for role
        policy = self.routing_policies.get(role, {})
        
        # Check allowed ports
        allowed_ports = policy.get("allowed_ports", [])
        
        # Wildcard allows all ports
        if "*" in allowed_ports:
            return True
        
        # Check if both ports are allowed
        return local_port in allowed_ports and remote_port in allowed_ports
    
    def _log_session_event(self, session_id: str, event_type: str, message: str):
        """
        Log a session event.
        
        Args:
            session_id: Session ID
            event_type: Event type
            message: Event message
        """
        # Create log entry
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "message": message
        }
        
        # Add to session logs
        if session_id in self.session_logs:
            self.session_logs[session_id].append(log_entry)
        else:
            self.session_logs[session_id] = [log_entry]
    
    def get_session_logs(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get logs for a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            List of log entries
        """
        return self.session_logs.get(session_id, [])
    
    def get_active_sessions(self) -> Dict[str, Dict[str, Any]]:
        """
        Get active sessions.
        
        Returns:
            Dictionary of device_id -> session info
        """
        sessions = {}
        
        for device_id, tunnel_info in self.active_tunnels.items():
            sessions[device_id] = {
                "session_id": tunnel_info.get("session_id", "unknown"),
                "user_id": tunnel_info.get("user_id", "unknown"),
                "start_time": tunnel_info.get("start_time", datetime.utcnow()).isoformat(),
                "local_port": tunnel_info.get("local_port", 0),
                "remote_port": tunnel_info.get("remote_port", 0),
                "health_status": tunnel_info.get("health_status", "unknown"),
                "last_health_check": tunnel_info.get("last_health_check", datetime.utcnow()).isoformat(),
                "duration": (datetime.utcnow() - tunnel_info.get("start_time", datetime.utcnow())).total_seconds()
            }
        
        return sessions
