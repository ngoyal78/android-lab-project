#!/usr/bin/env python3
"""
Run a test on a target device through the Android Lab Platform server.
"""

import os
import sys
import argparse
import requests
import getpass
import json
import time
from datetime import datetime

def get_auth_token(server_url, username, password):
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

def submit_test_job(server_url, token, target_id, command, test_type, artifact_id=None):
    """Submit a test job to the server"""
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        data = {
            "target_id": target_id,
            "command": command,
            "test_type": test_type
        }
        
        if artifact_id:
            data["artifact_id"] = artifact_id
        
        print(f"Submitting test job to {server_url}/tests/...")
        response = requests.post(
            f"{server_url}/tests/",
            headers=headers,
            json=data
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Test job submitted successfully!")
            print(f"Job ID: {data['id']}")
            return data['id']
        else:
            print(f"Test job submission failed: {response.text}")
            return None
    except Exception as e:
        print(f"Test job submission error: {str(e)}")
        return None

def stream_test_logs(server_url, token, job_id):
    """Stream test logs from the server using WebSocket"""
    import asyncio
    import websockets
    
    async def connect_websocket():
        # Construct WebSocket URL
        ws_url = f"{server_url.replace('http://', 'ws://').replace('https://', 'wss://')}/tests/logs/{job_id}?token={token}"
        
        print(f"Connecting to test logs WebSocket...")
        
        try:
            async with websockets.connect(ws_url) as websocket:
                print(f"Connected to test logs for job {job_id}")
                print("Streaming logs (press Ctrl+C to stop)...")
                
                while True:
                    try:
                        message = await websocket.recv()
                        data = json.loads(message)
                        
                        if data["type"] == "output":
                            print(data["message"], end="")
                        elif data["type"] == "error":
                            print(f"\033[91m{data['message']}\033[0m", end="")
                        elif data["type"] == "system":
                            print(f"\033[94m{data['message']}\033[0m")
                            
                            # If job completed, exit
                            if "completed" in data["message"].lower() or "failed" in data["message"].lower():
                                return
                        else:
                            print(f"Unknown message type: {data}")
                    except websockets.exceptions.ConnectionClosed:
                        print("\nConnection closed by server")
                        break
                    except Exception as e:
                        print(f"\nError receiving message: {str(e)}")
                        break
        
        except websockets.exceptions.ConnectionRefusedError:
            print(f"Connection refused. Make sure the server is running and the job exists.")
        except Exception as e:
            print(f"Error: {str(e)}")
    
    # Run the async function
    asyncio.run(connect_websocket())

def get_test_status(server_url, token, job_id):
    """Get the status of a test job"""
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{server_url}/tests/{job_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            print(f"Failed to get test status: {response.text}")
            return None
    except Exception as e:
        print(f"Error getting test status: {str(e)}")
        return None

def wait_for_test_completion(server_url, token, job_id, poll_interval=5):
    """Wait for a test job to complete"""
    print(f"Waiting for test job {job_id} to complete...")
    
    while True:
        status_data = get_test_status(server_url, token, job_id)
        
        if not status_data:
            print("Failed to get test status. Exiting.")
            return False
        
        status = status_data.get("status")
        
        if status in ["COMPLETED", "FAILED", "ERROR", "CANCELLED"]:
            print(f"Test job {job_id} {status.lower()}")
            return status == "COMPLETED"
        
        print(f"Test job status: {status}")
        time.sleep(poll_interval)

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Run a test on a target device")
    parser.add_argument("--server", default="http://localhost:8000", help="Server URL")
    parser.add_argument("--target", required=True, type=int, help="Target device ID")
    parser.add_argument("--command", required=True, help="Test command to run")
    parser.add_argument("--type", default="CUSTOM", help="Test type (e.g., CUSTOM, INSTRUMENTATION, MONKEY)")
    parser.add_argument("--artifact", type=int, help="Artifact ID (optional)")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument("--no-stream", action="store_true", help="Don't stream logs, just wait for completion")
    
    args = parser.parse_args()
    
    # Get authentication credentials
    username = args.username or input("Username: ")
    password = args.password or getpass.getpass("Password: ")
    
    # Get authentication token
    token = get_auth_token(args.server, username, password)
    if not token:
        print("Failed to get authentication token. Exiting.")
        sys.exit(1)
    
    # Submit test job
    job_id = submit_test_job(args.server, token, args.target, args.command, args.type, args.artifact)
    if not job_id:
        print("Failed to submit test job. Exiting.")
        sys.exit(1)
    
    # Stream logs or wait for completion
    if args.no_stream:
        success = wait_for_test_completion(args.server, token, job_id)
        sys.exit(0 if success else 1)
    else:
        try:
            stream_test_logs(args.server, token, job_id)
        except KeyboardInterrupt:
            print("\nStopped streaming logs. Test job is still running.")
            print(f"You can check the status with: python run_test.py --server {args.server} --target {args.target} --command 'status' --job {job_id}")

if __name__ == "__main__":
    main()
