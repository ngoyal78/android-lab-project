# Remote Access Layer for Android Lab Platform

This directory contains the components for the secure remote access layer that enables remote connections to Android devices and Linux systems (like Raspberry Pi) through the SLC Gateway.

## Architecture Overview

The remote access system consists of the following components:

1. **Remote Access Agent**: Runs on target devices (Android or Linux) and establishes reverse SSH tunnels to the gateway
2. **SLC Gateway**: Validates connections, enforces security policies, and manages SSH tunnels
3. **Backend API**: Provides endpoints for device registration, session management, and health monitoring
4. **Frontend UI**: Allows users to initiate and terminate remote sessions with a single click

## Security Features

- **TLS Mutual Authentication**: Secure communication between agents and the gateway
- **JWT Token Authorization**: Validates device identity and permissions
- **SSH Key-based Authentication**: Secure tunnel establishment without password exchange
- **Role-based Access Control**: Enforces routing policies per target group and user role
- **Session Logging**: Captures user identity, timestamps, and actions for audit purposes

## Setting Up Android Devices

Android devices can be connected to the platform using the Android Debug Bridge (ADB) over a secure SSH tunnel.

### Prerequisites

- Android device with USB debugging enabled
- ADB installed on the gateway server

### Configuration

1. Connect the Android device to the gateway server via USB
2. Run the following command to start the agent:

```bash
python remote_access_agent.py --device-id "android-device-name" --local-port 5555
```

3. The agent will:
   - Generate SSH keys for the device
   - Register with the gateway
   - Establish a reverse SSH tunnel
   - Start periodic health checks

## Setting Up Raspberry Pi or Other Linux Devices

Raspberry Pi devices running Ubuntu LTS 24 (or other Linux distributions) can also be connected to the platform.

### Prerequisites

- Raspberry Pi running Ubuntu LTS 24 or other Linux distribution
- SSH server installed and running on the Raspberry Pi
- Network connectivity between the Raspberry Pi and the gateway server

### Configuration

1. Copy the necessary files to your Raspberry Pi:

```bash
scp gateway/remote_access_agent.py user@raspberry-pi:~/
scp gateway/raspberry-pi-example.env user@raspberry-pi:~/.env
```

2. SSH into your Raspberry Pi:

```bash
ssh user@raspberry-pi
```

3. Install the required dependencies:

```bash
sudo apt update
sudo apt install -y python3 python3-pip openssh-client
pip3 install requests python-dotenv pyjwt asyncio
```

4. Edit the .env file with your specific configuration:

```bash
nano .env
```

5. Run the agent:

```bash
python3 remote_access_agent.py
```

### Automated Setup

Alternatively, you can use the provided setup script:

1. Copy the setup script to your Raspberry Pi:

```bash
scp gateway/setup-raspberry-pi.sh user@raspberry-pi:~/
```

2. Copy the agent script to your Raspberry Pi:

```bash
scp gateway/remote_access_agent.py user@raspberry-pi:~/
```

3. SSH into your Raspberry Pi:

```bash
ssh user@raspberry-pi
```

4. Make the script executable and run it:

```bash
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

5. Follow the on-screen instructions to complete the setup.

## Generating Authentication Tokens

The remote access agent requires an authentication token (JWT) to securely communicate with the gateway. This token is generated using the JWT_SECRET_KEY from the backend's .env file.

### Using the Token Generator Script

We've provided a script to easily generate authentication tokens:

```bash
# Navigate to the gateway directory
cd gateway

# Generate a token for your device
python generate_auth_token.py --device-id raspberry-pi-ubuntu-lab1 --gateway-id slc-gateway-main
```

The script will:
1. Read the JWT_SECRET_KEY from the backend's .env file
2. Generate a JWT token with the specified device_id and gateway_id
3. Output the token for you to copy to your device's .env file

### Manual Token Generation

If you prefer to generate the token manually, you can use the following Python code:

```python
import jwt
from datetime import datetime, timedelta

# Get these values from your backend .env file and configuration
secret_key = "your-jwt-secret-key"  # JWT_SECRET_KEY from backend/.env
device_id = "raspberry-pi-ubuntu-lab1"
gateway_id = "slc-gateway-main"

# Create payload
payload = {
    "device_id": device_id,
    "gateway_id": gateway_id,
    "exp": datetime.utcnow() + timedelta(days=365),  # 1 year expiry
    "iat": datetime.utcnow(),
    "type": "device_auth"
}

# Generate token
token = jwt.encode(payload, secret_key, algorithm="HS256")
print(token)
```

## Example .env Configuration

Below is an example .env configuration file for a Raspberry Pi:

```
# Remote Access Agent Configuration
SERVER_URL=http://192.168.1.100:8000
GATEWAY_ID=slc-gateway-main
DEVICE_ID=raspberry-pi-ubuntu-lab1
AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VfaWQiOiJyYXNwYmVycnktcGktdWJ1bnR1LWxhYjEiLCJnYXRld2F5X2lkIjoic2xjLWdhdGV3YXktbWFpbiIsImV4cCI6MTcyMDAwMDAwMH0.example-token-signature
SSH_SERVER_HOST=192.168.1.100
SSH_SERVER_PORT=2222
LOCAL_PORT=22
REMOTE_PORT=auto
RETRY_INTERVAL=30
HEALTH_CHECK_INTERVAL=60
KEYS_DIR=keys
CERTS_DIR=certs
LOG_LEVEL=INFO
```

The AUTH_TOKEN is generated using the process described above.

## Using the Remote Access UI

1. Log in to the Android Lab Platform web interface
2. Navigate to the "Remote Access" section
3. You will see a list of available devices, including both Android devices and Raspberry Pi systems
4. Click "Start Session" on the device you want to connect to
5. Once the session is established, you will see connection information:
   - For Android devices: Use the provided ADB command to connect
   - For Raspberry Pi: Use the provided SSH command to connect
6. When finished, click "End Session" to terminate the connection

## Troubleshooting

### Agent Connection Issues

If the agent cannot connect to the gateway:

1. Check network connectivity between the device and the gateway
2. Verify that the SSH server is running on the gateway
3. Ensure the AUTH_TOKEN is valid and not expired
4. Check the agent logs for specific error messages:
   ```
   cat remote_access_agent.log
   ```

### SSH Tunnel Problems

If the SSH tunnel is established but not working:

1. Check if the local port is accessible on the device:
   ```
   nc -zv localhost <LOCAL_PORT>
   ```
2. Verify that the remote port is open on the gateway:
   ```
   nc -zv <SSH_SERVER_HOST> <REMOTE_PORT>
   ```
3. Check for firewall rules that might be blocking the connection

### Health Check Failures

If health checks are failing:

1. Ensure the service you're trying to expose is running on the device
2. Check if the local port is correctly configured
3. Verify that the health check interval is appropriate for your network conditions

## Advanced Configuration

### Custom SSH Options

You can customize the SSH tunnel options by modifying the `_start_ssh_tunnel` method in the `remote_access_agent.py` file.

### Multiple Services

To expose multiple services from a single device, you can run multiple instances of the agent with different local and remote ports.

### Auto-Recovery

The agent includes automatic retry and recovery mechanisms. You can adjust the retry intervals in the .env file:

```
RETRY_INTERVAL=30       # Seconds to wait before retrying a failed connection
HEALTH_CHECK_INTERVAL=60  # Seconds between health checks
```
