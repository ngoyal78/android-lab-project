# Android Lab Platform

A web utility like Wind River Studio Virtual Lab with an integrated SLC Gateway, designed to support remote Android development and testing workflows.

## Overview

The Android Lab Platform provides a centralized system for managing and accessing Android devices (both physical and virtual) for development and testing purposes. It enables teams to share limited hardware resources efficiently, schedule device access, and perform remote operations.

## Key Features

- **Secure Authentication**: User roles (Admin, Developer, Tester) with appropriate permissions
- **Target Inventory**: Registration and real-time status updates of Android devices
- **Reservation System**: Schedule and manage device access
- **Remote Access**: ADB shell and serial console over WebSockets
- **Artifact Management**: Upload and manage APKs and test scripts
- **Test Execution**: Run tests on selected targets with live log streaming
- **Collaboration**: Multi-user access with audit logging and notifications

## Architecture

The solution consists of three main components:

1. **Frontend**: React + TypeScript + Tailwind CSS web application
2. **Backend**: FastAPI (Python) REST API and WebSocket server
3. **Gateway Agent**: Lightweight Python agent that runs on systems with physical Android devices

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 16+
- Android SDK (for gateway agent)
- PostgreSQL (optional, SQLite is used by default)

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   # For Windows CMD/PowerShell:
   # venv\Scripts\activate
   # For Git Bash on Windows:
   source venv/Scripts/activate
   # For Linux/macOS:
   # source venv/bin/activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   
   # If you encounter a "No module named 'aiosqlite'" error, install it separately:
   pip install aiosqlite
   ```

4. Configure environment variables (or edit .env file):
   ```
   # Database
   DATABASE_URL=sqlite+aiosqlite:///./android_lab.db

   # JWT Authentication
   JWT_SECRET_KEY=your-secret-key
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   # Artifact Storage
   ARTIFACT_UPLOAD_DIR=uploads
   ```

5. Run the server:
   ```
   # Navigate to the backend directory
   cd backend
   
   # Run the server using the run.py script
   python run.py
   ```

6. Access the API documentation at http://localhost:8000/docs

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables (or edit .env file):
   ```
   REACT_APP_API_URL=http://localhost:8000
   ```

4. Start the development server:
   ```
   npm start
   ```

5. Access the web application at http://localhost:3000

### Gateway Agent Setup

1. Navigate to the gateway directory:
   ```
   cd gateway
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   # For Windows CMD/PowerShell:
   # venv\Scripts\activate
   # For Git Bash on Windows:
   source venv/Scripts/activate
   # For Linux/macOS:
   # source venv/bin/activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure environment variables (copy .env.example to .env and edit):
   ```
   # For Git Bash on Windows or Linux/macOS:
   cp .env.example .env
   # For Windows CMD:
   # copy .env.example .env
   
   # Edit .env file with your settings
   ```

5. Run the agent:
   ```
   python run.py
   ```
   
   Or with command line arguments:
   ```
   python run.py --server http://localhost:8000 --gateway-id my-gateway --username admin --password admin
   ```

#### Gateway Agent Features

The gateway agent provides the following features:

- **Device Discovery**: Automatically detects connected Android devices and emulators
- **Serial Port Discovery**: Identifies available serial ports for console access
- **ADB Shell Access**: Provides remote ADB shell access to connected devices
- **Serial Console Access**: Enables remote serial console access to connected devices
- **Test Execution**: Runs tests on connected devices and reports results
- **Real-time Updates**: Sends real-time device status updates to the server
- **Secure Communication**: Uses WebSockets for bidirectional communication

#### Testing the Gateway Agent

You can test the gateway agent's WebSocket connection using the provided test script:

```
cd tools
python test_gateway.py --url ws://localhost:8765 --gateway-id test-gateway
```

## API Documentation

The API documentation is available at http://localhost:8000/docs when the backend server is running.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
