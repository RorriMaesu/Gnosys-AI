@echo off
title Gnosys AI Assistant Server
cd /d "%~dp0"

:: Detect if running directly from a temporary folder (running inside a zip viewer)
echo "%~dp0" | findstr /i "AppData\Local\Temp" >nul
if %errorlevel% equ 0 (
    echo ======================================================================
    echo  [Gnosys AI] ERROR: RUNNING FROM A ZIP FILE
    echo ======================================================================
    echo  You are running this file directly from inside a ZIP archive.
    echo  Windows has only extracted the batch file to a temporary folder.
    echo.
    echo  Please follow these steps:
    echo  1. Close this window.
    echo  2. Right-click the downloaded .zip file.
    echo  3. Select "Extract All..." and extract it to a real folder.
    echo  4. Open the extracted folder and run "run_backend.bat" again.
    echo ======================================================================
    pause
    exit /b
)

setlocal enabledelayedexpansion

:: Check if ffmpeg is installed on the path
where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo [Gnosys AI] FFmpeg was not detected on your system.
    echo [Gnosys AI] Automatically installing FFmpeg via winget...
    winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
    if !errorlevel! equ 0 (
        echo [Gnosys AI] FFmpeg installed successfully. Refreshing environment variables...
        :: Refresh PATH for the current session dynamically from the registry
        for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
        for /f "tokens=2*" %%A in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSTEM_PATH=%%B"
        set "PATH=!USER_PATH!;!SYSTEM_PATH!"
        echo [Gnosys AI] Environment refreshed.
    ) else (
        echo [Gnosys AI] WARNING: Automatic winget FFmpeg installation failed or winget is missing.
        echo             Please install FFmpeg manually and add it to your PATH environment.
    )
)

echo [Gnosys AI] Starting local backend assistant on port 8020...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe server.py
) else (
    python server.py
)
pause
