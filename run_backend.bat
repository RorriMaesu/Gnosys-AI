@echo off
title Gnosys AI Assistant Server
cd /d "%~dp0"
echo [Gnosys AI] Starting local backend assistant on port 8020...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe server.py
) else (
    python server.py
)
pause
