#!/usr/bin/env python3
"""
Test WebSocket connection to the Android Lab Platform server.
This script connects to the ADB shell or serial console WebSocket endpoint
and allows interactive communication.
"""

import asyncio
import json
import sys
import argparse
import websockets
import getpass
import requests
from datetime import datetime

async def get_auth_token(server_url, username, password):
    """Get authentication token from the server"""
    try:
        response = requests.post(
            f"{server_url}/auth/login/json",
            json={"username": username, "password": password}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data["access_token"]
        else:
            print(f"Authentication failed: {response.text}")
            return None
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        return None

async def connect_websocket(server_url, target_id, connection_type, token):
    """Connect to WebSocket and handle communication"""
    if connection_type not in ["adb", "serial"]:
        print("Connection type must be 'adb' or 'serial'")
        return
    
    # Construct WebSocket URL
    ws_url = f"{server_url.replace('http://', 'ws://').replace('https://', 'wss://')}/ws/{connection_type}/{target_id}"
    
    # Add token to URL if provided
    if token:
        ws_url += f"?token={token}"
    
    print(f"Connecting to {ws_url}...")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            print(f"Connected to {connection_type} console for target {target_id}")
            print("Type commands and press Enter to send. Press Ctrl+C to exit.")
            
            # Handle incoming messages
            async def receive_messages():
                while True:
                    try:
                        message = await websocket.recv()
                        data = json.loads(message)
                        
                        if data["type"] == "output":
                            print(data["message"], end="")
                        elif data["type"] == "error":
                            print(f"\033[91mERROR: {data['message']}\033[0m", end="")
                        elif data["type"] == "system":
                            print(f"\033[94mSYSTEM: {data['message']}\033[0m")
                        else:
                            print(f"Unknown message type: {data}")
                    except websockets.exceptions.ConnectionClosed:
                        print("\nConnection closed by server")
                        break
                    except Exception as e:
                        print(f"\nError receiving message: {str(e)}")
                        break
            
            # Start receiving messages in the background
            receive_task = asyncio.create_task(receive_messages())
            
            # Send commands from user input
            try:
                while True:
                    command = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
                    
                    if not command:
                        break
                    
                    await websocket.send(json.dumps({
                        "type": "command",
                        "message": command.strip()
                    }))
            except KeyboardInterrupt:
                print("\nExiting...")
            finally:
                receive_task.cancel()
    
    except websockets.exceptions.ConnectionRefusedError:
        print(f"Connection refused. Make sure the server is running and the target exists.")
    except Exception as e:
        print(f"Error: {str(e)}")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test WebSocket connection to Android Lab Platform")
    parser.add_argument("--server", default="http://localhost:8000", help="Server URL")
    parser.add_argument("--target", required=True, type=int, help="Target device ID")
    parser.add_argument("--type", choices=["adb", "serial"], default="adb", help="Connection type (adb or serial)")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--no-auth", action="store_true", help="Connect without authentication")
    
    args = parser.parse_args()
    
    # Get authentication token if needed
    token = None
    if not args.no_auth:
        username = args.username or input("Username: ")
        password = args.password or getpass.getpass("Password: ")
        
        token = asyncio.run(get_auth_token(args.server, username, password))
        if not token:
            print("Failed to get authentication token. Exiting.")
            sys.exit(1)
    
    # Connect to WebSocket
    asyncio.run(connect_websocket(args.server, args.target, args.type, token))

if __name__ == "__main__":
    main()
