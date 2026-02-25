@echo off
cd /d "%~dp0"

:: Activa el entorno virtual
call affila\Scripts\activate.bat

:: Agrega los modulos al path de Python
set PYTHONPATH=%~dp0;%~dp0execution;%~dp0scripts;%PYTHONPATH%

:: Arranca FastAPI en esta misma ventana (sin start "")
:: Asi el proceso vive mientras el CMD este abierto
affila\Scripts\python.exe desktop_launcher.py