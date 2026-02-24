@echo off
echo === Building Vision Media Content Engine Desktop App (Windows) ===

echo 1. Building React Frontend...
cd apps\dashboard
call npm install
call npm run build
cd ..\..

echo 2. Packaging with PyInstaller...
:: Notice the semi-colons (;) instead of colons (:) for Windows paths
python -m PyInstaller --name "ContentEngine" ^
            --add-data "apps\dashboard\dist;apps\dashboard\dist" ^
            --add-data "backend;backend" ^
            --add-data "execution;execution" ^
            --hidden-import "uvicorn.logging" ^
            --hidden-import "uvicorn.loops" ^
            --hidden-import "uvicorn.loops.auto" ^
            --hidden-import "uvicorn.protocols" ^
            --hidden-import "uvicorn.protocols.http" ^
            --hidden-import "uvicorn.protocols.http.auto" ^
            --hidden-import "uvicorn.protocols.websockets" ^
            --hidden-import "uvicorn.protocols.websockets.auto" ^
            --hidden-import "uvicorn.lifespan" ^
            --hidden-import "uvicorn.lifespan.on" ^
            --hidden-import "uvicorn.lifespan.off" ^
            --hidden-import "asyncpg" ^
            --hidden-import "PIL" ^
            --hidden-import "requests" ^
            desktop_launcher.py

echo === Build Complete ===
echo The executable is located in the 'dist\ContentEngine' folder.
pause
