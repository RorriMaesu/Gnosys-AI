#!/bin/bash
echo "=============================================="
echo "Activating Dr. Lex (Gnosys-AI Tutor)"
echo "=============================================="
echo ""
echo "Setting secure browser permissions (CORS)..."
launchctl setenv OLLAMA_ORIGINS "*"

echo "Starting Ollama background service..."
osascript -e 'quit app "Ollama"' 2>/dev/null
sleep 2
open -a Ollama
sleep 2

echo "Detecting Hardware..."
MODEL="gemma4:e2b"

# Get total physical memory in bytes and convert to MB
RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null)
if [ -z "$RAM_BYTES" ]; then
    RAM_MB=0
else
    RAM_MB=$((RAM_BYTES / 1024 / 1024))
fi

echo "Detected ${RAM_MB} MB Unified Memory."

if [ "$RAM_MB" -ge 32000 ]; then
    MODEL="VladimirGav/gemma4-26b-16GB-VRAM:latest"
elif [ "$RAM_MB" -ge 16000 ]; then
    MODEL="gemma4:e4b"
else
    MODEL="gemma4:e2b"
fi

echo ""
echo "=============================================="
echo "Selected Model: $MODEL"
echo "=============================================="
echo ""

echo "Downloading AI Model (this may take a few minutes the first time)..."
echo "The terminal will automatically close when finished."
if ! ollama pull "$MODEL"; then
    echo "Selected model pull failed. Falling back to gemma4:e4b..."
    MODEL="gemma4:e4b"
    if ! ollama pull "$MODEL"; then
        echo "gemma4:e4b pull failed. Falling back to gemma4:e2b..."
        MODEL="gemma4:e2b"
        ollama pull "$MODEL"
    fi
fi

echo ""
echo "Opening Gnosys-AI with model: $MODEL"
open "https://RorriMaesu.github.io/Gnosys-AI/?model=$MODEL"
