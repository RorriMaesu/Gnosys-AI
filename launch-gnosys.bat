@echo off
title Gnosys AI One-Click Launcher
cd /d "%~dp0"

echo ======================================================================
echo  [Gnosys AI] One-Click Bootstrap Launcher
echo ======================================================================
echo.

:: Detect if we already have the repository files in this directory
if not exist server.py (
    echo [Gnosys AI] Project files not found. Downloading the latest version...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/RorriMaesu/Gnosys-AI/archive/refs/heads/main.zip' -OutFile 'gnosys_temp.zip'"
    
    if not exist gnosys_temp.zip (
        echo [Gnosys AI] ERROR: Failed to download project files.
        pause
        exit /b
    )
    
    echo [Gnosys AI] Extracting files natively in background...
    powershell -Command "Expand-Archive -Path 'gnosys_temp.zip' -DestinationPath '.'"
    
    echo [Gnosys AI] Organizing project structure...
    xcopy /e /y "Gnosys-AI-main\*" "." >nul
    rd /s /q "Gnosys-AI-main"
    del "gnosys_temp.zip"
    echo [Gnosys AI] Setup completed successfully!
    echo.
)

:: Run the backend script
if exist run_backend.bat (
    call run_backend.bat
) else (
    python server.py
    pause
)
