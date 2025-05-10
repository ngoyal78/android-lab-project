# Android Lab Platform

A web utility designed to support remote Android development and testing workflows.

## Project Overview

The Android Lab Platform consists of:

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) with REST APIs and WebSocket support
- **Gateway Agent**: A lightweight agent running on Linux or Windows systems managing physical Android targets

## Key Features

- Secure authentication with user roles (Admin, Developer, Tester)
- Target inventory registration and status updates from the gateway agent
- Real-time target reservation and access control
- Remote ADB shell and serial console over WebSockets
- File upload of APKs and test scripts
- Test execution on selected targets with live log streaming
- Audit logging, notifications, and multi-user collaboration

## Project Structure

```
android-lab-platform/
├── frontend/           # React + TypeScript + Tailwind CSS frontend
├── backend/            # FastAPI Python backend
└── gateway/            # Gateway agent for managing physical devices
```

## Getting Started

### Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

### Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create and activate a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```
   uvicorn main:app --reload
   ```

### Gateway Agent

1. Navigate to the gateway directory:
   ```
   cd gateway
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Start the gateway agent:
   ```
   python gateway.py
   ```

## User Roles

- **Admin**: Full access to all features
- **Developer**: Can reserve targets, run tests, and use ADB console
- **Tester**: Can run tests on available targets

## License

[MIT License](LICENSE)
