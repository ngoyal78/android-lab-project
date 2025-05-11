#!/usr/bin/env python3
"""
Upload an APK file to the Android Lab Platform server.
"""

import os
import sys
import argparse
import requests
import getpass
import json
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

def upload_apk(server_url, apk_path, target_id, token):
    """Upload an APK file to the server"""
    if not os.path.exists(apk_path):
        print(f"Error: APK file not found: {apk_path}")
        return False
    
    try:
        # Prepare headers with authentication token
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        # Prepare form data
        form_data = {
            "artifact_type": "APK"
        }
        
        if target_id:
            form_data["target_id"] = target_id
        
        # Prepare file
        files = {
            "file": (os.path.basename(apk_path), open(apk_path, "rb"), "application/vnd.android.package-archive")
        }
        
        # Send request
        print(f"Uploading {apk_path} to {server_url}/artifacts/...")
        response = requests.post(
            f"{server_url}/artifacts/",
            headers=headers,
            data=form_data,
            files=files
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Upload successful!")
            print(f"Artifact ID: {data['id']}")
            print(f"Original filename: {data['original_filename']}")
            print(f"File size: {data['file_size']} bytes")
            print(f"Upload time: {data['created_at']}")
            return True
        else:
            print(f"Upload failed: {response.text}")
            return False
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return False

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Upload an APK file to Android Lab Platform")
    parser.add_argument("--server", default="http://localhost:8000", help="Server URL")
    parser.add_argument("--apk", required=True, help="Path to APK file")
    parser.add_argument("--target", type=int, help="Target device ID (optional)")
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    
    args = parser.parse_args()
    
    # Get authentication credentials
    username = args.username or input("Username: ")
    password = args.password or getpass.getpass("Password: ")
    
    # Get authentication token
    token = get_auth_token(args.server, username, password)
    if not token:
        print("Failed to get authentication token. Exiting.")
        sys.exit(1)
    
    # Upload APK
    if upload_apk(args.server, args.apk, args.target, token):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
