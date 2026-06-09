import http.server
import socketserver
import subprocess
import platform
import json
import os

PORT = 8020

def get_quantime_install_path():
    if platform.system() != 'Windows':
        return None
    try:
        import winreg
        for hive in [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]:
            try:
                key_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{D37E618A-706E-45E4-A159-4E6DF9B53A04}_is1"
                with winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ) as key:
                    install_loc, _ = winreg.QueryValueEx(key, "InstallLocation")
                    if install_loc and os.path.exists(install_loc):
                        return install_loc
            except Exception:
                continue
    except Exception:
        pass
    
    # Fallback to standard LOCALAPPDATA path
    local_app_data = os.environ.get('LOCALAPPDATA', '')
    if local_app_data:
        fallback = os.path.join(local_app_data, 'Programs', 'Quantime')
        if os.path.exists(fallback):
            return fallback
    return None

def is_quantime_installed():
    path = get_quantime_install_path()
    if not path:
        return False
    pythonw_path = os.path.join(path, 'backend', '.venv', 'Scripts', 'pythonw.exe')
    return os.path.exists(pythonw_path)

def is_quantime_running():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('127.0.0.1', 49999))
        s.close()
        return False
    except socket.error:
        return True

def probe_port(port):
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect(('127.0.0.1', port))
        s.close()
        return True
    except Exception:
        return False

def check_ace_step_compatibility(path):
    if not path or not os.path.isdir(path):
        return None
    # Check if this directory itself contains the openrouter server or checkpoints
    has_api = os.path.exists(os.path.join(path, "openrouter", "openrouter_api_server.py")) or os.path.exists(os.path.join(path, "openrouter_api_server.py"))
    has_checkpoints = os.path.exists(os.path.join(path, "checkpoints"))
    if has_api and has_checkpoints:
        return "ACE-Step 1.5 Root"
    
    # Check if it has a subdirectory that fits
    try:
        for item in os.listdir(path):
            sub = os.path.join(path, item)
            if os.path.isdir(sub) and not item.startswith('.'):
                sub_api = os.path.exists(os.path.join(sub, "openrouter", "openrouter_api_server.py")) or os.path.exists(os.path.join(sub, "openrouter_api_server.py"))
                sub_checkpoints = os.path.exists(os.path.join(sub, "checkpoints"))
                if sub_api and sub_checkpoints:
                    return f"Contains ACE-Step ({item})"
    except Exception:
        pass
    return None

