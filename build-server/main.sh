#!/bin/sh
set -e  # Exit on error

echo "Current directory: $(pwd)"
echo "Cloning repository: $GIT_REPOSITORY_URL"

# Clone to output directory
git clone "$GIT_REPOSITORY_URL" /home/app/output

# Verify clone succeeded
if [ ! -d "/home/app/output" ]; then
    echo "ERROR: Clone failed - output directory not created"
    exit 1
fi

# Check for package.json
if [ ! -f "/home/app/output/package.json" ]; then
    echo "ERROR: package.json not found in cloned repository"
    ls -la /home/app/output
    exit 1
fi

echo "Clone successful, package.json found"
echo "Contents of /home/app/output:"
ls -la /home/app/output

exec node script.js