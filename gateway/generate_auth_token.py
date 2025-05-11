#!/usr/bin/env python3
"""
Generate Authentication Token for Remote Access Agent

This script generates a JWT token that can be used as the AUTH_TOKEN
for the remote access agent. It reads the JWT_SECRET_KEY from the backend's
.env file and creates a token with the appropriate claims.

Usage:
  python generate_auth_token.py --device-id <device_id> --gateway-id <gateway_id>

Example:
  python generate_auth_token.py --device-id raspberry-pi-lab1 --gateway-id slc-gateway-main
"""

import os
import sys
import argparse
import jwt
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

def load_jwt_secret():
    """
    Load JWT_SECRET_KEY from the backend's .env file.
    
    Returns:
        str: The JWT secret key
    """
    # Try to find the backend .env file
    backend_dir = Path(__file__).parent.parent / "backend"
    env_path = backend_dir / ".env"
    
    if not env_path.exists():
        print(f"Error: Backend .env file not found at {env_path}")
        print("Please specify the JWT_SECRET_KEY manually.")
        secret_key = input("Enter JWT_SECRET_KEY: ")
        return secret_key
    
    # Load the .env file
    load_dotenv(env_path)
    
    # Get the JWT_SECRET_KEY
    secret_key = os.getenv("JWT_SECRET_KEY")
    if not secret_key:
        print("Error: JWT_SECRET_KEY not found in backend .env file")
        print("Please specify the JWT_SECRET_KEY manually.")
        secret_key = input("Enter JWT_SECRET_KEY: ")
    
    return secret_key

def generate_token(device_id, gateway_id, secret_key, expiry_days=365):
    """
    Generate a JWT token for the remote access agent.
    
    Args:
        device_id (str): The device ID
        gateway_id (str): The gateway ID
        secret_key (str): The JWT secret key
        expiry_days (int): Number of days until token expiry
    
    Returns:
        str: The JWT token
    """
    # Calculate expiry time
    expiry = datetime.utcnow() + timedelta(days=expiry_days)
    
    # Create the payload
    payload = {
        "device_id": device_id,
        "gateway_id": gateway_id,
        "exp": expiry,
        "iat": datetime.utcnow(),
        "type": "device_auth"
    }
    
    # Generate the token
    token = jwt.encode(payload, secret_key, algorithm="HS256")
    
    return token

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Generate Authentication Token for Remote Access Agent")
    parser.add_argument("--device-id", required=True, help="Device ID")
    parser.add_argument("--gateway-id", required=True, help="Gateway ID")
    parser.add_argument("--expiry", type=int, default=365, help="Token expiry in days (default: 365)")
    parser.add_argument("--secret", help="JWT secret key (if not specified, will be read from backend .env)")
    
    args = parser.parse_args()
    
    # Get the JWT secret key
    secret_key = args.secret if args.secret else load_jwt_secret()
    
    # Generate the token
    token = generate_token(args.device_id, args.gateway_id, secret_key, args.expiry)
    
    # Print the token
    print("\n=== Authentication Token ===")
    print(f"Device ID: {args.device_id}")
    print(f"Gateway ID: {args.gateway_id}")
    print(f"Expiry: {args.expiry} days")
    print("\nAUTH_TOKEN for .env file:")
    print(token)
    print("\nCopy this token to your .env file on the remote device.")
    print("Example:")
    print("AUTH_TOKEN=" + token)
    print("===============================\n")

if __name__ == "__main__":
    main()
