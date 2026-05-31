import http.server
import socketserver
import subprocess
import platform
import json
import os

PORT = 8000

def register_windows_protocol():
    if platform.system() == 'Windows':
        try:
            local_app_data = os.environ.get('LOCALAPPDATA', '')
            ollama_path = os.path.join(local_app_data, 'Programs', 'Ollama', 'ollama app.exe')
            cmd_path = f'"{ollama_path}"'
            
            subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-ollama', '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-ollama\\shell\\open\\command', '/ve', '/t', 'REG_SZ', '/d', cmd_path, '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print("[Launcher] Programmatically registered gnosys-ollama:// protocol in HKCU.")
        except Exception as e:
            print(f"[Launcher] Warning: Could not register gnosys-ollama:// protocol: {e}")

def get_system_ram_gb():
    system = platform.system()
    if system == 'Windows':
        try:
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            return stat.ullTotalPhys / (1024**3)
        except Exception:
            pass
    elif system == 'Darwin':
        try:
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True)
            return int(out.strip()) / (1024**3)
        except Exception:
            pass
    elif system == 'Linux':
        try:
            with open('/proc/meminfo', 'r') as f:
                for line in f:
                    if 'MemTotal' in line:
                        kb = int(line.split()[1])
                        return kb / (1024**2)
        except Exception:
            pass
    return 8.0  # Fallback to 8GB

def get_gpu_info():
    # Try nvidia-smi first
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            text=True,
            stderr=subprocess.DEVNULL
        )
        lines = out.strip().split('\n')
        gpus = []
        for line in lines:
            if not line.strip(): continue
            parts = line.split(',')
            name = parts[0].strip()
            vram_mb = int(parts[1].strip())
            gpus.append({"name": name, "vram_mb": vram_mb, "vendor": "nvidia"})
        if gpus:
            return gpus
    except Exception:
        pass

    # Fallback to WMI via PowerShell on Windows
    if platform.system() == 'Windows':
        try:
            cmd = 'powershell -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"'
            out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
            data = json.loads(out)
            if not isinstance(data, list):
                data = [data]
            gpus = []
            for item in data:
                if not item: continue
                name = item.get("Name", "")
                ram_bytes = item.get("AdapterRAM", 0)
                if not name: continue
                vram_mb = int(ram_bytes / (1024 * 1024))
                
                vendor = "unknown"
                name_lower = name.lower()
                if "nvidia" in name_lower:
                    vendor = "nvidia"
                elif "amd" in name_lower or "radeon" in name_lower:
                    vendor = "amd"
                elif "intel" in name_lower:
                    vendor = "intel"
                    
                gpus.append({"name": name, "vram_mb": vram_mb, "vendor": vendor})
            return gpus
        except Exception:
            pass

    return []

class GnosysHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/hardware-info':
            try:
                system_ram_gb = get_system_ram_gb()
                gpus = get_gpu_info()
                
                # Check max VRAM and vendor
                max_vram_mb = 0
                for gpu in gpus:
                    if gpu["vram_mb"] > max_vram_mb:
                        max_vram_mb = gpu["vram_mb"]
                
                is_mac_silicon = False
                if platform.system() == 'Darwin' and platform.machine() == 'arm64':
                    is_mac_silicon = True
                    max_vram_mb = int(system_ram_gb * 1024 * 0.75)
                
                # Classification rules
                model_caps = {}
                
                def classify(vram_req_gb, ram_req_gb):
                    if max_vram_mb >= vram_req_gb * 1024:
                        return "recommended"
                    elif system_ram_gb >= ram_req_gb:
                        return "supported"
                    else:
                        return "restricted"
                
                model_caps["gemma4:e4b"] = classify(11.0, 16.0)
                model_caps["llama3"] = classify(6.0, 8.0)
                model_caps["qwen2.5"] = classify(6.0, 8.0)
                model_caps["mistral"] = classify(5.5, 8.0)
                model_caps["phi3"] = classify(3.5, 6.0)
                model_caps["llama3.2"] = classify(3.0, 4.0)
                
                # Auto recommend best choice
                auto_rec = "llama3.2"
                if model_caps["gemma4:e4b"] == "recommended":
                    auto_rec = "gemma4:e4b"
                elif model_caps["qwen2.5"] == "recommended":
                    auto_rec = "qwen2.5"
                elif model_caps["llama3"] == "recommended":
                    auto_rec = "llama3"
                elif model_caps["phi3"] == "recommended":
                    auto_rec = "phi3"
                elif model_caps["llama3.2"] == "recommended":
                    auto_rec = "llama3.2"
                elif model_caps["qwen2.5"] == "supported":
                    auto_rec = "qwen2.5"
                elif model_caps["llama3.2"] == "supported":
                    auto_rec = "llama3.2"
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'status': 'success',
                    'hardware': {
                        'system_ram_gb': round(system_ram_gb, 2),
                        'gpus': gpus,
                        'is_mac_silicon': is_mac_silicon,
                        'max_vram_mb': max_vram_mb
                    },
                    'classification': model_caps,
                    'recommended_model': auto_rec
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        else:
            super().do_GET()
    def do_OPTIONS(self):
        # Respond to CORS preflight requests
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/launch-ollama':
            try:
                system = platform.system()
                print(f"[Launcher] Request received. Launching Ollama on {system}...")
                
                if system == 'Windows':
                    # Launch the Ollama App on Windows using native startfile to avoid cmd.exe permissions blocks
                    local_app_data = os.environ.get('LOCALAPPDATA', '')
                    ollama_path = os.path.join(local_app_data, 'Programs', 'Ollama', 'ollama app.exe')
                    try:
                        if os.path.exists(ollama_path):
                            os.startfile(ollama_path)
                            print("[Launcher] Launched Ollama via absolute path.")
                        else:
                            os.startfile('ollama app.exe')
                            print("[Launcher] Launched Ollama via PATH.")
                    except Exception as err:
                        print(f"[Launcher] os.startfile failed, trying cmd fallback: {err}")
                        subprocess.Popen(['cmd.exe', '/c', 'start', '/b', '""', 'ollama app.exe'], shell=True)
                elif system == 'Darwin':
                    # Launch the Ollama App on macOS
                    subprocess.Popen(['open', '-a', 'Ollama'])
                else:
                    # Launch Ollama background service on Linux/WSL
                    subprocess.Popen(['ollama', 'serve'])
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {'status': 'success', 'message': 'Ollama launch initiated.'}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                print(f"[Launcher] Error starting Ollama: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {'status': 'error', 'message': str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    # Override end_headers to inject CORS into normal GET file requests too
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

def run_server():
    # Register URL protocol handler for Windows users
    register_windows_protocol()
    
    # Allow port reuse to avoid 'address already in use' errors on quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), GnosysHTTPRequestHandler) as httpd:
        print(f"[Gnosys-AI Server] Listening on http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Gnosys-AI Server] Shutting down.")
            httpd.server_close()

if __name__ == '__main__':
    run_server()
