#!/bin/bash
set -e

echo "=== Building Vision Media Content Engine Desktop App ==="

echo "1. Building React Frontend..."
cd apps/dashboard
npm install
npm run build
cd ../..

echo "2. Packaging with PyInstaller..."
# We use --windowed so it doesn't open a terminal window on launch.
# We include the compiled React dist folder.
# We include the backend and execution modules.
python3 -m PyInstaller --name "ContentEngine" \
            --add-data "apps/dashboard/dist:apps/dashboard/dist" \
            --add-data "backend:backend" \
            --add-data "execution:execution" \
            --hidden-import "uvicorn.logging" \
            --hidden-import "uvicorn.loops" \
            --hidden-import "uvicorn.loops.auto" \
            --hidden-import "uvicorn.protocols" \
            --hidden-import "uvicorn.protocols.http" \
            --hidden-import "uvicorn.protocols.http.auto" \
            --hidden-import "uvicorn.protocols.websockets" \
            --hidden-import "uvicorn.protocols.websockets.auto" \
            --hidden-import "uvicorn.lifespan" \
            --hidden-import "uvicorn.lifespan.on" \
            --hidden-import "uvicorn.lifespan.off" \
            --hidden-import "asyncpg" \
            --hidden-import "PIL" \
            --hidden-import "requests" \
            desktop_launcher.py

echo "=== Build Complete ==="
echo "The executable is located in the 'dist' folder."
