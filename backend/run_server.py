#!/usr/bin/env python3
"""
Run the Android Lab Platform backend server with proper import paths.
"""

import os
import sys
import uvicorn
from pathlib import Path

# Add the parent directory to the Python path
current_dir = Path(__file__).parent.absolute()
sys.path.append(str(current_dir.parent))

# Now run the server
if __name__ == "__main__":
    print("Starting Android Lab Platform API server...")
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
