import http.client
import http.server
import socket
import socketserver
import subprocess
import platform
import collections
import json
import os
import re
import shutil
import threading
import time
import urllib.error
import urllib.request
import uuid

PORT = 8020
HELPER_STARTED_AT = time.time()
active_downloads = {}
active_downloads_status = {}  # {repo_id: {'status': ..., 'progress': ..., 'speed': ..., 'eta': ...}}
active_download_processes = {}  # {repo_id: subprocess.Popen}
install_status = {'progress': 0, 'step': 'idle', 'error': None}
active_vram_profile = None
active_music_model = None
active_ace_path = None
managed_ace_process = None
accelerator_lock = threading.RLock()
accelerator_state = {
    'owner': 'idle',
    'transitioning': False,
    'last_error': None,
    'updated_at': None,
}
music_generation_lock = threading.Lock()
music_generation_state_lock = threading.Lock()
music_generation_upstream_lock = threading.Lock()
music_generation_upstream = {
    'request_id': None,
    'connection': None,
    'response': None,
}
cancelled_music_request_ids = collections.deque(maxlen=64)
music_generation_state = {
    'active': False,
    'request_id': None,
    'trace_id': None,
    'model': None,
    'stage': 'idle',
    'stage_started_at': None,
    'started_at': None,
    'cancel_requested': False,
    'request_summary': {},
    'timeline': [],
    'heartbeat_at': None,
    'heartbeat_count': 0,
    'last_compute_activity_at': None,
    'last_gpu_sample': None,
    'gpu_sample_count': 0,
    'peak_gpu_used_mb': 0,
    'model_confirmed_resident_at': None,
    'last_ace_process_sample': None,
    'monitor_status': 'idle',
    'monitor_message': 'No music generation is active.',
    'last_result': None,
    'last_error': None,
    'last_error_code': None,
    'last_http_status': None,
    'last_request_id': None,
    'last_trace_id': None,
    'last_duration_seconds': None,
    'updated_at': None,
}
music_diagnostic_lock = threading.Lock()
music_diagnostic_events = collections.deque(maxlen=200)

# Reported to the hosted frontend so it can prompt users to update a stale
# local helper. Bump whenever server.py behavior changes in a user-visible way.
GNOSYS_HELPER_VERSION = '2026.07.18'

ALLOWED_WEB_ORIGINS = {
    'https://rorrimaesu.github.io',
    'http://127.0.0.1:8020',
    'http://localhost:8020',
}

DEFAULT_MUSIC_MODEL = 'acestep-v15-turbo'
SUPPORTED_MUSIC_MODELS = {
    'acestep-v15-turbo',
    'acestep-v15-xl-turbo',
    'acestep-v15-xl-sft',
}
MUSIC_GENERATION_TIMEOUT_SECONDS = 1800
MUSIC_GENERATION_STOP_GRACE_SECONDS = 3
MUSIC_TELEMETRY_STALL_SECONDS = 180
MUSIC_TELEMETRY_HEARTBEAT_STALE_SECONDS = 12
MUSIC_TELEMETRY_GPU_ACTIVE_PERCENT = 5

MUSIC_MODEL_ARTIFACTS = {
    'xl_sft': {
        'model': 'acestep-v15-xl-sft',
        'directory': 'checkpoints/acestep-v15-xl-sft',
        'single_file': 'checkpoints/acestep-v15-xl-sft.safetensors',
        'repo_id': 'ACE-Step/acestep-v15-xl-sft',
    },
    'xl_turbo': {
        'model': 'acestep-v15-xl-turbo',
        'directory': 'checkpoints/acestep-v15-xl-turbo',
        'single_file': 'checkpoints/acestep-v15-xl-turbo.safetensors',
        'repo_id': 'ACE-Step/acestep-v15-xl-turbo',
    },
    'turbo': {
        'model': 'acestep-v15-turbo',
        'directory': 'checkpoints/acestep-v15-turbo',
        'single_file': 'checkpoints/acestep-v15-turbo.safetensors',
        'repo_id': 'ACE-Step/acestep-v15-turbo',
    },
}
MUSIC_MODEL_KEYS = {
    spec['model']: key for key, spec in MUSIC_MODEL_ARTIFACTS.items()
}


def _nonempty_file(path):
    try:
        return os.path.isfile(path) and os.path.getsize(path) > 0
    except OSError:
        return False


def inspect_transformers_checkpoint(model_dir):
    """Return a serializable completeness report for a Transformers checkpoint."""
    report = {
        'installed': False,
        'state': 'missing',
        'path': model_dir,
        'layout': None,
        'expected_files': [],
        'missing_files': [],
        'invalid_files': [],
        'expected_bytes': None,
        'partial_bytes': 0,
        'message': 'Checkpoint directory is missing.',
    }
    if not os.path.isdir(model_dir):
        return report

    report['state'] = 'incomplete'
    report['message'] = 'Checkpoint directory exists, but model weights are missing.'
    index_path = os.path.join(model_dir, 'model.safetensors.index.json')
    single_path = os.path.join(model_dir, 'model.safetensors')

    if os.path.isfile(index_path):
        report['layout'] = 'sharded'
        try:
            with open(index_path, 'r', encoding='utf-8') as index_file:
                index_data = json.load(index_file)
            weight_map = index_data.get('weight_map') or {}
            expected_files = sorted(set(weight_map.values()))
            if not expected_files:
                raise ValueError('weight_map does not reference any shard files')
            report['expected_files'] = expected_files
            expected_size = (index_data.get('metadata') or {}).get('total_size')
            if isinstance(expected_size, int):
                report['expected_bytes'] = expected_size

            root = os.path.abspath(model_dir)
            for relative_path in expected_files:
                shard_path = os.path.abspath(os.path.join(model_dir, relative_path))
                try:
                    inside_model = os.path.commonpath([root, shard_path]) == root
                except ValueError:
                    inside_model = False
                if not inside_model:
                    report['invalid_files'].append(relative_path)
                elif not os.path.isfile(shard_path):
                    report['missing_files'].append(relative_path)
                elif os.path.getsize(shard_path) <= 0:
                    report['invalid_files'].append(relative_path)

            if not report['missing_files'] and not report['invalid_files']:
                report['installed'] = True
                report['state'] = 'complete'
                report['message'] = f"Verified all {len(expected_files)} checkpoint shards."
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            report['state'] = 'invalid'
            report['message'] = f'Checkpoint index is invalid: {exc}'
    elif _nonempty_file(single_path):
        report.update({
            'installed': True,
            'state': 'complete',
            'layout': 'single',
            'expected_files': ['model.safetensors'],
            'message': 'Verified single-file checkpoint.',
        })

    cache_dir = os.path.join(model_dir, '.cache', 'huggingface', 'download')
    if os.path.isdir(cache_dir):
        try:
            report['partial_bytes'] = sum(
                entry.stat().st_size
                for entry in os.scandir(cache_dir)
                if entry.is_file() and entry.name.endswith('.incomplete')
            )
        except OSError:
            pass
    return report


def inspect_music_model(ace_path, model_key):
    spec = MUSIC_MODEL_ARTIFACTS[model_key]
    single_path = os.path.join(ace_path, spec['single_file'])
    if _nonempty_file(single_path):
        return {
            'installed': True,
            'state': 'complete',
            'path': single_path,
            'layout': 'single',
            'expected_files': [os.path.basename(single_path)],
            'missing_files': [],
            'invalid_files': [],
            'expected_bytes': os.path.getsize(single_path),
            'partial_bytes': 0,
            'message': 'Verified single-file checkpoint.',
        }
    return inspect_transformers_checkpoint(os.path.join(ace_path, spec['directory']))


def inspect_music_models(ace_path):
    return {
        key: inspect_music_model(ace_path, key)
        for key in MUSIC_MODEL_ARTIFACTS
    }

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

def request_json(url, payload=None, timeout=10, method=None):
    data = None
    headers = {'Accept': 'application/json'}
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read()
        if not raw:
            return {}
        return json.loads(raw.decode('utf-8'))

def get_gpu_memory_status():
    if platform.system() != 'Windows' and not shutil.which('nvidia-smi'):
        return None
    try:
        output = subprocess.check_output([
            'nvidia-smi',
            '--query-gpu=name,memory.total,memory.used,memory.free',
            '--format=csv,noheader,nounits',
        ], text=True, timeout=5, stderr=subprocess.DEVNULL)
        first = output.strip().splitlines()[0]
        name, total, used, free = [part.strip() for part in first.split(',', 3)]
        return {
            'name': name,
            'total_mb': int(total),
            'used_mb': int(used),
            'free_mb': int(free),
        }
    except Exception:
        return None

def get_gpu_activity_status():
    """Return a lightweight, point-in-time GPU activity sample."""
    if platform.system() != 'Windows' and not shutil.which('nvidia-smi'):
        return None
    try:
        output = subprocess.check_output([
            'nvidia-smi',
            '--query-gpu=name,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu,power.draw',
            '--format=csv,noheader,nounits',
        ], text=True, timeout=3, stderr=subprocess.DEVNULL)
        first = output.strip().splitlines()[0]
        parts = [part.strip() for part in first.split(',')]
        if len(parts) < 8:
            return None
        name, gpu_util, memory_util, total, used, free, temperature, power = parts[:8]
        return {
            'name': name,
            'utilization_gpu_percent': int(float(gpu_util)),
            'utilization_memory_percent': int(float(memory_util)),
            'total_mb': int(float(total)),
            'used_mb': int(float(used)),
            'free_mb': int(float(free)),
            'temperature_c': int(float(temperature)),
            'power_watts': round(float(power), 2),
            'sampled_at': time.time(),
        }
    except Exception:
        return None

def music_minimum_resident_mb(model_name):
    """VRAM floor below which the selected music model cannot be resident."""
    return 4500 if 'xl-' in str(model_name or '').lower() else 2500

def get_ace_process_telemetry():
    """Sample the managed ACE-Step process so checkpoint loading can be proven.

    During a cold XL load the weights are read into system RAM long before any
    VRAM is used, so process working-set and CPU-time growth are the only
    truthful liveness signals in that phase.
    """
    process = managed_ace_process
    if process is None:
        return None
    if process.poll() is not None:
        return {'alive': False, 'pid': process.pid, 'sampled_at': time.time()}
    sample = {'alive': True, 'pid': process.pid, 'sampled_at': time.time()}
    try:
        if platform.system() == 'Windows':
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ('cb', wintypes.DWORD),
                    ('PageFaultCount', wintypes.DWORD),
                    ('PeakWorkingSetSize', ctypes.c_size_t),
                    ('WorkingSetSize', ctypes.c_size_t),
                    ('QuotaPeakPagedPoolUsage', ctypes.c_size_t),
                    ('QuotaPagedPoolUsage', ctypes.c_size_t),
                    ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t),
                    ('QuotaNonPagedPoolUsage', ctypes.c_size_t),
                    ('PagefileUsage', ctypes.c_size_t),
                    ('PeakPagefileUsage', ctypes.c_size_t),
                ]

            handle = wintypes.HANDLE(int(process._handle))
            counters = PROCESS_MEMORY_COUNTERS()
            counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            if ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
                sample['working_set_mb'] = int(counters.WorkingSetSize / (1024 * 1024))
            creation, exited, kernel, user = (wintypes.FILETIME() for _ in range(4))
            if ctypes.windll.kernel32.GetProcessTimes(
                handle, ctypes.byref(creation), ctypes.byref(exited), ctypes.byref(kernel), ctypes.byref(user)
            ):
                def filetime_seconds(filetime):
                    return ((filetime.dwHighDateTime << 32) + filetime.dwLowDateTime) / 1e7
                sample['cpu_seconds'] = round(filetime_seconds(kernel) + filetime_seconds(user), 2)
        else:
            with open(f'/proc/{process.pid}/statm', 'r', encoding='ascii') as handle:
                resident_pages = int(handle.read().split()[1])
            sample['working_set_mb'] = int(resident_pages * os.sysconf('SC_PAGE_SIZE') / (1024 * 1024))
            with open(f'/proc/{process.pid}/stat', 'r', encoding='ascii') as handle:
                fields = handle.read().rsplit(')', 1)[1].split()
            sample['cpu_seconds'] = round((int(fields[11]) + int(fields[12])) / os.sysconf('SC_CLK_TCK'), 2)
    except Exception:
        pass
    return sample

