#!/bin/bash
# Vision Media Deployer Pro Launcher

CDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$CDIR"

echo "=== Vision Media Cloud Deployer Pro ==="
echo "Checking dependencies..."
pip3 install -r scripts/requirements_deploy.txt fastapi uvicorn --quiet

echo "Starting Backend API..."
python3 scripts/deployer_api.py &
BACKEND_PID=$!

echo "Starting Dashboard..."
cd apps/deployer-pro
npm install --quiet
npm run dev &
FRONTEND_PID=$!

function cleanup {
  echo "Stopping services..."
  kill $BACKEND_PID
  kill $FRONTEND_PID
  exit
}

trap cleanup SIGINT

echo "Dashboard running at http://localhost:3000"
echo "Press Ctrl+C to stop."

wait
