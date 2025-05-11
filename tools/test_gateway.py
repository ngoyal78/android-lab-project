#!/usr/bin/env python3
"""
Test script for the Android Lab Platform Gateway Agent WebSocket connection.

This script connects to the gateway agent's WebSocket server and sends commands.
"""

import asyncio
import json
import sys
import argparse
import websockets
import uuid

async def connect_to_gateway(url: str, gateway_id: str = None):
    """
    Connect to the gateway agent's WebSocket server.
    
    Args:
        url: The WebSocket URL
        gateway_id: The gateway ID to use (optional)
    """
    try:
        async with websockets.connect(url) as websocket:
            # Generate a random gateway ID if not provided
            if not gateway_id:
                gateway_id = f"test-gateway-{uuid.uuid4().hex[:8]}"
            
            print(f"Connected to {url}")
            print(f"Using gateway ID: {gateway_id}")
            
            # Send initial message with gateway ID
            await websocket.send(json.dumps({
                "type": "init",
                "gateway_id": gateway_id
            }))
            
            # Receive welcome message
            response = await websocket.recv()
            print(f"Received: {response}")
            
            # Send heartbeat
            await websocket.send(json.dumps({
                "type": "heartbeat",
                "gateway_id": gateway_id
            }))
            
            # Receive heartbeat acknowledgement
            response = await websocket.recv()
            print(f"Received: {response}")
            
            # Send device update
            await websocket.send(json.dumps({
                "type": "device_update",
                "gateway_id": gateway_id,
                "devices": [
                    {
                        "name": "Test Device",
                        "serial_number": "test-device-1",
                        "gateway_id": gateway_id,
                        "device_type": "physical",
                        "adb_status": True,
                        "serial_status": False,
                        "manufacturer": "Test",
                        "model": "Test Model",
                        "android_version": "11",
                        "api_level": 30
                    }
                ],
                "serial_ports": [
                    {
                        "port": "COM1",
                        "description": "Test Serial Port",
                        "hardware_id": "USB\\VID_1234&PID_5678",
                        "manufacturer": "Test",
                        "gateway_id": gateway_id,
                        "status": "available"
                    }
                ]
            }))
            
            # Wait for user input
            print("\nEnter commands to send to the gateway agent (or 'exit' to quit):")
            print("Available commands:")
            print("  heartbeat - Send a heartbeat")
            print("  devices - Send a device update")
            print("  test_log - Send a test log")
            print("  test_completion - Send a test completion")
            print("  exit - Exit the script")
            
            while True:
                command = input("> ")
                
                if command == "exit":
                    break
                
                elif command == "heartbeat":
                    await websocket.send(json.dumps({
                        "type": "heartbeat",
                        "gateway_id": gateway_id
                    }))
                
                elif command == "devices":
                    await websocket.send(json.dumps({
                        "type": "device_update",
                        "gateway_id": gateway_id,
                        "devices": [
                            {
                                "name": "Test Device",
                                "serial_number": "test-device-1",
                                "gateway_id": gateway_id,
                                "device_type": "physical",
                                "adb_status": True,
                                "serial_status": False,
                                "manufacturer": "Test",
                                "model": "Test Model",
                                "android_version": "11",
                                "api_level": 30
                            }
                        ],
                        "serial_ports": [
                            {
                                "port": "COM1",
                                "description": "Test Serial Port",
                                "hardware_id": "USB\\VID_1234&PID_5678",
                                "manufacturer": "Test",
                                "gateway_id": gateway_id,
                                "status": "available"
                            }
                        ]
                    }))
                
                elif command == "test_log":
                    await websocket.send(json.dumps({
                        "type": "test_log",
                        "job_id": "test-job-1",
                        "log": "This is a test log message",
                        "is_error": False,
                        "timestamp": "2023-01-01T00:00:00Z"
                    }))
                
                elif command == "test_completion":
                    await websocket.send(json.dumps({
                        "type": "test_completion",
                        "job_id": "test-job-1",
                        "exit_code": 0,
                        "end_time": "2023-01-01T00:00:00Z"
                    }))
                
                else:
                    print(f"Unknown command: {command}")
                    continue
                
                # Receive response
                response = await websocket.recv()
                print(f"Received: {response}")
    
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Connection closed: {e}")
    except Exception as e:
        print(f"Error: {e}")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test the gateway agent WebSocket connection")
    parser.add_argument("--url", default="ws://localhost:8765", help="WebSocket URL")
    parser.add_argument("--gateway-id", help="Gateway ID")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(connect_to_gateway(args.url, args.gateway_id))
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
