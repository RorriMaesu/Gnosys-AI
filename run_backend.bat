@echo off
title Gnosys AI Assistant Server
cd /d "%~dp0"

setlocal enabledelayedexpansion

:: Check if ffmpeg is installed on the path
where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo [Gnosys AI] FFmpeg was not detected on your system.
    echo [Gnosys AI] Automatically installing FFmpeg via winget...
    winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
    if errorlevel 0 (
        echo [Gnosys AI] FFmpeg installed successfully. Refreshing environment variables...
        :: Refresh PATH for the current session dynamically from the registry
        for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
        for /f "tokens=2*" %%A in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSTEM_PATH=%%B"
        set "PATH=!USER_PATH!;!SYSTEM_PATH!"
        echo [Gnosys AI] Environment refreshed.
    ) else (
        echo [Gnosys AI] WARNING: Automatic FFmpeg installation failed. Please install it manually.
    )
)

echo [Gnosys AI] Starting local backend assistant on port 8020...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe server.py
) else (
    python server.py
)
pause
