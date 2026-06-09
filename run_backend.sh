#!/bin/bash
echo "[Gnosys AI] Starting local backend assistant on port 8020..."
if [ -d ".venv" ]; then
    .venv/bin/python server.py
else
    python3 server.py
fi
