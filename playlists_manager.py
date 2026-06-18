import os
import json
import base64
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVED_TRACKS_DIR = os.path.join(BASE_DIR, 'music', 'saved_tracks')
PLAYLISTS_JSON = os.path.join(SAVED_TRACKS_DIR, 'playlists.json')

DEFAULT_CLASSES = {
    "medical-terminology": "Medical Terminology",
    "intro-to-chemistry": "Intro to Chemistry",
    "chemistry-math-refresher": "Chemistry Math Refresher",
    "clinical-mathematics": "Clinical Mathematics",
    "psychology-care": "Intro to Psychology",
    "anatomy-physiology-1": "Anatomy & Physiology I",
    "anatomy-physiology-2": "Anatomy & Physiology II",
    "anatomy-physiology-3": "Anatomy & Physiology III"
}

def ensure_storage_exists():
    os.makedirs(SAVED_TRACKS_DIR, exist_ok=True)
    if os.path.exists(PLAYLISTS_JSON):
        try:
            with open(PLAYLISTS_JSON, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # Clean up obsolete gnosys-music key
            if "playlists" in data and "gnosys-music" in data["playlists"]:
                del data["playlists"]["gnosys-music"]
                write_playlists(data)
        except Exception:
            pass
    else:
        # Initialize empty playlists structure
        initial_data = {
            "playlists": {
                class_id: {
                    "class_name": class_name,
                    "tracks": []
                } for class_id, class_name in DEFAULT_CLASSES.items()
            }
        }
        write_playlists(initial_data)

def read_playlists():
    ensure_storage_exists()
    try:
        with open(PLAYLISTS_JSON, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("[Playlists Manager] Error reading JSON:", e)
        return {"playlists": {}}

def write_playlists(data):
    try:
        with open(PLAYLISTS_JSON, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print("[Playlists Manager] Error writing JSON:", e)
        return False

def save_track(class_id, track_name, base64_data_str):
    ensure_storage_exists()
    data = read_playlists()
    
    # Ensure playlist for class exists
    if class_id not in data["playlists"]:
        data["playlists"][class_id] = {
            "class_name": DEFAULT_CLASSES.get(class_id, class_id.capitalize()),
            "tracks": []
        }
        
    # Create class-specific folder
    class_folder = os.path.join(SAVED_TRACKS_DIR, class_id)
    os.makedirs(class_folder, exist_ok=True)
    
    # Process base64 MIME type & extension
    ext = "wav" # Default
    if ',' in base64_data_str:
        header, base64_data_str = base64_data_str.split(',', 1)
        if 'audio/mp3' in header or 'audio/mpeg' in header:
            ext = "mp3"
        elif 'audio/ogg' in header:
            ext = "ogg"
        elif 'audio/wav' in header or 'audio/x-wav' in header:
            ext = "wav"
        
    audio_bytes = base64.b64decode(base64_data_str)
    
    # Generate unique filename
    timestamp = int(time.time() * 1000)
    filename = f"track_{timestamp}.{ext}"
    file_path = os.path.join(class_folder, filename)
    
    # Write to file
    with open(file_path, 'wb') as f:
        f.write(audio_bytes)
        
    # Register track in playlists.json
    track_id = f"track_{timestamp}"
    relative_url = f"/music/saved_tracks/{class_id}/{filename}"
    
    new_track = {
        "id": track_id,
        "name": track_name or f"Track {len(data['playlists'][class_id]['tracks']) + 1}",
        "url": relative_url,
        "filename": filename,
        "added_at": timestamp
    }
    
    data["playlists"][class_id]["tracks"].append(new_track)
    write_playlists(data)
    
    return new_track

def rename_track(class_id, track_id, new_name):
    data = read_playlists()
    if class_id in data["playlists"]:
        for track in data["playlists"][class_id]["tracks"]:
            if track["id"] == track_id:
                track["name"] = new_name
                write_playlists(data)
                return True
    return False

def reorder_tracks(class_id, track_ids):
    data = read_playlists()
    if class_id in data["playlists"]:
        tracks = data["playlists"][class_id]["tracks"]
        # Create map for quick lookup
        tracks_map = {t["id"]: t for t in tracks}
        
        # Build new ordered list
        new_tracks = []
        for tid in track_ids:
            if tid in tracks_map:
                new_tracks.append(tracks_map[tid])
                del tracks_map[tid]
                
        # Append any remainder tracks not specified in track_ids
        new_tracks.extend(tracks_map.values())
        
        data["playlists"][class_id]["tracks"] = new_tracks
        write_playlists(data)
        return True
    return False

def delete_track(class_id, track_id):
    data = read_playlists()
    if class_id in data["playlists"]:
        tracks = data["playlists"][class_id]["tracks"]
        for idx, track in enumerate(tracks):
            if track["id"] == track_id:
                # Remove file
                file_path = os.path.join(SAVED_TRACKS_DIR, class_id, track["filename"])
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print("[Playlists Manager] File removal failed:", e)
                
                # Remove from JSON
                tracks.pop(idx)
                write_playlists(data)
                return True
    return False

def move_track(src_class_id, dest_class_id, track_id):
    if src_class_id == dest_class_id:
        return True
    
    data = read_playlists()
    if src_class_id not in data["playlists"] or dest_class_id not in data["playlists"]:
        return False
    
    src_tracks = data["playlists"][src_class_id]["tracks"]
    track_to_move = None
    track_idx = -1
    
    for idx, track in enumerate(src_tracks):
        if track["id"] == track_id:
            track_to_move = track
            track_idx = idx
            break
            
    if not track_to_move:
        return False
        
    # Create destination folder if not exists
    dest_folder = os.path.join(SAVED_TRACKS_DIR, dest_class_id)
    os.makedirs(dest_folder, exist_ok=True)
    
    # Path of physical files
    src_file_path = os.path.join(SAVED_TRACKS_DIR, src_class_id, track_to_move["filename"])
    dest_file_path = os.path.join(dest_folder, track_to_move["filename"])
    
    if os.path.exists(src_file_path):
        try:
            os.rename(src_file_path, dest_file_path)
        except Exception as e:
            print("[Playlists Manager] Error moving physical file:", e)
            return False
            
    # Update track URLs and details
    track_to_move["url"] = f"/music/saved_tracks/{dest_class_id}/{track_to_move['filename']}"
    
    # Remove from source, append to dest
    src_tracks.pop(track_idx)
    data["playlists"][dest_class_id]["tracks"].append(track_to_move)
    
    write_playlists(data)
    return True


def create_playlist(class_name):
    import re
    ensure_storage_exists()
    data = read_playlists()
    
    # Generate clean class_id from class_name
    # Replace non-word characters with hyphen, trim, lowercase
    clean_id = re.sub(r'[^\w\s-]', '', class_name).strip().lower()
    clean_id = re.sub(r'[-\s]+', '-', clean_id)
    
    if not clean_id:
        clean_id = f"custom-playlist-{int(time.time())}"
        
    # Ensure uniqueness
    original_id = clean_id
    counter = 1
    while clean_id in data["playlists"]:
        clean_id = f"{original_id}-{counter}"
        counter += 1
        
    data["playlists"][clean_id] = {
        "class_name": class_name,
        "tracks": []
    }
    write_playlists(data)
    return clean_id, data["playlists"][clean_id]


