#!/usr/bin/env python3
"""
Run the Android Lab Platform backend server.
"""

import os
import sys
import uvicorn
from dotenv import load_dotenv
import pathlib

# Add the current directory to the Python path
current_dir = pathlib.Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

# Load environment variables
load_dotenv()

# Get server settings from environment or use defaults
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

if __name__ == "__main__":
    print(f"Starting Android Lab Platform API server on {HOST}:{PORT}")
    print(f"Debug mode: {DEBUG}")
    print("API documentation available at http://localhost:8000/docs")
    
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG
    )
