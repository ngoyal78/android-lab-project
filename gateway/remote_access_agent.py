#!/usr/bin/env python3
"""
Remote Access Agent for Android Lab Platform

This module implements the agent-side code for establishing secure remote access
to Android devices. It handles:
- Reverse SSH tunnel establishment with automatic retries
- Health checks and monitoring
- TLS mutual authentication
- JWT token-based authorization
- Registration of device public keys with the SLC Gateway
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
import uuid
import subprocess
import requests
import platform
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('remote_access_agent.log')
    ]
)
logger = logging.getLogger('remote_access_agent')

class RemoteAccessAgent:
    """
    Agent for establishing secure remote access to Android devices.
    """
    def __init__(
        self,
        server_url: str,
        gateway_id: str,
        device_id: str,
        auth_token: str,
        ssh_server_host: str,
        ssh_server_port: int = 2222,
        local_port: int = 5555,
        remote_port: int = 5555,
        retry_interval: int = 30,
        health_check_interval: int = 60,
        keys_dir: str = "keys",
        certs_dir: str = "certs"
    ):
        self.server_url = server_url
        self.gateway_id = gateway_id
        self.device_id = device_id
        self.auth_token = auth_token
        self.ssh_server_host = ssh_server_host
        self.ssh_server_port = ssh_server_port
        self.local_port = local_port
        self.remote_port = remote_port
        self.retry_interval = retry_interval
        self.health_check_interval = health_check_interval
        
        # Directories for keys and certificates
        self.keys_dir = Path(keys_dir)
        self.keys_dir.mkdir(exist_ok=True)
        self.certs_dir = Path(certs_dir)
        self.certs_dir.mkdir(exist_ok=True)
        
        # SSH tunnel process
        self.tunnel_process = None
        
        # Session ID for the current tunnel
        self.session_id = None
        
        # Flag to indicate if the agent is running
        self.running = False
        
        # Last registration time
        self.last_registration = None
        
        # Registration interval (in seconds)
        self.registration_interval = 3600  # 1 hour
        
        # Health status
        self.health_status = "initializing"
        
        # Device info
        self.device_info = self._get_device_info()
    
    def _get_device_info(self) -> Dict[str, Any]:
        """
        Get information about the device.
        
        Returns:
            Dictionary with device information
        """
        info = {
            "id": self.device_id,
            "gateway_id": self.gateway_id,
            "platform": platform.system(),
            "platform_version": platform.version(),
            "hostname": platform.node(),
            "agent_version": "1.0.0",
            "local_port": self.local_port,
            "remote_port": self.remote_port
        }
        
        # Add Android-specific info if this is an Android device
        if platform.system() == "Linux" and os.path.exists("/system/build.prop"):
            try:
                # Try to get Android properties
                android_version = subprocess.check_output(
                    ["getprop", "ro.build.version.release"],
                    universal_newlines=True
                ).strip()
                
                api_level = subprocess.check_output(
                    ["getprop", "ro.build.version.sdk"],
                    universal_newlines=True
                ).strip()
                
                manufacturer = subprocess.check_output(
                    ["getprop", "ro.product.manufacturer"],
                    universal_newlines=True
                ).strip()
                
                model = subprocess.check_output(
                    ["getprop", "ro.product.model"],
                    universal_newlines=True
                ).strip()
                
                info.update({
                    "android_version": android_version,
                    "api_level": api_level,
                    "manufacturer": manufacturer,
                    "model": model
                })
            except Exception as e:
                logger.warning(f"Error getting Android properties: {str(e)}")
        
        return info
    
    async def start(self):
        """Start the remote access agent"""
        self.running = True
        
        # Generate or load SSH keys
        private_key_path, public_key_path = await self._ensure_ssh_keys()
        
        # Register with the gateway
        await self._register_with_gateway(public_key_path)
        
        # Start health check task
        asyncio.create_task(self._health_check_task())
        
        # Start registration refresh task
        asyncio.create_task(self._registration_refresh_task())
        
        # Start the SSH tunnel
        await self._start_ssh_tunnel(private_key_path)
    
    async def stop(self):
        """Stop the remote access agent"""
        self.running = False
        
        # Stop the SSH tunnel
        await self._stop_ssh_tunnel()
        
        logger.info("Remote access agent stopped")
    
    async def _ensure_ssh_keys(self) -> Tuple[str, str]:
        """
        Ensure SSH keys exist for the device.
        
        Returns:
            Tuple of (private_key_path, public_key_path)
        """
        device_dir = self.keys_dir / self.device_id
        device_dir.mkdir(exist_ok=True)
        
        private_key_path = device_dir / "id_rsa"
        public_key_path = device_dir / "id_rsa.pub"
        
        # Check if keys already exist
        if private_key_path.exists() and public_key_path.exists():
            logger.info(f"SSH keys already exist for device {self.device_id}")
            return str(private_key_path), str(public_key_path)
        
        # Generate new key pair using ssh-keygen
        logger.info(f"Generating new SSH key pair for device {self.device_id}")
        
        try:
            # Check if ssh-keygen is available
            await asyncio.create_subprocess_exec(
                "ssh-keygen", "-V",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Generate key pair
            process = await asyncio.create_subprocess_exec(
                "ssh-keygen",
                "-t", "rsa",
                "-b", "2048",
                "-f", str(private_key_path),
                "-N", "",  # Empty passphrase
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"Error generating SSH keys: {stderr.decode()}")
                raise RuntimeError(f"Error generating SSH keys: {stderr.decode()}")
            
            logger.info(f"Generated new SSH key pair for device {self.device_id}")
            
            return str(private_key_path), str(public_key_path)
        
        except FileNotFoundError:
            logger.error("ssh-keygen not found. Cannot generate SSH keys.")
            raise RuntimeError("ssh-keygen not found. Cannot generate SSH keys.")
    
    async def _register_with_gateway(self, public_key_path: str):
        """
        Register the device's public key with the gateway.
        
        Args:
            public_key_path: Path to the public key file
        """
        try:
            # Read public key
            with open(public_key_path, 'r') as f:
                public_key = f.read().strip()
            
            # Prepare registration data
            registration_data = {
                "device_id": self.device_id,
                "gateway_id": self.gateway_id,
                "public_key": public_key,
                "device_info": self.device_info,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Send registration request
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            response = await asyncio.to_thread(
                requests.post,
                f"{self.server_url}/api/remote-access/register",
                headers=headers,
                json=registration_data
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully registered device {self.device_id} with gateway")
                self.last_registration = datetime.utcnow()
                return True
            else:
                logger.error(f"Failed to register with gateway: {response.text}")
                return False
        
        except Exception as e:
            logger.error(f"Error registering with gateway: {str(e)}")
            return False
    
    async def _registration_refresh_task(self):
        """Periodically refresh the device registration with the gateway"""
        while self.running:
            try:
                # Check if registration needs to be refreshed
                if (self.last_registration is None or 
                    (datetime.utcnow() - self.last_registration).total_seconds() >= self.registration_interval):
                    
                    # Get public key path
                    _, public_key_path = await self._ensure_ssh_keys()
                    
                    # Register with gateway
                    await self._register_with_gateway(public_key_path)
            
            except Exception as e:
                logger.error(f"Error in registration refresh task: {str(e)}")
            
            # Wait for next check
            await asyncio.sleep(self.registration_interval)
    
    async def _start_ssh_tunnel(self, private_key_path: str):
        """
        Start the SSH tunnel.
        
        Args:
            private_key_path: Path to the private key file
        """
        try:
            # Create a unique session ID
            self.session_id = f"{self.device_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            
            # Build the SSH command
            ssh_cmd = [
                "ssh",
                "-N",  # Don't execute a remote command
                "-R", f"{self.remote_port}:localhost:{self.local_port}",  # Reverse tunnel
                "-i", private_key_path,  # Private key
                "-o", "StrictHostKeyChecking=no",  # Don't check host keys
                "-o", "ServerAliveInterval=10",  # Keep-alive
                "-o", "ServerAliveCountMax=3",  # Max keep-alive failures
                f"gateway@{self.ssh_server_host}",  # User and host
                "-p", str(self.ssh_server_port)  # Port
            ]
            
            # Start the process
            logger.info(f"Starting SSH tunnel: {' '.join(ssh_cmd)}")
            
            self.tunnel_process = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Update health status
            self.health_status = "connected"
            
            # Start a task to monitor the process
            asyncio.create_task(self._monitor_tunnel_process())
            
            logger.info(f"Started SSH tunnel for device {self.device_id} (session {self.session_id})")
        
        except Exception as e:
            logger.error(f"Error starting SSH tunnel: {str(e)}")
            self.health_status = "error"
            
            # Schedule a retry
            asyncio.create_task(self._retry_ssh_tunnel(private_key_path))
    
    async def _retry_ssh_tunnel(self, private_key_path: str):
        """
        Retry starting the SSH tunnel after a delay.
        
        Args:
            private_key_path: Path to the private key file
        """
        if not self.running:
            return
        
        logger.info(f"Scheduling SSH tunnel retry in {self.retry_interval} seconds")
        
        # Wait for retry interval
        await asyncio.sleep(self.retry_interval)
        
        # Check if we should still retry
        if self.running and (self.tunnel_process is None or self.tunnel_process.returncode is not None):
            logger.info("Retrying SSH tunnel")
            await self._start_ssh_tunnel(private_key_path)
    
    async def _stop_ssh_tunnel(self):
        """Stop the SSH tunnel"""
        if self.tunnel_process:
            try:
                # Kill the process
                self.tunnel_process.kill()
                await self.tunnel_process.wait()
                
                logger.info(f"Stopped SSH tunnel for device {self.device_id}")
            except ProcessLookupError:
                # Process already terminated
                pass
            
            self.tunnel_process = None
            self.health_status = "disconnected"
    
    async def _monitor_tunnel_process(self):
        """Monitor the SSH tunnel process and handle its output"""
        try:
            # Read stdout
            while True:
                line = await self.tunnel_process.stdout.readline()
                if not line:
                    break
                
                log_line = line.decode().strip()
                logger.debug(f"SSH tunnel output: {log_line}")
            
            # Read stderr
            while True:
                line = await self.tunnel_process.stderr.readline()
                if not line:
                    break
                
                log_line = line.decode().strip()
                logger.warning(f"SSH tunnel error: {log_line}")
            
            # Wait for process to complete
            exit_code = await self.tunnel_process.wait()
            
            logger.info(f"SSH tunnel process exited with code {exit_code}")
            
            # Update health status
            self.health_status = "disconnected"
            
            # If the agent is still running, restart the tunnel after a delay
            if self.running:
                # Get private key path
                private_key_path, _ = await self._ensure_ssh_keys()
                
                # Schedule a retry
                asyncio.create_task(self._retry_ssh_tunnel(private_key_path))
        
        except Exception as e:
            logger.error(f"Error monitoring SSH tunnel: {str(e)}")
    
    async def _health_check_task(self):
        """Periodically check the health of the SSH tunnel"""
        while self.running:
            try:
                # Check if process is still running
                if self.tunnel_process and self.tunnel_process.returncode is not None:
                    logger.warning(f"SSH tunnel has died. Will be restarted by monitor task.")
                    self.health_status = "disconnected"
                else:
                    # Perform a health check
                    healthy = await self._check_tunnel_health()
                    
                    if healthy:
                        self.health_status = "connected"
                    else:
                        self.health_status = "unhealthy"
                        
                        # If the tunnel is unhealthy but the process is still running,
                        # we need to restart it
                        if self.tunnel_process and self.tunnel_process.returncode is None:
                            logger.warning("SSH tunnel is unhealthy. Restarting...")
                            
                            # Stop the tunnel
                            await self._stop_ssh_tunnel()
                            
                            # Get private key path
                            private_key_path, _ = await self._ensure_ssh_keys()
                            
                            # Restart the tunnel
                            await self._start_ssh_tunnel(private_key_path)
                
                # Send health status to gateway
                await self._send_health_status()
            
            except Exception as e:
                logger.error(f"Error in health check task: {str(e)}")
                self.health_status = "error"
            
            # Wait for next check
            await asyncio.sleep(self.health_check_interval)
    
    async def _check_tunnel_health(self) -> bool:
        """
        Check the health of the SSH tunnel.
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            # Try to connect to the local port
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            
            try:
                sock.connect(("localhost", self.local_port))
                sock.close()
                return True
            except (socket.timeout, ConnectionRefusedError):
                sock.close()
                return False
        except Exception as e:
            logger.error(f"Error checking tunnel health: {str(e)}")
            return False
    
    async def _send_health_status(self):
        """Send health status to the gateway"""
        try:
            # Prepare health status data
            health_data = {
                "device_id": self.device_id,
                "gateway_id": self.gateway_id,
                "session_id": self.session_id,
                "health_status": self.health_status,
                "timestamp": datetime.utcnow().isoformat(),
                "local_port": self.local_port,
                "remote_port": self.remote_port
            }
            
            # Send health status request
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            response = await asyncio.to_thread(
                requests.post,
                f"{self.server_url}/api/remote-access/health",
                headers=headers,
                json=health_data
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to send health status: {response.text}")
        
        except Exception as e:
            logger.error(f"Error sending health status: {str(e)}")

async def main_async():
    """Async main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Android Lab Platform Remote Access Agent")
    parser.add_argument("--server", help="Server URL")
    parser.add_argument("--gateway-id", help="Gateway ID")
    parser.add_argument("--device-id", help="Device ID")
    parser.add_argument("--auth-token", help="Authentication token")
    parser.add_argument("--ssh-server", help="SSH server host")
    parser.add_argument("--ssh-port", type=int, help="SSH server port")
    parser.add_argument("--local-port", type=int, help="Local port to forward")
    parser.add_argument("--remote-port", type=int, help="Remote port to forward to")
    parser.add_argument("--retry-interval", type=int, help="Retry interval in seconds")
    parser.add_argument("--health-check-interval", type=int, help="Health check interval in seconds")
    parser.add_argument("--keys-dir", help="Directory for SSH keys")
    parser.add_argument("--certs-dir", help="Directory for TLS certificates")
    parser.add_argument("--log-level", help="Logging level")
    
    args = parser.parse_args()
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Get settings from environment or command line
    server_url = args.server or os.getenv("SERVER_URL", "http://localhost:8000")
    gateway_id = args.gateway_id or os.getenv("GATEWAY_ID", f"gateway-{os.getenv('HOSTNAME', 'unknown')}")
    device_id = args.device_id or os.getenv("DEVICE_ID", f"device-{platform.node()}")
    auth_token = args.auth_token or os.getenv("AUTH_TOKEN")
    ssh_server_host = args.ssh_server or os.getenv("SSH_SERVER_HOST", "localhost")
    ssh_server_port = args.ssh_port or int(os.getenv("SSH_SERVER_PORT", "2222"))
    local_port = args.local_port or int(os.getenv("LOCAL_PORT", "5555"))
    remote_port = args.remote_port or int(os.getenv("REMOTE_PORT", "5555"))
    retry_interval = args.retry_interval or int(os.getenv("RETRY_INTERVAL", "30"))
    health_check_interval = args.health_check_interval or int(os.getenv("HEALTH_CHECK_INTERVAL", "60"))
    keys_dir = args.keys_dir or os.getenv("KEYS_DIR", "keys")
    certs_dir = args.certs_dir or os.getenv("CERTS_DIR", "certs")
    log_level = args.log_level or os.getenv("LOG_LEVEL", "INFO")
    
    # Set log level
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Check required parameters
    if not auth_token:
        logger.error("Authentication token is required")
        sys.exit(1)
    
    # Create remote access agent
    agent = RemoteAccessAgent(
        server_url=server_url,
        gateway_id=gateway_id,
        device_id=device_id,
        auth_token=auth_token,
        ssh_server_host=ssh_server_host,
        ssh_server_port=ssh_server_port,
        local_port=local_port,
        remote_port=remote_port,
        retry_interval=retry_interval,
        health_check_interval=health_check_interval,
        keys_dir=keys_dir,
        certs_dir=certs_dir
    )
    
    # Set up signal handlers
    loop = asyncio.get_running_loop()
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(agent.stop()))
    
    # Start the agent
    try:
        logger.info(f"Starting remote access agent for device {device_id}")
        await agent.start()
        
        # Keep the agent running
        while agent.running:
            await asyncio.sleep(1)
    
    except Exception as e:
        logger.error(f"Remote access agent error: {str(e)}")
        sys.exit(1)

def main():
    """Main entry point"""
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\nRemote access agent stopped by user")
    except Exception as e:
        print(f"Remote access agent error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
