#!/usr/bin/env python3
"""
Run the Android Lab Platform backend server directly.
"""

import os
import sys
from pathlib import Path

# Add the current directory to the Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

# Import the app from main.py
from main import app
import uvicorn

if __name__ == "__main__":
    print("Starting Android Lab Platform API server...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True
    )
