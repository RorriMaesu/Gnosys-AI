@echo off
setlocal enabledelayedexpansion
echo ==============================================
echo Activating Dr. Lex (Gnosys-AI Tutor)
echo ==============================================
echo.
echo Setting secure browser connection permissions (CORS)...
set OLLAMA_ORIGINS=*
setx OLLAMA_ORIGINS "*" >nul 2>&1

echo Registering custom browser URL protocol for Ollama...
reg add "HKCU\Software\Classes\gnosys-ollama" /v "URL Protocol" /t REG_SZ /d "" /f >nul 2>&1
reg add "HKCU\Software\Classes\gnosys-ollama\shell\open\command" /ve /t REG_SZ /d "\"%%LOCALAPPDATA%%\Programs\Ollama\ollama app.exe\"" /f >nul 2>&1

echo Registering custom browser URL protocol for Gnosys Assistant...
pushd "%~dp0..\.."
set "ROOT_DIR=%CD%"
popd
reg add "HKCU\Software\Classes\gnosys-assistant" /v "URL Protocol" /t REG_SZ /d "" /f >nul 2>&1
reg add "HKCU\Software\Classes\gnosys-assistant\shell\open\command" /ve /t REG_SZ /d "\"%ROOT_DIR%\run_backend.bat\"" /f >nul 2>&1

echo Starting Ollama background service...
taskkill /f /im ollama.exe >nul 2>&1
taskkill /f /im "ollama app.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "ollama app.exe"
timeout /t 2 /nobreak >nul

echo Detecting Hardware...
set "MODEL=gemma4:e2b"
set "VRAM_MB=0"

for /f "tokens=1" %%a in ('nvidia-smi --query-gpu^=memory.total --format^=csv^,noheader 2^>nul') do (
    set "VRAM_MB=%%a"
)

if !VRAM_MB! GTR 0 (
    echo Detected NVIDIA GPU with !VRAM_MB! MB VRAM.
    if !VRAM_MB! GEQ 14000 (
        set "MODEL=VladimirGav/gemma4-26b-16GB-VRAM:latest"
    ) else if !VRAM_MB! GEQ 10000 (
        set "MODEL=gemma4:e4b"
    ) else (
        set "MODEL=gemma4:e2b"
    )
) else (
    echo NVIDIA GPU not found. Checking System RAM...
    for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "Write-Output ([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB))" 2^>nul`) do (
        set "RAM_MB=%%a"
    )
    if "!RAM_MB!"=="" set "RAM_MB=0"
    echo Detected !RAM_MB! MB System RAM.
    
    if !RAM_MB! GEQ 24000 (
        set "MODEL=VladimirGav/gemma4-26b-16GB-VRAM:latest"
    ) else if !RAM_MB! GEQ 16000 (
        set "MODEL=gemma4:e4b"
    ) else (
        set "MODEL=gemma4:e2b"
    )
)

echo.
echo ==============================================
echo Selected Model: !MODEL!
echo ==============================================
echo.

echo Downloading AI Model (this may take a few minutes the first time)...
ollama pull !MODEL!
if errorlevel 1 (
    echo Selected model pull failed. Falling back to gemma4:e4b...
    set "MODEL=gemma4:e4b"
    ollama pull !MODEL!
    if errorlevel 1 (
        echo gemma4:e4b pull failed. Falling back to gemma4:e2b...
        set "MODEL=gemma4:e2b"
        ollama pull !MODEL!
    )
)

echo.
echo Opening Gnosys-AI with model !MODEL!...
start "" "https://RorriMaesu.github.io/Gnosys-AI/?model=!MODEL!"
echo The terminal will automatically close when finished.