def get_ollama_runtime_status():
    try:
        data = request_json('http://127.0.0.1:11434/api/ps', timeout=3)
        models = []
        for model in data.get('models', []):
            name = model.get('name') or model.get('model')
            if name:
                models.append(name)
        return {'online': True, 'models': models}
    except Exception as exc:
        return {'online': False, 'models': [], 'error': str(exc)}

def unload_ollama_models():
    status = get_ollama_runtime_status()
    if not status['online']:
        return {'status': 'offline', 'models_unloaded': []}

    unloaded = []
    for model_name in status['models']:
        request_json(
            'http://127.0.0.1:11434/api/generate',
            {'model': model_name, 'prompt': '', 'keep_alive': 0, 'stream': False},
            timeout=30,
            method='POST',
        )
        unloaded.append(model_name)

    deadline = time.time() + 15
    remaining = status['models']
    while time.time() < deadline:
        current = get_ollama_runtime_status()
        if not current['online'] or not current['models']:
            return {'status': 'unloaded', 'models_unloaded': unloaded}
        remaining = current['models']
        time.sleep(0.25)

    raise RuntimeError(f"Ollama still reports loaded models after unload: {', '.join(remaining)}")

def get_ace_health():
    if not probe_port(8002):
        return {'online': False, 'status': 'offline'}
    try:
        data = request_json('http://127.0.0.1:8002/health', timeout=3)
        return {
            'online': True,
            'status': data.get('status', 'unknown'),
            'error': data.get('error'),
        }
    except Exception as exc:
        return {'online': True, 'status': 'unresponsive', 'error': str(exc)}

def unload_ace_models():
    global active_vram_profile, active_music_model, managed_ace_process
    health = get_ace_health()
    managed_process_was_alive = (
        managed_ace_process is not None
        and managed_ace_process.poll() is None
    )

    # Port health is not process health. ACE-Step can close its listener while
    # a model-loading request and its Python/CUDA process are still alive. Always
    # terminate the helper-managed process before treating the service as gone.
    if managed_process_was_alive:
        managed_ace_process.terminate()
        try:
            managed_ace_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            managed_ace_process.kill()
            try:
                managed_ace_process.wait(timeout=5)
            except subprocess.TimeoutExpired as exc:
                raise RuntimeError(
                    'ACE-Step process did not exit after terminate and kill.'
                ) from exc
    managed_ace_process = None

    if probe_port(8002):
        kill_port_process(8002)

    deadline = time.time() + 15
    while time.time() < deadline:
        if not probe_port(8002):
            active_vram_profile = None
            active_music_model = None
            return {
                'status': 'unloaded' if health['online'] or managed_process_was_alive else 'offline',
                'music_lm_unloaded': True,
                'mode': 'service_stopped',
                'message': 'ACE-Step service stopped and GPU memory released.',
            }
        time.sleep(0.25)

    raise RuntimeError('ACE-Step remained online after its managed process was stopped.')

def required_music_free_mb(model_name):
    return 10240 if 'xl-' in (model_name or '').lower() else 6144

def normalize_music_model(model_name):
    normalized = (model_name or DEFAULT_MUSIC_MODEL).strip()
    if normalized.startswith('acemusic/'):
        normalized = normalized[len('acemusic/'):]
    if normalized not in SUPPORTED_MUSIC_MODELS:
        return DEFAULT_MUSIC_MODEL
    return normalized

def sanitize_diagnostic_text(value, limit=4000):
    """Remove user-authored prompt/audio content before retaining diagnostics."""
    text = str(value or '')
    text = re.sub(r'<prompt>[\s\S]*?</prompt>', '<prompt>[redacted]</prompt>', text, flags=re.IGNORECASE)
    text = re.sub(r'<lyrics>[\s\S]*?</lyrics>', '<lyrics>[redacted]</lyrics>', text, flags=re.IGNORECASE)
    text = re.sub(r'data:audio/[^;,\s]+;base64,[A-Za-z0-9+/=]+', 'data:audio/[redacted]', text)
    if len(text) > limit:
        text = text[:limit] + '... [truncated]'
    return text