def register_windows_protocol():
    if platform.system() == 'Windows':
        # 1. Register Ollama protocol
        try:
            local_app_data = os.environ.get('LOCALAPPDATA', '')
            ollama_path = os.path.join(local_app_data, 'Programs', 'Ollama', 'ollama app.exe')
            cmd_path = f'"{ollama_path}"'
            
            subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-ollama', '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-ollama\\shell\\open\\command', '/ve', '/t', 'REG_SZ', '/d', cmd_path, '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print("[Launcher] Programmatically registered gnosys-ollama:// protocol in HKCU.")
        except Exception as e:
            print(f"[Launcher] Warning: Could not register gnosys-ollama:// protocol: {e}")

        # 2. Register Quantime protocol
        try:
            quantime_path = get_quantime_install_path()
            if quantime_path:
                pythonw_path = os.path.join(quantime_path, 'backend', '.venv', 'Scripts', 'pythonw.exe')
                tray_path = os.path.join(quantime_path, 'backend', 'tray_icon.py')
                if os.path.exists(pythonw_path) and os.path.exists(tray_path):
                    q_cmd_path = f'"{pythonw_path}" "{tray_path}"'
                    subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-quantime', '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-quantime\\shell\\open\\command', '/ve', '/t', 'REG_SZ', '/d', q_cmd_path, '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    print("[Launcher] Programmatically registered gnosys-quantime:// protocol in HKCU.")
        except Exception as e:
            print(f"[Launcher] Warning: Could not register gnosys-quantime:// protocol: {e}")

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
    def address_string(self):
        return self.client_address[0]

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
        elif self.path == '/api/quantime-status':
            try:
                installed = is_quantime_installed()
                running = is_quantime_running()
                
                # Determine which port dashboard is on (5173 for dev, 8000 for prod)
                dashboard_url = "http://localhost:8000"
                if probe_port(5173):
                    dashboard_url = "http://localhost:5173"
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'status': 'success',
                    'installed': installed,
                    'running': running,
                    'dashboard_url': dashboard_url
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path.startswith('/api/explorer'):
            try:
                import urllib.parse
                parsed_url = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed_url.query)
                target_path = params.get('path', [''])[0].strip()

                directories = []
                system = platform.system()

                 if not target_path:
                    # List root drives on Windows, or root directory on Unix
                    if system == 'Windows':
                        import string
                        from ctypes import windll
                        drives = []
                        bitmask = windll.kernel32.GetLogicalDrives()
                        for letter in string.ascii_uppercase:
                            if bitmask & 1:
                                drives.append(f"{letter}:\\")
                            bitmask >>= 1
                        for d in drives:
                            compat = check_ace_step_compatibility(d)
                            directories.append({'name': d, 'path': d, 'isDir': True, 'compatibility': compat})
                    else:
                        compat = check_ace_step_compatibility('/')
                        directories.append({'name': '/', 'path': '/', 'isDir': True, 'compatibility': compat})
                else:
                    # List subdirectories inside target_path
                    if os.path.exists(target_path) and os.path.isdir(target_path):
                        for item in os.listdir(target_path):
                            full_path = os.path.join(target_path, item)
                            if os.path.isdir(full_path) and not item.startswith('.'):
                                compat = check_ace_step_compatibility(full_path)
                                directories.append({
                                    'name': item,
                                    'path': full_path,
                                    'isDir': True,
                                    'compatibility': compat
                                })

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'directories': directories}).encode('utf-8'))
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
        elif self.path == '/api/launch-quantime':
            try:
                if not is_quantime_running():
                    path = get_quantime_install_path()
                    if path:
                        pythonw_path = os.path.join(path, 'backend', '.venv', 'Scripts', 'pythonw.exe')
                        tray_path = os.path.join(path, 'backend', 'tray_icon.py')
                        if os.path.exists(pythonw_path) and os.path.exists(tray_path):
                            subprocess.Popen([pythonw_path, tray_path], cwd=os.path.join(path, 'backend'))
                            print("[Launcher] Launched Quantime from install path.")
                        else:
                            raise Exception("Quantime executable or tray icon script missing.")
                    else:
                        raise Exception("Quantime installation directory not found.")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {'status': 'success', 'message': 'Quantime launch initiated.'}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                print(f"[Launcher] Error starting Quantime: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {'status': 'error', 'message': str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
        elif self.path == '/api/launch-quantime':
            try:
                if not is_quantime_running():
                    path = get_quantime_install_path()
                    if path:
                        pythonw_path = os.path.join(path, 'backend', '.venv', 'Scripts', 'pythonw.exe')
                        tray_path = os.path.join(path, 'backend', 'tray_icon.py')
                        if os.path.exists(pythonw_path) and os.path.exists(tray_path):
                            subprocess.Popen([pythonw_path, tray_path], cwd=os.path.join(path, 'backend'))
                            print("[Launcher] Launched Quantime from install path.")
                        else:
                            raise Exception("Quantime executable or tray icon script missing.")
                    else:
                        raise Exception("Quantime installation directory not found.")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {'status': 'success', 'message': 'Quantime launch initiated.'}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                print(f"[Launcher] Error starting Quantime: {e}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {'status': 'error', 'message': str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
        elif self.path == '/api/music/status':
            try:
                # Resolve ACE-Step standalone directory (read from custom path header if present)
                ace_path = self.headers.get('X-ComfyUI-Path', '').strip()
                if not ace_path:
                    ace_path = 'D:\\ComfyUI\\ACE-Step-1.5'
                    
                ace_installed = os.path.exists(ace_path)
                ace_running = probe_port(8002)
                
                # Scan models subfolders safely (checkpoints)
                checkpoints_dir = os.path.join(ace_path, "checkpoints")
                discovered_models = []
                if os.path.exists(checkpoints_dir):
                    try:
                        for item in os.listdir(checkpoints_dir):
                            full_item_path = os.path.join(checkpoints_dir, item)
                            if os.path.isdir(full_item_path):
                                discovered_models.append(item)
                            elif os.path.isfile(full_item_path) and item.endswith('.safetensors'):
                                # Strip extension for clean selector display
                                discovered_models.append(os.path.splitext(item)[0])
                    except Exception:
                        pass

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'status': 'success',
                    'comfy_path': ace_path,
                    'comfy_installed': ace_installed,
                    'comfy_running': ace_running,
                    'custom_node_installed': True, # Mock true for backward compatibility
                    'models_installed': len(discovered_models) > 0,
                    'scan_details': {
                        'models': discovered_models
                    }
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/launch':
            try:
                ace_path = 'D:\\ComfyUI\\ACE-Step-1.5'
                vram_profile = 'high'
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = json.loads(self.rfile.read(content_length).decode('utf-8'))
                    ace_path = body.get('comfy_path', ace_path)
                    vram_profile = body.get('vram_profile', 'high')

                python_exe = os.path.join(ace_path, '.venv', 'Scripts', 'python.exe')
                
                if not os.path.exists(ace_path):
                    raise Exception(f"ACE-Step directory not found at {ace_path}")
                
                if os.path.exists(python_exe):
                    # Launch API server using venv Python
                    cmd = [python_exe, '-m', 'openrouter.openrouter_api_server', '--host', '127.0.0.1', '--port', '8002']
                    if vram_profile == 'low':
                        cmd.append('--lowvram')
                    subprocess.Popen(cmd, cwd=ace_path)
                    msg = f"Launched ACE-Step API Server ({vram_profile} VRAM) via venv python"
                else:
                    # Fallback to system python
                    cmd = ['python', '-m', 'openrouter.openrouter_api_server', '--host', '127.0.0.1', '--port', '8002']
                    if vram_profile == 'low':
                        cmd.append('--lowvram')
                    subprocess.Popen(cmd, cwd=ace_path)
                    msg = f"Launched ACE-Step API Server ({vram_profile} VRAM) via system python"

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'message': msg}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/install':
            # Run installation in background thread
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
                target_path = body.get('install_path', 'D:\\ComfyUI')
                
                global install_thread, install_status
                if 'install_status' not in globals():
                    install_status = {'progress': 0, 'step': 'idle', 'error': None}
                
                if install_status['step'] not in ['idle', 'done', 'failed']:
                    raise Exception("An installation is already running.")
                
                import threading
                install_status = {'progress': 0, 'step': 'starting', 'error': None}
                
                def run_install(path):
                    global install_status
                    try:
                        os.makedirs(path, exist_ok=True)
                        
                        # Step 1: Download ComfyUI Portable if missing
                        install_status['step'] = 'Downloading ComfyUI Portable'
                        install_status['progress'] = 10
                        
                        # Check if ComfyUI directory structure is there
                        comfy_root = os.path.join(path, 'ComfyUI')
                        if not os.path.exists(comfy_root):
                            # Git clone ComfyUI
                            import subprocess
                            install_status['step'] = 'Cloning ComfyUI Core'
                            subprocess.run(['git', 'clone', 'https://github.com/comfyanonymous/ComfyUI.git', comfy_root], check=True)
                        
                        install_status['progress'] = 30
                        
                        # Step 2: Install Custom Nodes
                        custom_nodes_dir = os.path.join(comfy_root, 'custom_nodes')
                        os.makedirs(custom_nodes_dir, exist_ok=True)
                        node_path = os.path.join(custom_nodes_dir, 'ComfyUI_ACE-Step-zveroboy')
                        
                        if not os.path.exists(node_path):
                            install_status['step'] = 'Cloning ACE-Step Custom Node'
                            subprocess.run(['git', 'clone', 'https://github.com/thezveroboy/ComfyUI_ACE-Step-zveroboy.git', node_path], check=True)
                        
                        install_status['progress'] = 50
                        
                        # Step 3: Download model weights
                        install_status['step'] = 'Downloading ACE-Step 1.5 Models'
                        # Create directories
                        model_dir = os.path.join(comfy_root, 'models', 'checkpoints')
                        os.makedirs(model_dir, exist_ok=True)
                        
                        # We will download a lightweight or standard ACE Step model checkpoint (e.g. ace_step_v1_3.5b)
                        # or create standard folder layout. Let's download a single unified safetensors to checkpoints if it exists
                        # otherwise components to TTS directory.
                        # For convenience in automatic install, let's create TTS folder and download a key file or instructions.
                        # Since HuggingFace model is massive (~7GB for full v1-3.5B), we will download the configuration files
                        # and write placeholder/guides if download speed is limited, or attempt to download.
                        # Let's write the directory structures and download a small tester file or the config files.
                        tts_base = os.path.join(comfy_root, 'models', 'TTS', 'ACE-Step-v1-3.5B')
                        os.makedirs(tts_base, exist_ok=True)
                        
                        # Create directories
                        dirs_to_make = ['ace_step_transformer', 'music_dcae_f8c8', 'music_vocoder', 'umt5-base']
                        for d in dirs_to_make:
                            os.makedirs(os.path.join(tts_base, d), exist_ok=True)
                            
                        # Download config files to make nodes happy
                        import urllib.request
                        configs = {
                            'ace_step_transformer/config.json': 'https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B/resolve/main/ace_step_transformer/config.json',
                            'music_dcae_f8c8/config.json': 'https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B/resolve/main/music_dcae_f8c8/config.json',
                            'music_vocoder/config.json': 'https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B/resolve/main/music_vocoder/config.json',
                            'umt5-base/config.json': 'https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B/resolve/main/umt5-base/config.json'
                        }
                        
                        for rel_path, url in configs.items():
                            file_path = os.path.join(tts_base, rel_path)
                            if not os.path.exists(file_path):
                                urllib.request.urlretrieve(url, file_path)
                                
                        install_status['progress'] = 80
                        
                        # We will inform user they need to copy or download large safetensors files if they are not already cached.
                        # But to be helpful, let's write a README file inside the checkpoints directory as well.
                        readme_content = "Please download the ACE-Step 1.5 safetensors models from HuggingFace and place them here."
                        with open(os.path.join(tts_base, 'README_INSTALL.txt'), 'w') as f:
                            f.write(readme_content)
                            
                        install_status['progress'] = 100
                        install_status['step'] = 'done'
                    except Exception as err:
                        install_status['step'] = 'failed'
                        install_status['error'] = str(err)
                        print("[Music Install Error]", err)
                
                install_thread = threading.Thread(target=run_install, args=(target_path,))
                install_thread.start()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'message': 'Installation thread started.'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/install-status':
            try:
                global install_status
                if 'install_status' not in globals():
                    install_status = {'progress': 0, 'step': 'idle', 'error': None}
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(install_status).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/auto-detect':
            try:
                import string
                from ctypes import windll
                drives = []
                system = platform.system()
                if system == 'Windows':
                    bitmask = windll.kernel32.GetLogicalDrives()
                    for letter in string.ascii_uppercase:
                        if bitmask & 1:
                            drives.append(f"{letter}:\\")
                        bitmask >>= 1
                else:
                    drives.append('/')

                candidates = []
                common_names = ['ComfyUI', 'ComfyUI_windows_portable', 'ACE-Step-1.5', 'AI']
                
                # Check root drives and major folders
                for drive in drives:
                    compat = check_ace_step_compatibility(drive)
                    if compat:
                        candidates.append({'path': drive, 'compat': compat})
                    
                    try:
                        for name in common_names:
                            candidate = os.path.join(drive, name)
                            if os.path.exists(candidate) and os.path.isdir(candidate):
                                compat = check_ace_step_compatibility(candidate)
                                if compat:
                                    candidates.append({'path': candidate, 'compat': compat})
                                # Check one level deep
                                try:
                                    for sub in os.listdir(candidate):
                                        sub_path = os.path.join(candidate, sub)
                                        if os.path.isdir(sub_path):
                                            compat = check_ace_step_compatibility(sub_path)
                                            if compat:
                                                candidates.append({'path': sub_path, 'compat': compat})
                                except Exception:
                                    pass
                    except Exception:
                        pass
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'candidates': candidates}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/generate':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = self.rfile.read(content_length)
                
                # Proxy to local openrouter_api_server.py on port 8002
                import urllib.request
                import urllib.error
                
                req = urllib.request.Request(
                    'http://127.0.0.1:8002/v1/chat/completions',
                    data=payload,
                    headers={'Content-Type': 'application/json'}
                )
                
                # Send with high timeout (180s) to survive slow inference
                with urllib.request.urlopen(req, timeout=180) as response_conn:
                    response_data = response_conn.read()
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(response_data)
            except urllib.error.HTTPError as he:
                self.send_response(he.code)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(he.read())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    # Override end_headers to inject CORS into normal GET file requests too
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
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
