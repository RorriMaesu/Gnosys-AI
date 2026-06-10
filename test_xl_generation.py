import urllib.request
import json
import time

def test_generation():
    print("Testing music generation with XL model...")
    # First, verify if the backend server on 8020 is online
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8020/api/music/status", timeout=5)
        status = json.loads(req.read().decode('utf-8'))
        print("Backend Status:", json.dumps(status, indent=2))
        
        if not status.get("comfy_running", False):
            print("ACE-Step API Server is offline. Triggering launch...")
            launch_req = urllib.request.Request(
                "http://127.0.0.1:8020/api/music/launch",
                data=json.dumps({"vram_profile": "high"}).encode('utf-8'),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(launch_req) as launch_resp:
                print("Launch response:", launch_resp.read().decode('utf-8'))
            
            # Poll for health endpoint on 8002
            print("Waiting for ACE-Step API Server to start on port 8002...")
            started = False
            for attempt in range(30):
                time.sleep(2)
                try:
                    health_req = urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=2)
                    if health_req.getcode() == 200:
                        print("ACE-Step API Server is online!")
                        started = True
                        break
                except Exception:
                    pass
            if not started:
                print("FAIL: ACE-Step API Server failed to start within timeout.")
                return False
    except Exception as e:
        print("Backend server is not running on port 8020. Please ensure you run server.py first.")
        return False

    # Standard payload requesting the XL Turbo model
    payload = {
        "model": "acemusic/acestep-v15-xl-turbo",
        "messages": [
            {
                "role": "user",
                "content": "<prompt>energetic focus synthwave music for programming study</prompt>"
            }
        ],
        "audio_config": {
            "duration": 5.0,
            "bpm": 100,
            "instrumental": True
        },
        "inference_steps": 8,
        "thinking": False,
        "use_format": False,
        "lm_cfg_scale": 2.0,
        "seed": 42
    }

    print("Sending generation request to /api/music/generate...")
    req = urllib.request.Request(
        "http://127.0.0.1:8020/api/music/generate",
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            duration = time.time() - start_time
            print(f"Request completed in {duration:.2f} seconds.")
            
            # Check response format
            choices = res_data.get("choices", [])
            if not choices:
                print("FAIL: No choices returned in response.")
                print(res_data)
                return False
                
            audio_data = choices[0].get("message", {}).get("audio", [])
            if not audio_data:
                print("FAIL: No audio content in response message.")
                print(res_data)
                return False
                
            url = audio_data[0].get("audio_url", {}).get("url", "")
            if url.startswith("data:audio/mpeg;base64,") or url.startswith("data:audio/mp3;base64,") or url.startswith("data:audio/wav;base64,"):
                print("SUCCESS: Generated valid base64 audio response!")
                print("Audio URL starts with:", url[:50] + "...")
                return True
            else:
                print("FAIL: Audio URL is invalid or missing prefix.")
                print("URL:", url[:100])
                return False
    except Exception as e:
        print(f"FAIL: Generation request failed: {e}")
        return False

if __name__ == "__main__":
    test_generation()
