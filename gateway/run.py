#!/usr/bin/env python3
"""
Run the Android Lab Platform gateway agent.
"""

import os
import sys
import argparse
from dotenv import load_dotenv

# Add the current directory to the path so we can import the agent module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent import main

if __name__ == "__main__":
    # Just call the main function from agent.py
    # All command line arguments will be passed through
    main()
