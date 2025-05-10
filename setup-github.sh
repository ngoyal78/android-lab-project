#!/bin/bash

# Script to set up GitHub repository for Android Lab Platform

echo "===== Android Lab Platform GitHub Setup ====="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Error: Git is not installed. Please install Git first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "Error: This script must be run from the android-lab-platform root directory."
    echo "Current directory: $(pwd)"
    exit 1
fi

# Check if git is already initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    echo "Git repository initialized."
else
    echo "Git repository already initialized."
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "Creating .gitignore file..."
    cat > .gitignore << EOL
# Dependencies
node_modules/
venv/
__pycache__/
*.py[cod]
*$py.class
.env

# Build outputs
/build
/dist
*.egg-info/

# IDE and editor files
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
/coverage
.pytest_cache/
.coverage
htmlcov/

# Production
/frontend/build

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local
EOL
    echo ".gitignore file created."
fi

# Add all files to git
echo "Adding files to Git..."
git add .
echo "Files added to Git."

# Commit changes
echo "Committing changes..."
git commit -m "Initial commit: Android Lab Platform project setup"
echo "Changes committed."

# Prompt for GitHub repository setup
echo ""
echo "===== GitHub Repository Setup ====="
echo ""
echo "To connect this repository to GitHub:"
echo ""
echo "1. Create a new repository on GitHub:"
echo "   - Go to https://github.com/new"
echo "   - Enter 'android-lab-platform' as the repository name"
echo "   - Add a description (optional)"
echo "   - Choose visibility (public or private)"
echo "   - Do NOT initialize with README, .gitignore, or license"
echo "   - Click 'Create repository'"
echo ""
echo "2. Connect your local repository to GitHub:"
echo "   Run the following commands:"
echo ""
echo "   git remote add origin https://github.com/ngoyal78/android-lab-platform.git"
echo "   git push -u origin main"
echo ""
echo "===== Setup Complete ====="

# Make the script executable
chmod +x setup-github.sh
