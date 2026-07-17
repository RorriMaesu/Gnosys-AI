@echo off
title Gnosys AI One-Click Launcher
cd /d "%~dp0"

echo ======================================================================
echo  [Gnosys AI] One-Click Bootstrap Launcher
echo ======================================================================
echo.

:: Check for updates on startup
if exist .git (
    echo [Gnosys AI] Git repository detected. Checking for updates via git pull...
    git pull
) else (
    echo [Gnosys AI] Checking for backend updates...
    powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/RorriMaesu/Gnosys-AI/archive/refs/heads/main.zip' -OutFile 'gnosys_temp.zip' -ErrorAction Stop } catch {}"
    
    if not exist server.py (
        if not exist gnosys_temp.zip (
            echo [Gnosys AI] ERROR: Project files not found and could not download update bundle.
            echo             Please check your internet connection and try again.
            pause
            exit /b
        )
    )
    
    if exist gnosys_temp.zip (
        echo [Gnosys AI] Extracting and updating Gnosys AI to the latest version...
        powershell -Command "Expand-Archive -Path 'gnosys_temp.zip' -DestinationPath '.' -Force"
        xcopy /e /y /q "Gnosys-AI-main\*" "." >nul
        rd /s /q "Gnosys-AI-main"
        del "gnosys_temp.zip"
        echo [Gnosys AI] Update completed successfully!
        echo.
    ) else (
        echo [Gnosys AI] Offline or update check skipped. Running local version.
        echo.
    )
)

:: Run the backend script
if exist run_backend.bat (
    set "GNOSYS_OPEN_BROWSER=1"
    call run_backend.bat
) else (
    set "GNOSYS_OPEN_BROWSER=1"
    python server.py
    pause
)
