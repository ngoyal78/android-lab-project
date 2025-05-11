# Android Lab Platform

A comprehensive platform for managing and accessing Android devices and Linux systems remotely, designed to support development and testing workflows.

## Overview

The Android Lab Platform provides a centralized system for managing and accessing Android devices (both physical and virtual) and Linux systems like Raspberry Pi for development and testing purposes. It enables teams to share limited hardware resources efficiently, schedule device access, and perform remote operations securely.

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation Guide](#installation-guide)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Gateway Setup](#gateway-setup)
- [User Guide](#user-guide)
  - [User Management](#user-management)
  - [Target Management](#target-management)
  - [Remote Access](#remote-access)
  - [Test Execution](#test-execution)
  - [Artifact Management](#artifact-management)
- [Device Setup](#device-setup)
  - [Android Devices](#android-devices)
  - [Raspberry Pi / Linux Devices](#raspberry-pi--linux-devices)
- [Troubleshooting](#troubleshooting)
- [API Documentation](#api-documentation)
- [License](#license)

## Key Features

- **Secure Authentication**: User roles (Admin, Developer, Tester) with appropriate permissions
- **Target Inventory**: Registration and real-time status updates of Android and Linux devices
- **Reservation System**: Schedule and manage device access
- **Remote Access**: Secure SSH tunnels with TLS mutual authentication for Android ADB and Linux SSH access
- **Artifact Management**: Upload and manage APKs and test scripts
- **Test Execution**: Run tests on selected targets with live log streaming
- **Collaboration**: Multi-user access with audit logging and notifications

## Architecture

The solution consists of four main components:

1. **Frontend**: React + TypeScript + Tailwind CSS web application
2. **Backend**: FastAPI (Python) REST API and WebSocket server
3. **SLC Gateway**: Manages SSH tunnels and enforces security policies ([Learn more about SLC Gateway](gateway/SLC-GATEWAY.md) | [Deployment Models](gateway/GATEWAY-DEPLOYMENT-MODELS.md))
4. **Remote Access Agents**: Run on target devices to establish secure connections

## Installation Guide

### Prerequisites

- Python 3.9+
- Node.js 16+
- Android SDK (for Android device support)
- PostgreSQL (optional, SQLite is used by default)
- SSH server (for remote access functionality)

### Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/android-lab-platform.git
   cd android-lab-platform
   ```

2. **Set up the backend**:
   ```bash
   cd backend
   
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   ```bash
   # Copy example .env file
   cp .env.example .env
   
   # Edit .env file with your settings
   # Important: Set a strong JWT_SECRET_KEY for security
   nano .env
   ```

   Example .env configuration:
   ```
   # Database
   DATABASE_URL=sqlite+aiosqlite:///./android_lab.db

   # JWT Authentication
   JWT_SECRET_KEY=your-secure-secret-key-change-this
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   # Artifact Storage
   ARTIFACT_UPLOAD_DIR=uploads
   
   # Server
   HOST=0.0.0.0
   PORT=8000
   DEBUG=true
   ```

4. **Initialize the database**:
   ```bash
   python init_db.py
   ```

5. **Start the backend server**:
   ```bash
   python run.py
   ```

### Frontend Setup

1. **Set up the frontend**:
   ```bash
   cd frontend
   
   # Install dependencies
   npm install
   ```

2. **Configure environment**:
   ```bash
   # Create .env file
   echo "REACT_APP_API_URL=http://localhost:8000" > .env
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Access the web application** at http://localhost:3000

### Gateway Setup

1. **Set up the gateway**:
   ```bash
   cd gateway
   
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   # Copy example .env file
   cp .env.example .env
   
   # Edit .env file with your settings
   nano .env
   ```

3. **Start the gateway**:
   ```bash
   python run.py
   ```

## User Guide

### User Management

1. **Default credentials**:
   - Username: `admin`
   - Password: `admin123`

2. **User roles**:
   - **Admin**: Full access to all features
   - **Developer**: Can manage targets, run tests, and access devices
   - **Tester**: Can run tests and access devices

3. **Adding users**:
   - Log in as an admin
   - Navigate to "Users" section
   - Click "Add User"
   - Fill in the details and select a role
   - Click "Save"

### Target Management

1. **Adding a target**:
   - Navigate to "Targets" section
   - Click "Add Target"
   - Fill in the details (name, type, etc.)
   - Click "Save"

2. **Viewing target status**:
   - Navigate to "Targets" section
   - The status indicator shows if the target is online/offline
   - Click on a target to view detailed information

3. **Reserving a target**:
   - Navigate to "Targets" section
   - Click on a target
   - Click "Reserve"
   - Select time slot and purpose
   - Click "Confirm Reservation"

### Remote Access

1. **Accessing the Remote Access feature**:
   - Navigate to "Remote Access" section
   - You'll see a list of available devices

2. **Starting a remote session**:
   - Find the device you want to connect to
   - Click "Start Session"
   - Wait for the connection to be established
   - Use the provided connection information:
     - For Android: Use the ADB command shown
     - For Raspberry Pi: Use the SSH command shown

3. **Ending a remote session**:
   - Click "End Session" when you're done
   - The connection will be terminated

### Test Execution

1. **Creating a test job**:
   - Navigate to "Tests" section
   - Click "New Test Job"
   - Select target device
   - Upload test artifacts or select existing ones
   - Configure test parameters
   - Click "Run Test"

2. **Monitoring test execution**:
   - View real-time logs in the test console
   - Check test status and progress

3. **Viewing test results**:
   - Navigate to "Tests" section
   - Click on a completed test job
   - View test results, logs, and artifacts

### Artifact Management

1. **Uploading artifacts**:
   - Navigate to "Artifacts" section
   - Click "Upload Artifact"
   - Select file and provide description
   - Click "Upload"

2. **Managing artifacts**:
   - View list of artifacts
   - Download, delete, or use in tests

## Device Setup

### Android Devices

1. **Prerequisites**:
   - Android device with USB debugging enabled
   - ADB installed on the gateway server

2. **Setting up the Remote Access Agent**:
   ```bash
   cd gateway
   
   # Generate an authentication token
   python generate_auth_token.py --device-id "android-device-name" --gateway-id "slc-gateway-main"
   
   # Start the agent
   python remote_access_agent.py --device-id "android-device-name" --local-port 5555 --auth-token "your-generated-token"
   ```

3. **Verifying the connection**:
   - Check the device appears in the "Remote Access" section of the web UI
   - Verify the status shows as "connected"

### Raspberry Pi / Linux Devices

1. **Prerequisites**:
   - Raspberry Pi running Ubuntu LTS 24 or other Linux distribution
   - SSH server installed and running

2. **Automated setup**:
   ```bash
   # On your server, copy the setup files to the Raspberry Pi
   scp gateway/setup-raspberry-pi.sh gateway/remote_access_agent.py user@raspberry-pi:~/
   
   # SSH into the Raspberry Pi
   ssh user@raspberry-pi
   
   # Run the setup script
   chmod +x setup-raspberry-pi.sh
   ./setup-raspberry-pi.sh
   ```

3. **Generate authentication token**:
   ```bash
   # On your server
   cd gateway
   python generate_auth_token.py --device-id "raspberry-pi-ubuntu" --gateway-id "slc-gateway-main"
   ```

4. **Configure the agent**:
   ```bash
   # On the Raspberry Pi
   cd ~/android-lab-agent
   nano .env
   
   # Update the following settings:
   # SERVER_URL=http://your-server-address:8000
   # GATEWAY_ID=slc-gateway-main
   # AUTH_TOKEN=your-generated-token
   # SSH_SERVER_HOST=your-server-address
   ```

5. **Start the agent**:
   ```bash
   # Start the service
   sudo systemctl start android-lab-agent
   
   # Enable autostart on boot
   sudo systemctl enable android-lab-agent
   ```

6. **Verifying the connection**:
   - Check the device appears in the "Remote Access" section of the web UI
   - Verify the status shows as "connected"

## Troubleshooting

### Backend Issues

1. **Database errors**:
   - Check database connection string in .env file
   - Ensure database file is writable
   - Try reinitializing the database: `python init_db.py`

2. **JWT authentication errors**:
   - Verify JWT_SECRET_KEY is set correctly
   - Check token expiration time

### Frontend Issues

1. **API connection errors**:
   - Verify REACT_APP_API_URL is set correctly
   - Check if backend server is running
   - Check for CORS issues in browser console

### Gateway Issues

1. **Connection problems**:
   - Verify network connectivity between gateway and server
   - Check authentication credentials
   - Ensure WebSocket server is running

### Remote Access Issues

1. **Agent connection failures**:
   - Check network connectivity
   - Verify AUTH_TOKEN is valid
   - Check agent logs: `cat remote_access_agent.log`

2. **SSH tunnel problems**:
   - Verify SSH server is running
   - Check if ports are blocked by firewall
   - Test local port accessibility: `nc -zv localhost <LOCAL_PORT>`

3. **Authentication errors**:
   - Regenerate the authentication token
   - Verify the token is correctly copied to the .env file

## API Documentation

The API documentation is available at http://localhost:8000/docs when the backend server is running. This interactive documentation allows you to:

- View all available endpoints
- Test API calls directly from the browser
- See request and response schemas
- Authenticate using JWT tokens

## License

This project is licensed under the MIT License - see the LICENSE file for details.
