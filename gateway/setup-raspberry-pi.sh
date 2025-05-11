#!/bin/bash
# Setup script for Remote Access Agent on Raspberry Pi running Ubuntu

# Exit on error
set -e

echo "===== Android Lab Platform - Remote Access Agent Setup ====="
echo "This script will set up the Remote Access Agent on your Raspberry Pi."
echo

# Check if running on a Raspberry Pi with Ubuntu
if [ ! -f /etc/os-release ]; then
    echo "Error: Cannot detect operating system."
    exit 1
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" ]]; then
    echo "Warning: This script is designed for Ubuntu, but detected $PRETTY_NAME."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create directory for the agent
AGENT_DIR="$HOME/android-lab-agent"
mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

echo "Installing dependencies..."
sudo apt update
sudo apt install -y python3 python3-pip openssh-client

echo "Installing Python packages..."
pip3 install requests python-dotenv pyjwt asyncio

# Check for agent script
if [ ! -f "remote_access_agent.py" ]; then
    echo "Agent script not found. You need to copy the remote_access_agent.py file to $AGENT_DIR."
    echo "Please copy the script from your Android Lab Platform installation or repository."
    echo
    echo "For example:"
    echo "scp /path/to/android-lab-platform/gateway/remote_access_agent.py $USER@raspberry-pi:$AGENT_DIR/"
    echo
    read -p "Press Enter to continue setup without the agent script, or Ctrl+C to exit and copy the script first."
fi

# Create directories for keys and certificates
mkdir -p keys certs

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env configuration file..."
    cat > .env << EOF
# Remote Access Agent Configuration
# Generated on $(date)

# URL of the Android Lab Platform backend server
SERVER_URL=http://your-server-address:8000

# Gateway ID - identifies which gateway this device connects through
GATEWAY_ID=slc-gateway-main

# Device ID - unique identifier for this Raspberry Pi
DEVICE_ID=raspberry-pi-$(hostname)

# Authentication token (JWT)
# Generate this token from the Android Lab Platform web interface
AUTH_TOKEN=your-auth-token-here

# SSH Server Host - the hostname or IP of the SLC Gateway SSH server
SSH_SERVER_HOST=your-server-address

# SSH Server Port - the port on which the SLC Gateway SSH server listens
SSH_SERVER_PORT=2222

# Local Port - the port on the Raspberry Pi to be exposed (22 for SSH)
LOCAL_PORT=22

# Remote Port - the port on the gateway to forward to the local port
REMOTE_PORT=auto

# Retry interval in seconds
RETRY_INTERVAL=30

# Health check interval in seconds
HEALTH_CHECK_INTERVAL=60

# Directory for storing SSH keys
KEYS_DIR=keys

# Directory for storing TLS certificates
CERTS_DIR=certs

# Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL=INFO
EOF

    echo "Please edit the .env file with your specific configuration."
    echo "You can use 'nano .env' to edit the file."
else
    echo ".env file already exists, skipping creation."
fi

# Create systemd service file
echo "Creating systemd service file..."
cat > android-lab-agent.service << EOF
[Unit]
Description=Android Lab Platform Remote Access Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$AGENT_DIR
ExecStart=/usr/bin/python3 $AGENT_DIR/remote_access_agent.py
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=android-lab-agent

[Install]
WantedBy=multi-user.target
EOF

echo "Setting up systemd service..."
sudo mv android-lab-agent.service /etc/systemd/system/
sudo systemctl daemon-reload

echo
echo "===== Setup Complete ====="
echo
echo "To configure the agent:"
echo "1. Edit the .env file: nano $AGENT_DIR/.env"
echo "   Make sure to set SERVER_URL, GATEWAY_ID, DEVICE_ID, AUTH_TOKEN, and SSH_SERVER_HOST"
echo
echo "To generate an AUTH_TOKEN:"
echo "On your server machine, run:"
echo "   cd android-lab-platform/gateway"
echo "   python generate_auth_token.py --device-id $(hostname) --gateway-id slc-gateway-main"
echo
echo "Then copy the generated token to your .env file."
echo
echo "To start the agent:"
echo "sudo systemctl start android-lab-agent"
echo
echo "To enable automatic start on boot:"
echo "sudo systemctl enable android-lab-agent"
echo
echo "To check the agent status:"
echo "sudo systemctl status android-lab-agent"
echo
echo "To view logs:"
echo "sudo journalctl -u android-lab-agent -f"
echo