def sanitize_diagnostic_value(value):
    sensitive_keys = {'messages', 'prompt', 'lyrics', 'content', 'audio', 'audio_url'}
    if isinstance(value, dict):
        return {
            str(key): ('[redacted]' if str(key).lower() in sensitive_keys else sanitize_diagnostic_value(item))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [sanitize_diagnostic_value(item) for item in value[:25]]
    if isinstance(value, str):
        return sanitize_diagnostic_text(value)
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return sanitize_diagnostic_text(value)

def make_music_trace_id(candidate=None):
    candidate = (candidate or '').strip()
    if candidate and re.fullmatch(r'[A-Za-z0-9._:-]{8,80}', candidate):
        return candidate
    return f'music-trace-{uuid.uuid4().hex[:16]}'

def summarize_music_request(generation_request):
    audio_config = generation_request.get('audio_config') or {}
    messages = generation_request.get('messages') or []
    content_length = 0
    for message in messages:
        if isinstance(message, dict):
            content_length += len(str(message.get('content') or ''))
    return {
        'model': normalize_music_model(generation_request.get('model')),
        'duration': audio_config.get('duration'),
        'bpm': audio_config.get('bpm'),
        'instrumental': audio_config.get('instrumental'),
        'inference_steps': generation_request.get('inference_steps'),
        'vram_profile': active_vram_profile,
        'text_length': content_length,
    }

def record_music_diagnostic(event, trace_id=None, request_id=None, level='info', details=None):
    now = time.time()
    entry = {
        'timestamp': now,
        'timestamp_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now)),
        'event': event,
        'level': level,
        'trace_id': trace_id,
        'request_id': request_id,
        'details': sanitize_diagnostic_value(details or {}),
    }
    with music_diagnostic_lock:
        music_diagnostic_events.append(entry)
    print(f"[MusicDiagnostics][{trace_id or '-'}] {level.upper()} {event}: "
          f"{json.dumps(entry['details'], ensure_ascii=True, separators=(',', ':'))}")
    return entry

def get_recent_music_diagnostics(limit=100):
    limit = max(1, min(int(limit or 100), 200))
    with music_diagnostic_lock:
        return list(music_diagnostic_events)[-limit:]

def extract_upstream_error(raw_body):
    text = raw_body.decode('utf-8', errors='replace') if isinstance(raw_body, bytes) else str(raw_body or '')
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return sanitize_diagnostic_text(text or 'ACE-Step returned an empty error response.')
    if isinstance(payload, dict):
        detail = payload.get('detail') or payload.get('message') or payload.get('error') or payload.get('status')
        if isinstance(detail, dict):
            detail = detail.get('message') or detail.get('detail') or json.dumps(detail)
        if detail:
            return sanitize_diagnostic_text(detail)
    return sanitize_diagnostic_text(text)

def open_music_generation_upstream(payload, request_id, trace_id):
    """Open ACE-Step through a connection the stop endpoint can interrupt."""
    connection = http.client.HTTPConnection(
        '127.0.0.1',
        8002,
        timeout=MUSIC_GENERATION_TIMEOUT_SECONDS,
    )
    with music_generation_upstream_lock:
        music_generation_upstream.update({
            'request_id': request_id,
            'connection': connection,
            'response': None,
        })

    try:
        if music_generation_was_cancelled(request_id):
            raise RuntimeError('Generation cancelled by user.')
        connection.request(
            'POST',
            '/v1/chat/completions',
            body=payload,
            headers={
                'Content-Type': 'application/json',
                'X-Gnosys-Trace-Id': trace_id,
            },
        )
        if music_generation_was_cancelled(request_id):
            raise RuntimeError('Generation cancelled by user.')
        response = connection.getresponse()
        with music_generation_upstream_lock:
            if music_generation_upstream.get('request_id') != request_id:
                response.close()
                connection.close()
                raise RuntimeError('Generation cancelled by user.')
            music_generation_upstream['response'] = response
        return response
    except Exception:
        close_music_generation_upstream(request_id)
        raise

def close_music_generation_upstream(request_id=None):
    """Interrupt the active ACE socket and release its HTTP resources."""
    with music_generation_upstream_lock:
        active_request_id = music_generation_upstream.get('request_id')
        if request_id is not None and active_request_id not in (None, request_id):
            return False
        connection = music_generation_upstream.get('connection')
        response = music_generation_upstream.get('response')
        music_generation_upstream.update({
            'request_id': None,
            'connection': None,
            'response': None,
        })

    sock = getattr(connection, 'sock', None) if connection is not None else None
    if sock is not None:
        try:
            sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            sock.close()
        except OSError:
            pass
    if response is not None:
        try:
            response.close()
        except Exception:
            pass
    if connection is not None:
        try:
            connection.close()
        except Exception:
            pass
    return connection is not None or response is not None

def read_ace_generation_response(response_conn, request_id, model_name):
    """Convert ACE-Step's live SSE response back to the JSON shape used by the UI."""
    headers = getattr(response_conn, 'headers', None)
    content_type = headers.get('Content-Type', '') if headers is not None else ''
    if 'text/event-stream' not in str(content_type).lower():
        return response_conn.read()

    content_parts = []
    audio_items = None
    completion_id = None
    created = int(time.time())
    response_model = model_name
    finish_reason = 'stop'

    update_music_generation_stage(
        request_id,
        'ace_step_inference',
        monitor_message='ACE-Step accepted the live stream and is generating audio.',
    )
    for raw_line in response_conn:
        line = raw_line.decode('utf-8', errors='replace').strip() if isinstance(raw_line, bytes) else str(raw_line).strip()
        if not line or not line.startswith('data:'):
            continue
        payload_text = line[5:].strip()
        if payload_text == '[DONE]':
            break
        try:
            chunk = json.loads(payload_text)
        except json.JSONDecodeError:
            continue

        mark_music_generation_heartbeat(request_id)
        completion_id = chunk.get('id') or completion_id
        created = chunk.get('created') or created
        response_model = chunk.get('model') or response_model
        choices = chunk.get('choices') or []
        if not choices:
            continue
        choice = choices[0] or {}
        delta = choice.get('delta') or {}
        content = delta.get('content')
        if content and content != '.':
            content_parts.append(content)
        if delta.get('audio'):
            audio_items = delta['audio']
            update_music_generation_stage(
                request_id,
                'audio_received',
                monitor_message='ACE-Step returned the generated audio; validating the response.',
            )
        if choice.get('finish_reason'):
            finish_reason = choice['finish_reason']

    if not audio_items:
        upstream_message = ''.join(content_parts).strip()
        raise RuntimeError(upstream_message or 'ACE-Step ended its stream without returning audio.')

    response_payload = {
        'id': completion_id or f'chatcmpl-{uuid.uuid4().hex}',
        'object': 'chat.completion',
        'created': created,
        'model': response_model,
        'choices': [{
            'index': 0,
            'message': {
                'role': 'assistant',
                'content': ''.join(content_parts),
                'audio': audio_items,
            },
            'finish_reason': finish_reason,
        }],
    }
    return json.dumps(response_payload, ensure_ascii=False).encode('utf-8')

MUSIC_STAGE_LABELS = {
    'idle': 'Idle',
    'accepted': 'Request accepted',
    'connecting_to_ace': 'Connecting to ACE-Step',
    'ace_step_initializing': 'ACE-Step is loading or preparing the model',
    'ace_step_inference': 'ACE-Step is generating audio',
    'audio_received': 'Audio response received',
    'validating_audio': 'Validating generated audio',
    'completed': 'Generation complete',
    'cancelling': 'Stopping generation',
    'failed': 'Generation failed',
}

def _music_timeline_entry(stage, label=None, timestamp=None):
    return {
        'stage': stage,
        'label': label or MUSIC_STAGE_LABELS.get(stage, stage.replace('_', ' ').title()),
        'timestamp': timestamp or time.time(),
    }

def get_music_generation_snapshot():
    with music_generation_state_lock:
        snapshot = dict(music_generation_state)
        snapshot['timeline'] = list(music_generation_state.get('timeline') or [])
        snapshot['request_summary'] = dict(music_generation_state.get('request_summary') or {})
        if music_generation_state.get('last_gpu_sample'):
            snapshot['last_gpu_sample'] = dict(music_generation_state['last_gpu_sample'])
        return snapshot

def begin_music_generation(model_name, trace_id=None, request_summary=None):
    if not music_generation_lock.acquire(blocking=False):
        return None
    request_id = f"music-{time.time_ns()}"
    now = time.time()
    with music_generation_state_lock:
        music_generation_state.update({
            'active': True,
            'request_id': request_id,
            'trace_id': trace_id,
            'model': model_name,
            'stage': 'accepted',
            'stage_started_at': now,
            'started_at': now,
            'cancel_requested': False,
            'request_summary': sanitize_diagnostic_value(request_summary or {}),
            'timeline': [_music_timeline_entry('accepted', timestamp=now)],
            'heartbeat_at': None,
            'heartbeat_count': 0,
            'last_compute_activity_at': now,
            'last_gpu_sample': None,
            'gpu_sample_count': 0,
            'peak_gpu_used_mb': 0,
            'model_confirmed_resident_at': None,
            'last_ace_process_sample': None,
            'monitor_status': 'starting',
            'monitor_message': 'The helper accepted the request and is preparing ACE-Step.',
            'last_result': 'running',
            'last_error': None,
            'last_error_code': None,
            'updated_at': now,
        })
    return request_id

def update_music_generation_stage(request_id, stage, label=None, monitor_message=None):
    now = time.time()
    with music_generation_state_lock:
        if music_generation_state['request_id'] != request_id:
            return False
        if music_generation_state['stage'] != stage:
            music_generation_state['stage'] = stage
            music_generation_state['stage_started_at'] = now
            music_generation_state['timeline'].append(
                _music_timeline_entry(stage, label=label, timestamp=now)
            )
        if monitor_message:
            music_generation_state['monitor_message'] = monitor_message
        music_generation_state['updated_at'] = now
        return True

def mark_music_generation_heartbeat(request_id):
    """Record a direct heartbeat emitted by ACE-Step while its future is running."""
    now = time.time()
    with music_generation_state_lock:
        if music_generation_state['request_id'] != request_id:
            return False
        first_heartbeat = music_generation_state['heartbeat_count'] == 0
        music_generation_state['heartbeat_at'] = now
        music_generation_state['heartbeat_count'] += 1
        music_generation_state['updated_at'] = now
        if first_heartbeat:
            music_generation_state['timeline'].append(_music_timeline_entry(
                'ace_heartbeat',
                label='Live ACE-Step heartbeat received',
                timestamp=now,
            ))
        return True

def classify_music_generation_activity(snapshot, gpu, service_online, now=None):
    """Conservatively classify liveness without inventing an inference percentage."""
    now = now or time.time()
    if not snapshot.get('active'):
        result = snapshot.get('last_result')
        if result == 'completed':
            return 'completed', 'The most recent track completed successfully.', False
        if result == 'cancelled':
            return 'cancelled', 'The most recent generation was stopped.', False
        if result in ('error', 'failed'):
            return 'failed', 'The most recent generation failed. Download diagnostics for details.', False
        return 'idle', 'No music generation is active.', False
    if snapshot.get('cancel_requested'):
        return 'cancelling', 'Stopping ACE-Step and releasing its GPU memory…', False
    if not service_online:
        return 'service_lost', 'ACE-Step is no longer listening on port 8002.', True

    gpu_util = int((gpu or {}).get('utilization_gpu_percent') or 0)
    gpu_active = gpu_util >= MUSIC_TELEMETRY_GPU_ACTIVE_PERCENT
    heartbeat_at = snapshot.get('heartbeat_at')
    heartbeat_age = (now - heartbeat_at) if heartbeat_at else None
    compute_at = snapshot.get('last_compute_activity_at') or snapshot.get('started_at') or now
    compute_quiet = max(0, now - compute_at)
    elapsed = max(0, now - (snapshot.get('started_at') or now))
    used_mb = int((gpu or {}).get('used_mb') or 0)
    model_name = str(snapshot.get('model') or '').lower()
    vram_profile = str((snapshot.get('request_summary') or {}).get('vram_profile') or '').lower()
    minimum_resident_mb = music_minimum_resident_mb(model_name)
    confirmed_resident_at = snapshot.get('model_confirmed_resident_at')
    ace_process = snapshot.get('last_ace_process_sample') or {}

    # "Model released" is only a valid diagnosis if this request previously
    # proved the model resident in VRAM. During a cold load, VRAM legitimately
    # stays near 1 GB while ~20 GB of weights stream into system RAM first.
    if (
        elapsed >= 60
        and vram_profile != 'low'
        and used_mb > 0
        and used_mb < minimum_resident_mb
        and confirmed_resident_at
        and snapshot.get('stage') in ('ace_step_initializing', 'ace_step_inference')
    ):
        peak_mb = int(snapshot.get('peak_gpu_used_mb') or 0)
        return (
            'model_released',
            f'GPU memory fell to {used_mb} MB after the {"XL " if "xl-" in model_name else ""}music model was resident (peak {peak_mb} MB this request). The model is no longer resident in VRAM.',
            True,
        )

    if snapshot.get('stage') in ('accepted', 'connecting_to_ace'):
        return 'starting', 'Preparing the request and opening the ACE-Step generation stream.', False

    if (
        snapshot.get('stage') == 'ace_step_initializing'
        and not confirmed_resident_at
        and not gpu_active
    ):
        activity_age = int(compute_quiet)
        if compute_quiet < MUSIC_TELEMETRY_STALL_SECONDS:
            working_set_mb = int(ace_process.get('working_set_mb') or 0)
            ram_note = (
                f'the ACE-Step process is holding {working_set_mb / 1024:.1f} GB of system RAM and '
                if working_set_mb else ''
            )
            return (
                'loading',
                f'ACE-Step is loading the model checkpoint into system RAM — {ram_note}loading activity was observed {activity_age}s ago. Low GPU memory use is normal during this phase.',
                False,
            )
        return (
            'suspected_stall',
            f'ACE-Step has shown no loading activity (CPU, RAM, or GPU changes) for {activity_age} seconds while preparing the model. The load may be stuck.',
            True,
        )
    if heartbeat_age is not None and heartbeat_age <= MUSIC_TELEMETRY_HEARTBEAT_STALE_SECONDS:
        if gpu_active:
            return 'active', f'ACE-Step is responding; the GPU is working at {gpu_util}%.', False
        if elapsed >= MUSIC_TELEMETRY_STALL_SECONDS and compute_quiet >= MUSIC_TELEMETRY_STALL_SECONDS:
            return (
                'suspected_stall',
                'ACE-Step’s control loop still responds, but no measurable GPU work has been observed for several minutes. The generation may be stalled.',
                True,
            )
        return 'quiet', 'ACE-Step is responding; the GPU is momentarily quiet (CPU or audio work can do this).', False
    if gpu_active:
        return 'active', f'The GPU is working at {gpu_util}%; waiting for the next ACE-Step heartbeat.', False
    if elapsed >= MUSIC_TELEMETRY_STALL_SECONDS and compute_quiet >= MUSIC_TELEMETRY_STALL_SECONDS:
        return (
            'suspected_stall',
            'No ACE-Step heartbeat or measurable GPU work has been observed recently. The generation may be stalled.',
            True,
        )
    return 'quiet', 'ACE-Step is online, but no measurable GPU work was seen in this sample.', False

def get_music_generation_realtime_snapshot():
    """Build the fast polling response without scanning models or contacting Ollama."""
    gpu = get_gpu_activity_status()
    service_online = probe_port(8002)
    ace_process = get_ace_process_telemetry()
    process_alive = None
    if managed_ace_process is not None:
        process_alive = managed_ace_process.poll() is None
    now = time.time()

    with music_generation_state_lock:
        if music_generation_state.get('active'):
            previous_gpu = music_generation_state.get('last_gpu_sample') or {}
            gpu_util = int((gpu or {}).get('utilization_gpu_percent') or 0)
            used_mb_now = int((gpu or {}).get('used_mb') or 0)
            memory_delta = abs(
                used_mb_now - int(previous_gpu.get('used_mb') or 0)
            ) if previous_gpu and gpu else 0
            if gpu_util >= MUSIC_TELEMETRY_GPU_ACTIVE_PERCENT or memory_delta >= 16:
                music_generation_state['last_compute_activity_at'] = now
            music_generation_state['last_gpu_sample'] = gpu
            music_generation_state['gpu_sample_count'] += 1
            if used_mb_now > int(music_generation_state.get('peak_gpu_used_mb') or 0):
                music_generation_state['peak_gpu_used_mb'] = used_mb_now
            if (
                used_mb_now >= music_minimum_resident_mb(music_generation_state.get('model'))
                and not music_generation_state.get('model_confirmed_resident_at')
            ):
                music_generation_state['model_confirmed_resident_at'] = now
            # Checkpoint loading is CPU-side work: growing working-set or CPU
            # time proves progress while VRAM is still untouched.
            if ace_process and ace_process.get('alive'):
                previous_process = music_generation_state.get('last_ace_process_sample') or {}
                working_set_delta = abs(
                    int(ace_process.get('working_set_mb') or 0)
                    - int(previous_process.get('working_set_mb') or 0)
                )
                cpu_delta = (
                    float(ace_process.get('cpu_seconds') or 0)
                    - float(previous_process.get('cpu_seconds') or 0)
                )
                if previous_process and (working_set_delta >= 32 or cpu_delta >= 0.25):
                    music_generation_state['last_compute_activity_at'] = now
                music_generation_state['last_ace_process_sample'] = ace_process

        snapshot = dict(music_generation_state)
        snapshot['timeline'] = list(music_generation_state.get('timeline') or [])
        snapshot['request_summary'] = dict(music_generation_state.get('request_summary') or {})
        if music_generation_state.get('last_gpu_sample'):
            snapshot['last_gpu_sample'] = dict(music_generation_state['last_gpu_sample'])

        monitor_status, monitor_message, stall_suspected = classify_music_generation_activity(
            snapshot,
            gpu,
            service_online,
            now=now,
        )
        music_generation_state['monitor_status'] = monitor_status
        music_generation_state['monitor_message'] = monitor_message
        snapshot['monitor_status'] = monitor_status
        snapshot['monitor_message'] = monitor_message

    started_at = snapshot.get('started_at')
    heartbeat_at = snapshot.get('heartbeat_at')
    compute_at = snapshot.get('last_compute_activity_at')
    snapshot.update({
        'server_time': now,
        'elapsed_seconds': round(max(0, now - started_at), 1) if started_at else 0,
        'heartbeat_age_seconds': round(max(0, now - heartbeat_at), 1) if heartbeat_at else None,
        'compute_quiet_seconds': round(max(0, now - compute_at), 1) if compute_at else None,
        'stage_label': MUSIC_STAGE_LABELS.get(snapshot.get('stage'), str(snapshot.get('stage') or 'idle').replace('_', ' ').title()),
        'exact_progress_available': False,
        'stall_suspected': stall_suspected,
        'timeout_seconds': MUSIC_GENERATION_TIMEOUT_SECONDS,
        'gpu': gpu,
        'service': {
            'port_8002_open': service_online,
            'managed_process_alive': process_alive,
        },
    })
    return snapshot

def request_music_generation_cancel():
    now = time.time()
    with music_generation_state_lock:
        was_active = music_generation_state['active']
        if was_active:
            first_request = not music_generation_state['cancel_requested']
            music_generation_state['cancel_requested'] = True
            music_generation_state['last_result'] = 'cancelling'
            music_generation_state['stage'] = 'cancelling'
            music_generation_state['monitor_status'] = 'cancelling'
            music_generation_state['monitor_message'] = 'Stopping ACE-Step and releasing its GPU memory…'
            request_id = music_generation_state.get('request_id')
            if request_id and request_id not in cancelled_music_request_ids:
                cancelled_music_request_ids.append(request_id)
            if first_request:
                music_generation_state['stage_started_at'] = now
                music_generation_state['timeline'].append(
                    _music_timeline_entry('cancelling', timestamp=now)
                )
            music_generation_state['updated_at'] = now
        snapshot = dict(music_generation_state)
    return was_active, snapshot

def music_generation_was_cancelled(request_id):
    with music_generation_state_lock:
        return (
            request_id in cancelled_music_request_ids
            or (
                music_generation_state['request_id'] == request_id
                and music_generation_state['cancel_requested']
            )
        )

def finish_music_generation(request_id, result, error=None, error_code=None, http_status=None):
    should_release = False
    now = time.time()
    with music_generation_state_lock:
        if music_generation_state['request_id'] == request_id:
            started_at = music_generation_state['started_at']
            trace_id = music_generation_state['trace_id']
            if music_generation_state['cancel_requested']:
                result = 'cancelled'
                error = None
                error_code = 'MUSIC_GENERATION_CANCELLED'
                http_status = 409
            terminal_stage = 'completed' if result == 'completed' else ('cancelling' if result == 'cancelled' else 'failed')
            if not music_generation_state['timeline'] or music_generation_state['timeline'][-1]['stage'] != terminal_stage:
                music_generation_state['timeline'].append(
                    _music_timeline_entry(terminal_stage, timestamp=now)
                )
            terminal_status = 'completed' if result == 'completed' else ('cancelled' if result == 'cancelled' else 'failed')
            terminal_message = {
                'completed': 'The track completed successfully.',
                'cancelled': 'Generation was stopped and the GPU is being released.',
                'failed': 'Generation failed. Download diagnostics for details.',
            }[terminal_status]
            music_generation_state.update({
                'active': False,
                'request_id': None,
                'trace_id': None,
                'model': None,
                'stage': 'idle',
                'stage_started_at': now,
                'started_at': None,
                'cancel_requested': False,
                'monitor_status': terminal_status,
                'monitor_message': terminal_message,
                'last_result': result,
                'last_error': error,
                'last_error_code': error_code,
                'last_http_status': http_status,
                'last_request_id': request_id,
                'last_trace_id': trace_id,
                'last_duration_seconds': round(now - started_at, 3) if started_at else None,
                'updated_at': now,
            })
            should_release = True
    if should_release and music_generation_lock.locked():
        music_generation_lock.release()

def wait_for_music_generation_idle(timeout=10):
    deadline = time.time() + timeout
    snapshot = get_music_generation_snapshot()
    while snapshot['active'] and time.time() < deadline:
        time.sleep(0.05)
        snapshot = get_music_generation_snapshot()
    return snapshot

def stop_music_service():
    current_generation = get_music_generation_snapshot()
    trace_id = current_generation.get('trace_id') or make_music_trace_id()
    record_music_diagnostic('stop_requested', trace_id=trace_id, request_id=current_generation.get('request_id'), details={
        'generation_active': current_generation.get('active'),
        'generation_stage': current_generation.get('stage'),
        'accelerator_owner': accelerator_state.get('owner'),
    })
    was_generating, generation_before = request_music_generation_cancel()
    request_id = generation_before.get('request_id')
    upstream_closed = close_music_generation_upstream(request_id)
    with accelerator_lock:
        service_result = unload_ace_models()
        accelerator_state['owner'] = 'idle'
        accelerator_state['last_error'] = None
        accelerator_state['updated_at'] = time.time()
    generation_after = wait_for_music_generation_idle(
        timeout=MUSIC_GENERATION_STOP_GRACE_SECONDS
    )
    forced_cleanup = False
    if (
        was_generating
        and generation_after.get('active')
        and generation_after.get('request_id') == request_id
    ):
        forced_cleanup = True
        record_music_diagnostic(
            'stop_forced_state_cleanup',
            trace_id=trace_id,
            request_id=request_id,
            level='warning',
            details={
                'reason': 'Generation worker did not exit within the stop grace period.',
                'grace_seconds': MUSIC_GENERATION_STOP_GRACE_SECONDS,
                'service_status': service_result.get('status'),
                'upstream_socket_closed': upstream_closed,
            },
        )
        finish_music_generation(
            request_id,
            'cancelled',
            error_code='MUSIC_GENERATION_CANCELLED',
            http_status=409,
        )
        generation_after = get_music_generation_snapshot()

    if generation_after.get('active') and generation_after.get('request_id') == request_id:
        raise RuntimeError('Music generation state remained active after forced cancellation.')
    record_music_diagnostic('stop_completed', trace_id=trace_id, request_id=generation_before.get('request_id'), details={
        'stopped_active_generation': was_generating,
        'generation_active': generation_after.get('active'),
        'last_result': generation_after.get('last_result'),
        'service_status': service_result.get('status'),
        'upstream_socket_closed': upstream_closed,
        'forced_state_cleanup': forced_cleanup,
    })
    return {
        'service': service_result,
        'stopped_active_generation': was_generating,
        'upstream_socket_closed': upstream_closed,
        'forced_state_cleanup': forced_cleanup,
        'generation_before': generation_before,
        'generation': generation_after,
    }

def required_llm_free_mb(model_name):
    name = (model_name or '').lower()
    if '26b' in name:
        return 15360
    if 'e4b' in name or '12b' in name:
        return 10240
    if 'e2b' in name:
        return 6144
    return 8192

def get_accelerator_snapshot():
    ace = get_ace_health()
    ollama = get_ollama_runtime_status()
    gpu = get_gpu_memory_status()
    owner = accelerator_state['owner']
    inferred_owner = owner
    conflict = False
    if ace['status'] == 'ok':
        if owner == 'llm' or ollama['models']:
            conflict = True
        if owner == 'idle':
            inferred_owner = 'music'
    elif ollama['models'] and owner == 'idle':
        inferred_owner = 'llm'
    return {
        'owner': owner,
        'inferred_owner': inferred_owner,
        'transitioning': accelerator_state['transitioning'],
        'last_error': accelerator_state['last_error'],
        'updated_at': accelerator_state['updated_at'],
        'active_vram_profile': active_vram_profile,
        'music_generation': get_music_generation_snapshot(),
        'ace': ace,
        'ollama': ollama,
        'gpu': gpu,
        'conflict': conflict,
    }

def build_music_diagnostic_report(limit=100):
    checkpoint_root = auto_resolve_ace_path(
        active_ace_path or r'D:\ComfyUI\ACE-Step-1.5'
    )
    try:
        model_integrity = inspect_music_models(checkpoint_root)
    except Exception as exc:
        model_integrity = {'error': sanitize_diagnostic_text(exc)}
    try:
        accelerator = get_accelerator_snapshot()
    except Exception as exc:
        accelerator = {'error': sanitize_diagnostic_text(exc)}
    return {
        'schema_version': 1,
        'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'privacy': 'Prompts, lyrics, message content, and generated audio are excluded or redacted.',
        'helper': {
            'pid': os.getpid(),
            'started_at': HELPER_STARTED_AT,
            'uptime_seconds': round(time.time() - HELPER_STARTED_AT, 3),
            'platform': platform.platform(),
            'python': platform.python_version(),
        },
        'music': {
            'checkpoint_root': checkpoint_root,
            'active_model': active_music_model,
            'active_vram_profile': active_vram_profile,
            'generation': get_music_generation_snapshot(),
            'model_integrity': model_integrity,
        },
        'accelerator': accelerator,
        'recent_events': get_recent_music_diagnostics(limit),
    }

def transition_accelerator(target_owner, music_model=None, llm_model=None, vram_profile=None):
    if target_owner not in ('idle', 'llm', 'music'):
        raise ValueError(f"Unsupported accelerator owner: {target_owner}")

    if not accelerator_lock.acquire(timeout=1):
        raise RuntimeError('The accelerator is busy generating a track. Wait for generation to finish before switching models.')
    try:
        generation = get_music_generation_snapshot()
        if generation['active'] and target_owner != 'music':
            raise RuntimeError('A track is currently generating. Use Stop Generation before switching GPU owners.')
        accelerator_state['transitioning'] = True
        accelerator_state['last_error'] = None
        accelerator_state['updated_at'] = time.time()
        try:
            current = get_accelerator_snapshot()
            if target_owner == 'llm' and current['owner'] == 'llm' and current['ace']['status'] in ('lazy', 'offline'):
                accelerator_state['transitioning'] = False
                return get_accelerator_snapshot()
            if target_owner == 'music' and current['owner'] == 'music' and current['ace']['status'] == 'ok' and not current['ollama']['models']:
                accelerator_state['transitioning'] = False
                return get_accelerator_snapshot()
            if target_owner == 'music':
                unload_ollama_models()
                gpu = get_gpu_memory_status()
                ace = get_ace_health()
                if vram_profile == 'high' and gpu and gpu['total_mb'] < 20480:
                    raise RuntimeError('The high VRAM profile requires at least 20 GB. Use optimized on this GPU.')
                if ace['status'] != 'ok' and gpu:
                    minimum_free = required_music_free_mb(music_model)
                    if gpu['free_mb'] < minimum_free:
                        raise RuntimeError(
                            f"Only {gpu['free_mb']} MB VRAM is free; {minimum_free} MB is required before loading {music_model or 'the music model'}."
                        )
            elif target_owner == 'llm':
                unload_ace_models()
                gpu = get_gpu_memory_status()
                ollama = get_ollama_runtime_status()
                if gpu and not ollama['models']:
                    minimum_free = required_llm_free_mb(llm_model)
                    if gpu['free_mb'] < minimum_free:
                        raise RuntimeError(
                            f"Only {gpu['free_mb']} MB VRAM is free after ACE-Step unload; {minimum_free} MB is required before loading {llm_model or 'the LLM'}. Check for stranded GPU processes."
                        )
            else:
                unload_ollama_models()
                unload_ace_models()

            accelerator_state['owner'] = target_owner
            accelerator_state['updated_at'] = time.time()
            accelerator_state['transitioning'] = False
            return get_accelerator_snapshot()
        except Exception as exc:
            accelerator_state['owner'] = 'idle'
            accelerator_state['last_error'] = str(exc)
            accelerator_state['updated_at'] = time.time()
            raise
        finally:
            accelerator_state['transitioning'] = False
    finally:
        accelerator_lock.release()

def kill_openrouter_processes():
    import subprocess
    import platform
    try:
        if platform.system() == 'Windows':
            cmd = 'powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'python.exe\'\\" | Where-Object {$_.CommandLine -like \'*openrouter_api_server*\'} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"'
            subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.run("pkill -f openrouter_api_server", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"[Launcher] Error killing openrouter processes: {e}")

def kill_port_process(port):
    import subprocess
    import platform
    import re
    try:
        if platform.system() == 'Windows':
            output = subprocess.check_output(
                ['netstat', '-ano'],
                text=True,
                timeout=5,
                errors='ignore',
            )
            pids = set()
            for line in output.strip().split('\n'):
                line = line.strip()
                if not line:
                    continue
                parts = re.split(r'\s+', line)
                if len(parts) >= 5 and parts[1].endswith(f':{port}'):
                    pid = parts[-1]
                    if pid.isdigit() and int(pid) > 0:
                        pids.add(int(pid))
            for pid in pids:
                print(f"[Launcher] Killing process {pid} on port {port}")
                subprocess.run(
                    ['taskkill', '/F', '/T', '/PID', str(pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10,
                    check=False,
                )
        else:
            # Unix/Mac
            output = subprocess.check_output(
                ['lsof', '-t', f'-i:{port}'],
                text=True,
                timeout=5,
                errors='ignore',
            )
            pids = [int(p) for p in output.strip().split('\n') if p.isdigit()]
            for pid in pids:
                print(f"[Launcher] Killing process {pid} on port {port}")
                subprocess.run(
                    ['kill', '-9', str(pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10,
                    check=False,
                )
        return True
    except Exception as e:
        print(f"[Launcher] Error killing process on port {port}: {e}")
        return False

def get_available_drives():
    import platform
    if platform.system() == 'Windows':
        import string
        from ctypes import windll
        drives = []
        bitmask = windll.kernel32.GetLogicalDrives()
        for letter in string.ascii_uppercase:
            if bitmask & 1:
                drives.append(f"{letter}:\\")
            bitmask >>= 1
        return drives
    return ['/']

def resolve_fallback_path(path):
    if not path:
        return path
    import platform
    if platform.system() != 'Windows':
        return path
    
    # Extract the drive letter
    drive, tail = os.path.splitdrive(path)
    if not drive:
        return path
        
    drive_upper = drive.upper()
    drive_check = drive_upper if drive_upper.endswith('\\') else (drive_upper + '\\')
    
    if os.path.exists(drive_check):
        return path
        
    # Drive does not exist, find first available drive
    drives = get_available_drives()
    if not drives:
        return path
        
    fallback_drive = 'C:\\'
    if fallback_drive not in drives:
        fallback_drive = drives[0]
        
    if tail.startswith('\\') or tail.startswith('/'):
        tail = tail[1:]
    return os.path.join(fallback_drive, tail)

def auto_resolve_ace_path(path):
    path = resolve_fallback_path(path)
    if not path or not os.path.isdir(path):
        return path
    # If the path already has a checkpoints folder, use it
    if os.path.exists(os.path.join(path, "checkpoints")):
        return path
    # If not, check if there's a subdirectory (like ACE-Step-1.5) that does
    try:
        for item in os.listdir(path):
            sub = os.path.join(path, item)
            if os.path.isdir(sub) and not item.startswith('.'):
                if os.path.exists(os.path.join(sub, "checkpoints")):
                    return sub
    except Exception:
        pass
    return path

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

        # 3. Register Gnosys Assistant protocol to run run_backend_hidden.vbs via wscript.exe
        try:
            server_dir = os.path.dirname(os.path.abspath(__file__))
            vbs_path = os.path.join(server_dir, 'run_backend_hidden.vbs')
            if os.path.exists(vbs_path):
                cmd_path = f'wscript.exe "{vbs_path}"'
                subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-assistant', '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                subprocess.run(['reg', 'add', 'HKCU\\Software\\Classes\\gnosys-assistant\\shell\\open\\command', '/ve', '/t', 'REG_SZ', '/d', cmd_path, '/f'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print("[Launcher] Programmatically registered gnosys-assistant:// protocol in HKCU.")
        except Exception as e:
            print(f"[Launcher] Warning: Could not register gnosys-assistant:// protocol: {e}")

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
        global install_thread, install_status
        if self.path == '/api/accelerator/status':
            try:
                response = {
                    'status': 'success',
                    'helper_version': GNOSYS_HELPER_VERSION,
                    'accelerator': get_accelerator_snapshot(),
                }
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as exc:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(exc)}).encode('utf-8'))
        elif self.path.split('?', 1)[0] == '/api/music/diagnostics':
            try:
                import urllib.parse
                parsed_url = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed_url.query)
                requested_limit = params.get('limit', ['100'])[0]
                try:
                    limit = max(1, min(int(requested_limit), 200))
                except (TypeError, ValueError):
                    limit = 100
                response_data = json.dumps({
                    'status': 'success',
                    'report': build_music_diagnostic_report(limit),
                }).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Content-Length', str(len(response_data)))
                self.end_headers()
                self.wfile.write(response_data)
            except Exception as exc:
                response_data = json.dumps({
                    'status': 'error',
                    'error_code': 'MUSIC_DIAGNOSTICS_FAILED',
                    'message': sanitize_diagnostic_text(exc),
                }).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Content-Length', str(len(response_data)))
                self.end_headers()
                self.wfile.write(response_data)
        elif self.path == '/api/hardware-info':
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
                
                model_caps["gemma4:12b"] = classify(8.5, 12.0)
                model_caps["gemma4:e4b"] = classify(11.0, 16.0)
                model_caps["llama3"] = classify(6.0, 8.0)
                model_caps["qwen2.5"] = classify(6.0, 8.0)
                model_caps["mistral"] = classify(5.5, 8.0)
                model_caps["phi3"] = classify(3.5, 6.0)
                model_caps["llama3.2"] = classify(3.0, 4.0)
                
                # Auto recommend best choice
                auto_rec = "llama3.2"
                if model_caps["gemma4:12b"] == "recommended":
                    auto_rec = "gemma4:12b"
                elif model_caps["gemma4:e4b"] == "recommended":
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
        elif self.path == '/api/playlists':
            try:
                import playlists_manager
                playlists_data = playlists_manager.read_playlists()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(playlists_data).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/generation/status':
            generation = get_music_generation_realtime_snapshot()
            response_data = json.dumps({
                'status': 'success',
                'generation': generation,
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            if generation.get('trace_id'):
                self.send_header('X-Gnosys-Trace-Id', generation['trace_id'])
            if generation.get('request_id'):
                self.send_header('X-Gnosys-Request-Id', generation['request_id'])
            self.send_header('Content-Length', str(len(response_data)))
            self.end_headers()
            self.wfile.write(response_data)
        elif self.path in ['/api/music/status', '/api/music/install-status', '/api/music/auto-detect', '/api/music/models']:
            self.do_POST()
        else:
            super().do_GET()
    def do_OPTIONS(self):
        # Respond to CORS preflight requests
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-ComfyUI-Path, X-Gnosys-Trace-Id, X-Gnosys-Client-Id')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def do_POST(self):
        global active_vram_profile, active_music_model, active_ace_path, managed_ace_process
        request_origin = self.headers.get('Origin')
        if request_origin and request_origin not in ALLOWED_WEB_ORIGINS:
            self.send_response(403)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'error',
                'message': 'This origin is not allowed to control the local Gnosys helper.',
            }).encode('utf-8'))
            return
        if self.path == '/api/accelerator/acquire':
            trace_id = make_music_trace_id(self.headers.get('X-Gnosys-Trace-Id'))
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length else {}
                target_owner = body.get('owner', 'idle')
                if target_owner == 'music' or body.get('trace_id'):
                    record_music_diagnostic('accelerator_transition_requested', trace_id=trace_id, details={
                        'target_owner': target_owner,
                        'music_model': body.get('music_model'),
                        'vram_profile': body.get('vram_profile'),
                    })
                snapshot = transition_accelerator(
                    target_owner,
                    music_model=body.get('music_model'),
                    llm_model=body.get('llm_model'),
                    vram_profile=body.get('vram_profile'),
                )
                response_data = json.dumps({
                    'status': 'success',
                    'trace_id': trace_id,
                    'accelerator': snapshot,
                }).encode('utf-8')
                if target_owner == 'music' or body.get('trace_id'):
                    record_music_diagnostic('accelerator_transition_completed', trace_id=trace_id, details={
                        'target_owner': target_owner,
                        'actual_owner': snapshot.get('owner'),
                        'gpu': snapshot.get('gpu'),
                    })
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('X-Gnosys-Trace-Id', trace_id)
                self.send_header('Content-Length', str(len(response_data)))
                self.end_headers()
                self.wfile.write(response_data)
            except Exception as exc:
                response_data = json.dumps({
                    'status': 'error',
                    'error_code': 'MUSIC_ACCELERATOR_TRANSITION_FAILED',
                    'message': sanitize_diagnostic_text(exc),
                    'trace_id': trace_id,
                    'retryable': True,
                    'suggested_action': 'Reset VRAM, confirm no track is already running, and retry.',
                }).encode('utf-8')
                record_music_diagnostic('accelerator_transition_failed', trace_id=trace_id, level='error', details={
                    'error_code': 'MUSIC_ACCELERATOR_TRANSITION_FAILED',
                    'message': sanitize_diagnostic_text(exc),
                })
                self.send_response(409)
                self.send_header('Content-type', 'application/json')
                self.send_header('X-Gnosys-Trace-Id', trace_id)
                self.send_header('Content-Length', str(len(response_data)))
                self.end_headers()
                self.wfile.write(response_data)
        elif self.path == '/api/launch-ollama':
            try:
                system = platform.system()
                print(f"[Launcher] Request received. Launching Ollama on {system}...")

                ollama_status = get_ollama_runtime_status()
                if ollama_status['online']:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'success',
                        'message': 'Ollama is already running; no duplicate process was started.',
                    }).encode('utf-8'))
                    return
                
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
                ace_path = auto_resolve_ace_path(ace_path)
                    
                ace_installed = os.path.exists(ace_path)
                
                # Probe HTTP status on port 8002 if tcp socket is open
                ace_running = False
                comfy_state = "offline"
                if probe_port(8002):
                    try:
                        req = urllib.request.Request("http://127.0.0.1:8002/health")
                        with urllib.request.urlopen(req, timeout=1.0) as res:
                            health_data = json.loads(res.read().decode('utf-8'))
                            comfy_state = health_data.get("status", "ok")
                            ace_running = True
                    except Exception:
                        # Port is open but server is booting / non-responsive yet
                        ace_running = True
                        comfy_state = "loading"
                
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

                # Verify checkpoint weights, not just directory names. Hugging Face
                # creates the target directory and index before all shards finish.
                model_integrity = inspect_music_models(ace_path)
                xl_sft_found = model_integrity['xl_sft']['installed']
                xl_turbo_found = model_integrity['xl_turbo']['installed']
                turbo_found = model_integrity['turbo']['installed']
                check_file = lambda sub1, sub2: os.path.exists(os.path.join(ace_path, sub1)) or os.path.exists(os.path.join(ace_path, sub2))
                xl_base_found = check_file("checkpoints/acestep-v15-xl-base", "checkpoints/acestep-v15-xl-base.safetensors")
                vocoder_found = check_file("models/TTS/ACE-Step-v1-3.5B/music_vocoder", "music_vocoder") or check_file("models/checkpoints/music_vocoder", "music_vocoder")
                dcae_found = check_file("models/TTS/ACE-Step-v1-3.5B/music_dcae_f8c8", "music_dcae_f8c8") or check_file("models/checkpoints/music_dcae_f8c8", "music_dcae_f8c8")
                umt5_found = check_file("models/TTS/ACE-Step-v1-3.5B/umt5-base", "umt5-base") or check_file("models/checkpoints/umt5-base", "umt5-base")

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'status': 'success',
                    'helper_version': GNOSYS_HELPER_VERSION,
                    'comfy_path': ace_path,
                    'comfy_installed': ace_installed,
                    'comfy_running': ace_running,
                    'comfy_state': comfy_state,
                    'active_vram_profile': active_vram_profile,
                    'active_music_model': active_music_model,
                    'accelerator_owner': accelerator_state['owner'],
                    'generation': get_music_generation_snapshot(),
                    'custom_node_installed': True, # Mock true for backward compatibility
                    'models_installed': len(discovered_models) > 0,
                    'active_downloads': active_downloads,
                    'active_downloads_status': active_downloads_status,
                    'scan_details': {
                        'models': discovered_models
                     },
                    'diagnostics': {
                        'xl_sft': xl_sft_found,
                        'xl_base': xl_base_found,
                        'xl_turbo': xl_turbo_found,
                        'turbo': turbo_found,
                        'vocoder': vocoder_found,
                        'dcae': dcae_found,
                        'umt5': umt5_found
                    },
                    'model_integrity': model_integrity,
                }
                active_ace_path = ace_path
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
                vram_profile = 'optimized'
                music_model = DEFAULT_MUSIC_MODEL
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = json.loads(self.rfile.read(content_length).decode('utf-8'))
                    ace_path = body.get('comfy_path', ace_path)
                    vram_profile = body.get('vram_profile', 'optimized')
                    music_model = normalize_music_model(body.get('music_model'))
                ace_path = auto_resolve_ace_path(ace_path)
                active_ace_path = ace_path

                gpu_status = get_gpu_memory_status()
                profile_adjusted = False
                if vram_profile == 'high' and gpu_status and gpu_status['total_mb'] < 20480:
                    vram_profile = 'optimized'
                    profile_adjusted = True

                # A warm server can switch models in-place. A lazy server must
                # have been launched with the requested initial model, otherwise
                # ACE-Step loads its larger default before switching models.
                ace_health = get_ace_health()
                can_share_server = (
                    ace_health['online']
                    and active_vram_profile == vram_profile
                    and (ace_health['status'] == 'ok' or active_music_model == music_model)
                )
                if can_share_server:
                    print(f"[Launcher] API Server is already active on port 8002 with '{vram_profile}' profile. Sharing instance.")
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'success',
                        'message': 'API Server is already running.',
                        'vram_profile': vram_profile,
                        'music_model': active_music_model or music_model,
                        'profile_adjusted': profile_adjusted,
                    }).encode('utf-8'))
                    return

                # Terminate any starting/running API processes to prevent concurrent duplicates
                print(f"[Launcher] Port 8002 mismatch or server offline. Cleaning up any openrouter processes...")
                kill_openrouter_processes()
                if probe_port(8002):
                    kill_port_process(8002)
                    time.sleep(1.0)
                active_vram_profile = None
                active_music_model = None

                # Launch environment copy with lazy loading enabled
                env_copy = os.environ.copy()
                env_copy["ACESTEP_NO_INIT"] = "true"
                env_copy["ACESTEP_CONFIG_PATH"] = music_model

                python_exe = os.path.join(ace_path, '.venv', 'Scripts', 'python.exe')
                
                if not os.path.exists(ace_path):
                    raise Exception(f"ACE-Step directory not found at {ace_path}")
                
                if os.path.exists(python_exe):
                    # Launch API server using venv Python
                    cmd = [python_exe, '-m', 'openrouter.openrouter_api_server', '--host', '127.0.0.1', '--port', '8002']
                    if vram_profile == 'low':
                        cmd.append('--lowvram')
                    elif vram_profile == 'optimized':
                        cmd.append('--medvram')
                    managed_ace_process = subprocess.Popen(cmd, cwd=ace_path, env=env_copy)
                    msg = f"Launched ACE-Step API Server ({vram_profile} VRAM) via venv python"
                else:
                    # Fallback to system python
                    cmd = ['python', '-m', 'openrouter.openrouter_api_server', '--host', '127.0.0.1', '--port', '8002']
                    if vram_profile == 'low':
                        cmd.append('--lowvram')
                    elif vram_profile == 'optimized':
                        cmd.append('--medvram')
                    managed_ace_process = subprocess.Popen(cmd, cwd=ace_path, env=env_copy)
                    msg = f"Launched ACE-Step API Server ({vram_profile} VRAM) via system python"

                active_vram_profile = vram_profile
                active_music_model = music_model

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': msg,
                    'vram_profile': vram_profile,
                    'music_model': music_model,
                    'profile_adjusted': profile_adjusted,
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/install':
            # Run installation in background thread
            global install_status
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length > 0 else {}
                target_path = body.get('install_path', 'D:\\ComfyUI')
                target_path = resolve_fallback_path(target_path)
                
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
                            
                        # Step 4: Create Python Virtual Environment (.venv)
                        import sys
                        venv_path = os.path.join(comfy_root, '.venv')
                        python_exe = os.path.join(venv_path, 'Scripts', 'python.exe') if platform.system() == 'Windows' else os.path.join(venv_path, 'bin', 'python')
                        
                        if not os.path.exists(venv_path) or not os.path.exists(python_exe):
                            install_status['step'] = 'Creating Python Virtual Environment (.venv)'
                            install_status['progress'] = 82
                            subprocess.run([sys.executable, '-m', 'venv', venv_path], check=True)
                        
                        # Step 5: Install Python dependencies
                        pip_exe = os.path.join(venv_path, 'Scripts', 'pip.exe') if platform.system() == 'Windows' else os.path.join(venv_path, 'bin', 'pip')
                        
                        # Install ComfyUI Core dependencies
                        comfy_reqs = os.path.join(comfy_root, 'requirements.txt')
                        if os.path.exists(comfy_reqs):
                            install_status['step'] = 'Installing ComfyUI Core Dependencies'
                            install_status['progress'] = 85
                            subprocess.run([pip_exe, 'install', '-r', comfy_reqs], check=True)
                        
                        # Install Custom Node requirements + huggingface_hub
                        requirements_file = os.path.join(node_path, 'requirements.txt')
                        if os.path.exists(requirements_file):
                            install_status['step'] = 'Installing ACE-Step Node Dependencies'
                            install_status['progress'] = 92
                            subprocess.run([pip_exe, 'install', '-r', requirements_file, 'huggingface_hub'], check=True)
                            
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
            trace_id = make_music_trace_id(self.headers.get('X-Gnosys-Trace-Id'))
            generation_id = None
            generation_result = 'failed'
            generation_error = None
            generation_error_code = None
            generation_http_status = None
            request_started_at = time.time()
            diagnostic_stage = 'request_received'
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = self.rfile.read(content_length)
                record_music_diagnostic('request_received', trace_id=trace_id, details={
                    'content_bytes': content_length,
                    'origin': self.headers.get('Origin'),
                    'client_id': self.headers.get('X-Gnosys-Client-Id'),
                })
                try:
                    generation_request = json.loads(payload.decode('utf-8'))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    generation_http_status = 400
                    generation_error_code = 'MUSIC_INVALID_REQUEST'
                    error_data = json.dumps({
                        'status': 'error',
                        'error_code': generation_error_code,
                        'message': 'Music generation requires a valid JSON request body.',
                        'trace_id': trace_id,
                        'retryable': False,
                        'suggested_action': 'Reload the Music Studio and try again.',
                    }).encode('utf-8')
                    record_music_diagnostic('request_rejected', trace_id=trace_id, level='error', details={
                        'error_code': generation_error_code,
                        'http_status': generation_http_status,
                    })
                    self.send_response(generation_http_status)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('X-Gnosys-Trace-Id', trace_id)
                    self.send_header('Content-Length', str(len(error_data)))
                    self.end_headers()
                    self.wfile.write(error_data)
                    return

                requested_model = normalize_music_model(generation_request.get('model'))
                request_summary = summarize_music_request(generation_request)
                # ACE-Step's OpenRouter-compatible server emits a genuine SSE
                # heartbeat every two seconds while its generation future runs.
                # The helper consumes that stream and still returns the original
                # non-streaming JSON shape expected by GitHub Pages.
                generation_request['stream'] = True
                payload = json.dumps(generation_request).encode('utf-8')
                record_music_diagnostic('request_validated', trace_id=trace_id, details=request_summary)
                model_key = MUSIC_MODEL_KEYS.get(requested_model)
                checkpoint_root = auto_resolve_ace_path(
                    self.headers.get('X-ComfyUI-Path', '').strip()
                    or active_ace_path
                    or r'D:\ComfyUI\ACE-Step-1.5'
                )
                if model_key:
                    integrity = inspect_music_model(checkpoint_root, model_key)
                    if not integrity['installed']:
                        missing = integrity.get('missing_files') or []
                        missing_summary = ', '.join(missing[:4]) or 'model weight files'
                        generation_http_status = 409
                        generation_error_code = 'MUSIC_CHECKPOINT_REPAIR_REQUIRED'
                        error_data = json.dumps({
                            'status': 'repair_required',
                            'error_code': generation_error_code,
                            'message': (
                                f'{requested_model} is incomplete. Missing: {missing_summary}. '
                                'Use the model badge or Download All Missing Models to resume the checkpoint download.'
                            ),
                            'trace_id': trace_id,
                            'retryable': False,
                            'suggested_action': 'Repair or finish downloading the selected model, then retry.',
                            'model': requested_model,
                            'integrity': integrity,
                        }).encode('utf-8')
                        record_music_diagnostic('checkpoint_rejected', trace_id=trace_id, level='error', details={
                            'error_code': generation_error_code,
                            'http_status': generation_http_status,
                            'model': requested_model,
                            'integrity_state': integrity.get('state'),
                            'missing_files': missing,
                            'invalid_files': integrity.get('invalid_files') or [],
                        })
                        self.send_response(generation_http_status)
                        self.send_header('Content-type', 'application/json')
                        self.send_header('X-Gnosys-Trace-Id', trace_id)
                        self.send_header('Content-Length', str(len(error_data)))
                        self.end_headers()
                        self.wfile.write(error_data)
                        return

                # Keep generation compatible with an older or cached GitHub
                # Pages frontend. The current UI acquires music ownership before
                # this request, but the backend must also be able to recover after
                # a helper restart, which resets its in-memory owner to idle.
                diagnostic_stage = 'accelerator_preparation'
                record_music_diagnostic('accelerator_preparation_started', trace_id=trace_id, details={
                    'current_owner': accelerator_state['owner'],
                    'requested_model': requested_model,
                    'vram_profile': active_vram_profile or 'optimized',
                })
                if accelerator_state['owner'] != 'music':
                    transition_accelerator(
                        'music',
                        music_model=generation_request.get('model'),
                        vram_profile=active_vram_profile or 'optimized',
                    )

                with accelerator_lock:
                    if accelerator_state['owner'] != 'music':
                        raise RuntimeError('Music does not own the accelerator. Complete the VRAM transition before generating.')
                    generation_id = begin_music_generation(
                        requested_model,
                        trace_id=trace_id,
                        request_summary=request_summary,
                    )

                if generation_id is None:
                    generation = get_music_generation_snapshot()
                    generation_http_status = 409
                    generation_error_code = 'MUSIC_GENERATION_IN_PROGRESS'
                    error_data = json.dumps({
                        'status': 'generation_in_progress',
                        'error_code': generation_error_code,
                        'message': 'A track is already being generated. Use Stop Generation to cancel it before starting another.',
                        'trace_id': trace_id,
                        'active_request_id': generation.get('request_id'),
                        'active_trace_id': generation.get('trace_id'),
                        'retryable': True,
                        'suggested_action': 'Wait for the active track or use Stop Generation before retrying.',
                        'generation': generation,
                    }).encode('utf-8')
                    record_music_diagnostic('duplicate_request_rejected', trace_id=trace_id, level='warning', details={
                        'error_code': generation_error_code,
                        'http_status': generation_http_status,
                        'active_request_id': generation.get('request_id'),
                        'active_trace_id': generation.get('trace_id'),
                    })
                    self.send_response(generation_http_status)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('X-Gnosys-Trace-Id', trace_id)
                    self.send_header('Content-Length', str(len(error_data)))
                    self.end_headers()
                    self.wfile.write(error_data)
                    return

                diagnostic_stage = 'connecting_to_ace'
                update_music_generation_stage(
                    generation_id,
                    diagnostic_stage,
                    monitor_message='Opening ACE-Step’s live generation stream.',
                )
                record_music_diagnostic('generation_started', trace_id=trace_id, request_id=generation_id, details=request_summary)
                # Inference runs without the coordinator lock so the Stop
                # Generation endpoint can terminate ACE-Step immediately.
                diagnostic_stage = 'ace_step_initializing'
                update_music_generation_stage(
                    generation_id,
                    diagnostic_stage,
                    monitor_message='ACE-Step is loading or preparing the selected model. A cold XL load reads ~20 GB from disk into system RAM first, so GPU memory can stay low for several minutes — this is normal.',
                )
                response_conn = open_music_generation_upstream(
                    payload,
                    generation_id,
                    trace_id,
                )
                try:
                    response_data = read_ace_generation_response(
                        response_conn,
                        generation_id,
                        requested_model,
                    )
                finally:
                    close_music_generation_upstream(generation_id)

                diagnostic_stage = 'validating_audio'
                update_music_generation_stage(
                    generation_id,
                    diagnostic_stage,
                    monitor_message='The audio arrived; Gnosys is validating and returning it to the player.',
                )
                if music_generation_was_cancelled(generation_id):
                    raise RuntimeError('Generation cancelled by user.')

                active_music_model = requested_model
                generation_result = 'completed'
                generation_http_status = 200
                record_music_diagnostic('generation_completed', trace_id=trace_id, request_id=generation_id, details={
                    'http_status': generation_http_status,
                    'response_bytes': len(response_data),
                    'elapsed_seconds': round(time.time() - request_started_at, 3),
                })
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('X-Gnosys-Trace-Id', trace_id)
                self.send_header('X-Gnosys-Request-Id', generation_id)
                self.send_header('Content-Length', str(len(response_data)))
                self.end_headers()
                self.wfile.write(response_data)
            except urllib.error.HTTPError as he:
                cancelled = generation_id and music_generation_was_cancelled(generation_id)
                if cancelled:
                    generation_error = None
                    generation_error_code = 'MUSIC_GENERATION_CANCELLED'
                    generation_http_status = 409
                    message = 'Track generation was stopped.'
                    suggested_action = 'Start a new track when you are ready.'
                else:
                    upstream_body = he.read()
                    generation_error = extract_upstream_error(upstream_body)
                    generation_error_code = 'MUSIC_ACE_STEP_HTTP_ERROR'
                    generation_http_status = he.code
                    message = generation_error or f'ACE-Step returned HTTP {he.code}.'
                    suggested_action = 'Download the diagnostic report, then check the selected model and ACE-Step service state.'
                error_data = json.dumps({
                    'status': 'cancelled' if cancelled else 'error',
                    'error_code': generation_error_code,
                    'message': message,
                    'trace_id': trace_id,
                    'request_id': generation_id,
                    'upstream_status': None if cancelled else he.code,
                    'stage': diagnostic_stage,
                    'retryable': not cancelled,
                    'suggested_action': suggested_action,
                }).encode('utf-8')
                record_music_diagnostic(
                    'generation_cancelled' if cancelled else 'ace_step_http_error',
                    trace_id=trace_id,
                    request_id=generation_id,
                    level='warning' if cancelled else 'error',
                    details={
                        'error_code': generation_error_code,
                        'http_status': generation_http_status,
                        'stage': diagnostic_stage,
                        'message': message,
                        'elapsed_seconds': round(time.time() - request_started_at, 3),
                    },
                )
                self.send_response(generation_http_status)
                self.send_header('Content-type', 'application/json')
                self.send_header('X-Gnosys-Trace-Id', trace_id)
                if generation_id:
                    self.send_header('X-Gnosys-Request-Id', generation_id)
                self.send_header('Content-Length', str(len(error_data)))
                self.end_headers()
                self.wfile.write(error_data)
            except (
                urllib.error.URLError,
                http.client.HTTPException,
                ConnectionError,
                TimeoutError,
                RuntimeError,
            ) as exc:
                cancelled = generation_id and music_generation_was_cancelled(generation_id)
                generation_error = None if cancelled else sanitize_diagnostic_text(exc)
                if cancelled:
                    generation_error_code = 'MUSIC_GENERATION_CANCELLED'
                    generation_http_status = 409
                    suggested_action = 'Start a new track when you are ready.'
                elif isinstance(exc, TimeoutError):
                    generation_error_code = 'MUSIC_GENERATION_TIMEOUT'
                    generation_http_status = 504
                    suggested_action = 'Stop the service, use the optimized VRAM profile, and retry with a shorter track.'
                elif generation_id is None:
                    generation_error_code = 'MUSIC_ACCELERATOR_PREPARATION_FAILED'
                    generation_http_status = 503
                    suggested_action = 'Reset VRAM, confirm no other GPU job is active, and retry.'
                else:
                    generation_error_code = 'MUSIC_ACE_STEP_UNAVAILABLE'
                    generation_http_status = 503
                    suggested_action = 'Restart the ACE-Step service and retry. Download diagnostics if it happens again.'
                message = 'Track generation was stopped.' if cancelled else generation_error
                error_data = json.dumps({
                    'status': 'cancelled' if cancelled else 'error',
                    'error_code': generation_error_code,
                    'message': message,
                    'trace_id': trace_id,
                    'request_id': generation_id,
                    'stage': diagnostic_stage,
                    'retryable': not cancelled,
                    'suggested_action': suggested_action,
                }).encode('utf-8')
                record_music_diagnostic(
                    'generation_cancelled' if cancelled else 'generation_transport_error',
                    trace_id=trace_id,
                    request_id=generation_id,
                    level='warning' if cancelled else 'error',
                    details={
                        'error_code': generation_error_code,
                        'http_status': generation_http_status,
                        'stage': diagnostic_stage,
                        'message': message,
                        'elapsed_seconds': round(time.time() - request_started_at, 3),
                    },
                )
                self.send_response(generation_http_status)
                self.send_header('Content-type', 'application/json')
                self.send_header('X-Gnosys-Trace-Id', trace_id)
                if generation_id:
                    self.send_header('X-Gnosys-Request-Id', generation_id)
                self.send_header('Content-Length', str(len(error_data)))
                self.end_headers()
                self.wfile.write(error_data)
            except Exception as exc:
                cancelled = generation_id and music_generation_was_cancelled(generation_id)
                generation_error = None if cancelled else sanitize_diagnostic_text(exc)
                generation_error_code = 'MUSIC_GENERATION_CANCELLED' if cancelled else 'MUSIC_GENERATION_INTERNAL_ERROR'
                generation_http_status = 409 if cancelled else 500
                message = 'Track generation was stopped.' if cancelled else generation_error
                error_data = json.dumps({
                    'status': 'cancelled' if cancelled else 'error',
                    'error_code': generation_error_code,
                    'message': message,
                    'trace_id': trace_id,
                    'request_id': generation_id,
                    'stage': diagnostic_stage,
                    'retryable': not cancelled,
                    'suggested_action': 'Download the diagnostic report and restart the local helper before retrying.',
                }).encode('utf-8')
                record_music_diagnostic(
                    'generation_cancelled' if cancelled else 'generation_internal_error',
                    trace_id=trace_id,
                    request_id=generation_id,
                    level='warning' if cancelled else 'error',
                    details={
                        'error_code': generation_error_code,
                        'http_status': generation_http_status,
                        'stage': diagnostic_stage,
                        'exception_type': type(exc).__name__,
                        'message': message,
                        'elapsed_seconds': round(time.time() - request_started_at, 3),
                    },
                )
                self.send_response(generation_http_status)
                self.send_header('Content-type', 'application/json')
                self.send_header('X-Gnosys-Trace-Id', trace_id)
                if generation_id:
                    self.send_header('X-Gnosys-Request-Id', generation_id)
                self.send_header('Content-Length', str(len(error_data)))
                self.end_headers()
                self.wfile.write(error_data)
            finally:
                if generation_id is not None:
                    close_music_generation_upstream(generation_id)
                if generation_id is not None:
                    finish_music_generation(
                        generation_id,
                        generation_result,
                        generation_error,
                        generation_error_code,
                        generation_http_status,
                    )
        elif self.path == '/api/music/unload':
            try:
                result = stop_music_service()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'result': result}).encode('utf-8'))
            except Exception as e:
                accelerator_state['last_error'] = str(e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/stop':
            try:
                print("[Launcher] Stopping active music generation and ACE-Step service...")
                result = stop_music_service()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'message': (
                        'Track generation stopped and ACE-Step service shut down.'
                        if result['stopped_active_generation']
                        else 'ACE-Step service stopped successfully.'
                    ),
                    'result': result,
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/models':
            try:
                req = urllib.request.Request('http://127.0.0.1:8002/v1/models')
                with urllib.request.urlopen(req, timeout=10) as response_conn:
                    response_data = response_conn.read()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(response_data)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/download':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                repo_id = str(payload.get('repo_id') or '').strip()
                target_dir = str(payload.get('target_dir') or '').strip()
                allowed_repos = {
                    spec['repo_id'] for spec in MUSIC_MODEL_ARTIFACTS.values()
                } | {'Comfy-Org/ACE-Step_ComfyUI_repackaged'}
                if repo_id not in allowed_repos:
                    raise ValueError('Unsupported model repository.')
                if not target_dir:
                    raise ValueError('A model target directory is required.')
                existing_process = active_download_processes.get(repo_id)
                if existing_process is not None and existing_process.poll() is None:
                    raise RuntimeError(f'A download for {repo_id} is already running.')
                
                # Check ACE-Step virtual environment python first (from path header)
                ace_path = self.headers.get('X-ComfyUI-Path', '').strip() or 'D:\\ComfyUI\\ACE-Step-1.5'
                ace_path = auto_resolve_ace_path(ace_path)
                ace_root = os.path.abspath(ace_path)
                target_dir = os.path.abspath(target_dir)
                try:
                    target_is_safe = os.path.commonpath([ace_root, target_dir]) == ace_root
                except ValueError:
                    target_is_safe = False
                if not target_is_safe:
                    raise ValueError('The download target must be inside the selected ACE-Step installation.')
                ace_python = os.path.join(ace_path, '.venv', 'Scripts', 'python.exe')
                
                # Check helper server virtual environment python
                server_dir = os.path.dirname(os.path.abspath(__file__))
                venv_python = os.path.join(server_dir, '.venv', 'Scripts', 'python.exe')
                
                if os.path.exists(ace_python):
                    python_exe = ace_python
                elif os.path.exists(venv_python):
                    python_exe = venv_python
                else:
                    python_exe = 'python'

                # Pass user-controlled values as argv instead of interpolating
                # them into executable Python source.
                script = (
                    "import sys; "
                    "from huggingface_hub import snapshot_download; "
                    "snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2])"
                )
                preflight = inspect_transformers_checkpoint(target_dir)
                initial_progress = 0
                if preflight.get('expected_bytes') and preflight.get('partial_bytes'):
                    initial_progress = min(99, int(
                        preflight['partial_bytes'] * 100 / preflight['expected_bytes']
                    ))
                
                # Run download in background thread
                import threading as th
                import re
                def download_task():
                    active_downloads[repo_id] = 'downloading'
                    active_downloads_status[repo_id] = {
                        'status': 'downloading',
                        'progress': initial_progress,
                        'speed': '0 MB/s',
                        'eta': '--:--',
                        'error': None,
                    }
                    print(f"[Downloader] Starting download for {repo_id} to {target_dir}...")
                    try:
                        proc = subprocess.Popen(
                            [python_exe, '-u', '-c', script, repo_id, target_dir],
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True,
                            bufsize=1
                        )
                        active_download_processes[repo_id] = proc
                        
                        buffer = ""
                        recent_output = []
                        while True:
                            if proc.poll() is not None:
                                break
                            char = proc.stdout.read(1)
                            if not char:
                                break
                            if char in ('\r', '\n'):
                                line = buffer.strip()
                                buffer = ""
                                if line:
                                    recent_output.append(line)
                                    recent_output = recent_output[-25:]
                                    pct_match = re.search(r'(\d+)%', line)
                                    speed_match = re.search(r'(\d+\.?\d*\s*[kMGT]B/s)', line)
                                    eta_match = re.search(r'\[\d*(?::\d+)*<([0-9:]+)', line)
                                    
                                    updated = False
                                    if repo_id not in active_downloads_status:
                                        active_downloads_status[repo_id] = {'status': 'downloading', 'progress': 0, 'speed': '0 MB/s', 'eta': '--:--'}
                                    
                                    if pct_match:
                                        active_downloads_status[repo_id]['progress'] = max(
                                            active_downloads_status[repo_id].get('progress', 0),
                                            int(pct_match.group(1)),
                                        )
                                        updated = True
                                    if speed_match:
                                        active_downloads_status[repo_id]['speed'] = speed_match.group(1)
                                        updated = True
                                    if eta_match:
                                        active_downloads_status[repo_id]['eta'] = eta_match.group(1)
                                        updated = True
                                        
                                    if updated:
                                        active_downloads[repo_id] = 'downloading'
                            else:
                                buffer += char

                        remainder = proc.stdout.read() if proc.stdout else ''
                        if remainder.strip():
                            recent_output.extend(remainder.strip().splitlines())
                            recent_output = recent_output[-25:]
                        proc.wait()
                        if proc.returncode == 0:
                            model_spec = next(
                                (spec for spec in MUSIC_MODEL_ARTIFACTS.values() if spec['repo_id'] == repo_id),
                                None,
                            )
                            verification = inspect_transformers_checkpoint(target_dir) if model_spec else None
                            if verification is not None and not verification['installed']:
                                active_downloads[repo_id] = 'failed'
                                active_downloads_status[repo_id] = {
                                    'status': 'failed',
                                    'progress': min(99, active_downloads_status[repo_id].get('progress', 0)),
                                    'speed': '0 MB/s',
                                    'eta': '--:--',
                                    'error': verification['message'],
                                }
                                print(f"[Downloader] Verification failed for {repo_id}: {verification['message']}")
                            else:
                                active_downloads[repo_id] = 'success'
                                active_downloads_status[repo_id] = {
                                    'status': 'success',
                                    'progress': 100,
                                    'speed': '0 MB/s',
                                    'eta': '--:--',
                                    'error': None,
                                }
                                print(f"[Downloader] Successfully downloaded and verified {repo_id}!")
                        else:
                            if active_downloads_status.get(repo_id, {}).get('status') == 'stopped':
                                print(f"[Downloader] Download for {repo_id} was stopped by user.")
                            else:
                                active_downloads[repo_id] = 'failed'
                                active_downloads_status[repo_id] = {
                                    'status': 'failed',
                                    'progress': active_downloads_status.get(repo_id, {}).get('progress', 0),
                                    'speed': '0 MB/s',
                                    'eta': '--:--',
                                    'error': '\n'.join(recent_output[-8:]) or f'Downloader exited with code {proc.returncode}',
                                }
                                print(f"[Downloader] Failed to download {repo_id} with exit code {proc.returncode}")
                    except Exception as err:
                        active_downloads[repo_id] = 'failed'
                        active_downloads_status[repo_id] = {
                            'status': 'failed',
                            'progress': active_downloads_status.get(repo_id, {}).get('progress', 0),
                            'speed': '0 MB/s',
                            'eta': '--:--',
                            'error': str(err),
                        }
                        print(f"[Downloader] Failed to download {repo_id}: {err}")
                    finally:
                        active_download_processes.pop(repo_id, None)

                th.Thread(target=download_task, daemon=True).start()

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'message': 'Download started in background.'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/music/download/stop':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                repo_id = payload.get('repo_id')
                
                if repo_id in active_download_processes:
                    proc = active_download_processes[repo_id]
                    active_downloads_status[repo_id] = {
                        'status': 'stopped',
                        'progress': active_downloads_status.get(repo_id, {}).get('progress', 0),
                        'speed': '0 MB/s',
                        'eta': '--:--'
                    }
                    active_downloads[repo_id] = 'failed'
                    proc.terminate()
                    try:
                        proc.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'message': 'Download stopped successfully.'}).encode('utf-8'))
                else:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'No active download found for this repository.'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/playlists/save-track':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                class_id = payload.get('class_id')
                track_name = payload.get('name')
                base64_data = payload.get('audio_base64')
                
                import playlists_manager
                track = playlists_manager.save_track(class_id, track_name, base64_data)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'track': track}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/playlists/rename-track':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                class_id = payload.get('class_id')
                track_id = payload.get('track_id')
                new_name = payload.get('name')
                
                import playlists_manager
                success = playlists_manager.rename_track(class_id, track_id, new_name)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success' if success else 'failed'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/playlists/reorder-tracks':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                class_id = payload.get('class_id')
                track_ids = payload.get('track_ids')
                
                import playlists_manager
                success = playlists_manager.reorder_tracks(class_id, track_ids)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success' if success else 'failed'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/playlists/delete-track':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                class_id = payload.get('class_id')
                track_id = payload.get('track_id')
                
                import playlists_manager
                success = playlists_manager.delete_track(class_id, track_id)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success' if success else 'failed'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/playlists/move-track':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                src_class_id = payload.get('src_class_id')
                dest_class_id = payload.get('dest_class_id')
                track_id = payload.get('track_id')
                
                import playlists_manager
                success = playlists_manager.move_track(src_class_id, dest_class_id, track_id)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success' if success else 'failed'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        elif self.path == '/api/playlists/create':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                payload = json.loads(self.rfile.read(content_length))
                class_name = payload.get('name')
                
                if not class_name:
                    raise ValueError("Playlist name is required")
                
                import playlists_manager
                class_id, playlist = playlists_manager.create_playlist(class_name)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'success',
                    'class_id': class_id,
                    'playlist': playlist
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def send_header(self, keyword, value):
        if keyword.lower() == 'access-control-allow-origin':
            self._cors_sent = True
            request_origin = self.headers.get('Origin', '')
            if request_origin in ALLOWED_WEB_ORIGINS:
                value = request_origin
            else:
                value = 'null'
            super().send_header('Vary', 'Origin')
        super().send_header(keyword, value)

    # Override end_headers to inject CORS into normal GET file requests too
    def end_headers(self):
        if not getattr(self, '_cors_sent', False):
            self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Expose-Headers', 'X-Gnosys-Trace-Id, X-Gnosys-Request-Id')
        super().end_headers()

def run_server():
    # Register URL protocol handler for Windows users
    register_windows_protocol()
    
    # Allow port reuse to avoid 'address already in use' errors on quick restarts (not on Windows)
    if platform.system() != 'Windows':
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        
    try:
        with socketserver.ThreadingTCPServer(("", PORT), GnosysHTTPRequestHandler) as httpd:
            print(f"[Gnosys-AI Server] Listening on http://localhost:{PORT}")
            if os.environ.get('GNOSYS_OPEN_BROWSER', '').lower() in ('1', 'true', 'yes'):
                def open_local_app():
                    try:
                        import webbrowser
                        webbrowser.open(f'http://127.0.0.1:{PORT}/')
                    except Exception as exc:
                        print(f"[Gnosys-AI Server] Could not open local app: {exc}")
                threading.Timer(0.5, open_local_app).start()
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n[Gnosys-AI Server] Shutting down.")
                httpd.server_close()
    except OSError as e:
        import errno
        if e.errno == errno.EADDRINUSE or e.errno == 10048 or "already in use" in str(e).lower():
            print(f"\n[Gnosys-AI Server] PORT {PORT} is already in use. Another instance of the server is likely running.")
        else:
            raise e

if __name__ == '__main__':
    run_server()
