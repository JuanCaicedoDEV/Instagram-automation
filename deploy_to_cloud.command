#!/bin/bash
# Vision Media Cloud Deployer Wrapper

# Get the script directory
CDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "=== Vision Media Cloud Deployer ==="
echo "Checking dependencies..."

# Use the parent directory to find the scripts folder if called from root
# or check if it's already in the scripts folder
if [ -d "$CDIR/scripts" ]; then
    ROOT_DIR="$CDIR"
else
    ROOT_DIR="$CDIR/.."
fi

cd "$ROOT_DIR"

# Ensure python is available
if ! command -v python3 &> /dev/null
then
    echo "Python3 could not be found. Please install it."
    exit
fi

# Install requirements
pip3 install -r scripts/requirements_deploy.txt --quiet

# Run the deployer
python3 scripts/deploy_cloud.py

echo ""
echo "Press any key to exit..."
read -n 1
