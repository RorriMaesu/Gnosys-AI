@echo off
title Gnosys AI Assistant Server
echo [Gnosys AI] Starting local backend assistant on port 8020...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe server.py
) else (
    python server.py
)
pause
