import urllib.request
import re
import json
import ssl
import time
from html import unescape

# Disable SSL check for convenience
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

playlist_url = "https://www.youtube.com/playlist?list=PL8dPuuaLjXtOAKed_MxxWBNaPno5h3Zs8"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}

def clean_description(desc):
    # Remove advertising or standard links
    lines = desc.split('\n')
    cleaned_lines = []
    for line in lines:
        if any(keyword in line.lower() for keyword in ["patreon", "patrons", "twitter", "facebook", "instagram", "merch", "subscrib", "complexly"]):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()

def extract_concepts(desc):
    # Look for timestamps like 02:40 or 12:05 or 1:04 and grab the text after it
    matches = re.findall(r'(?:(\d{1,2}):(\d{2}))\s*[-–—]?\s*([A-Za-z0-9\s,&\'"\(\)]+)', desc)
    concepts = []
    for m in matches:
        concept = m[2].strip()
        if len(concept) > 3 and not any(k in concept.lower() for k in ["table of contents", "credits", "sources", "citation"]):
            concepts.append(concept)
    if not concepts:
        # Fallback: extract capitalized word phrases
        fallback_phrases = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', desc)
        concepts = list(set([p for p in fallback_phrases if len(p) > 5]))[:4]
    return list(dict.fromkeys(concepts))  # De-duplicate preserving order

def extract_json_block(source, marker):
    marker_index = source.find(marker)
    if marker_index == -1:
        return None

    start = source.find('{', marker_index)
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False

    for idx in range(start, len(source)):
        ch = source[idx]

        if in_string:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return source[start:idx + 1]

    return None

def extract_playlist_ids_fallback(html):
    candidates = re.findall(r'"playlistVideoRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"', html)
    if not candidates:
        candidates = re.findall(r'"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"', html)

    seen = set()
    ordered = []
    for vid in candidates:
        if vid in seen:
            continue
        seen.add(vid)
        ordered.append(vid)
    return ordered

def fetch_playlist_videos():
    print(f"Fetching playlist from {playlist_url}...")
    req = urllib.request.Request(playlist_url, headers=headers)
    with urllib.request.urlopen(req, context=ctx) as response:
        html = response.read().decode('utf-8')

    videos = []
    initial_data_json = extract_json_block(html, 'var ytInitialData') or extract_json_block(html, 'ytInitialData')
    if initial_data_json:
        try:
            data = json.loads(initial_data_json)
            contents = data.get('contents', {})
            results = contents.get('twoColumnBrowseResultsRenderer', {}).get('tabs', [{}])[0].get('tabRenderer', {}).get('content', {}).get('sectionListRenderer', {}).get('contents', [{}])[0].get('itemSectionRenderer', {}).get('contents', [{}])[0].get('playlistVideoListRenderer', {}).get('contents', [])

            for item in results:
                video_renderer = item.get('playlistVideoRenderer')
                if not video_renderer:
                    continue
                video_id = video_renderer.get('videoId')
                title = video_renderer.get('title', {}).get('runs', [{}])[0].get('text', '').strip()
                if not video_id:
                    continue
                videos.append({'videoId': video_id, 'title': title})
        except Exception:
            videos = []

    if not videos:
        ids = extract_playlist_ids_fallback(html)
        videos = [{'videoId': vid, 'title': ''} for vid in ids]

    return videos

def fetch_video_details(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx) as response:
        html = response.read().decode('utf-8')

    player_json = extract_json_block(html, 'var ytInitialPlayerResponse') or extract_json_block(html, 'ytInitialPlayerResponse')
    if not player_json:
        return "", [], ""

    player_data = json.loads(player_json)
    video_details = player_data.get('videoDetails', {})
    raw_desc = video_details.get('shortDescription', '')
    raw_title = video_details.get('title', '')
    
    concepts = extract_concepts(raw_desc)
    desc = clean_description(raw_desc)
    title = unescape(raw_title).strip()
    
    return desc, concepts, title

def main():
    try:
        videos = fetch_playlist_videos()
        print(f"Discovered {len(videos)} videos in playlist.")
        
        curriculum = []
        ep_num = 1
        for idx, v in enumerate(videos):
            v_id = v['videoId']
            fallback_title = (v.get('title') or '').strip()
            
            # Pre-filter out previews/office hours
            check_title = fallback_title.lower()
            if "preview" in check_title or "office hours" in check_title:
                print(f"Skipping non-curriculum video: {fallback_title or v_id}")
                continue
                
            print(f"[{ep_num}] Scraping metadata for video ID {v_id}...")
            desc, concepts, watch_title = fetch_video_details(v_id)
            
            title = watch_title or fallback_title or f"Episode {ep_num}"
            if "preview" in title.lower() or "office hours" in title.lower():
                print(f"Skipping non-curriculum video post-fetch: {title}")
                continue

            # Clean suffixes from title
            title = re.sub(r':\s*Crash Course Anatomy\s*&\s*Physiology.*$', '', title, flags=re.IGNORECASE).strip()
            title = re.sub(r':\s*Crash Course Anatomy\s*and\s*Physiology.*$', '', title, flags=re.IGNORECASE).strip()
            
            # Formulate concepts if empty
            if not concepts:
                concepts = ["Foundational Systems", "Anatomical Structures", "Physiological Functions"]
                
            prompt = f"You are AnatomyTutor, an encouraging A&P I companion. Quiz the student on: {', '.join(concepts)}. Ask one question at a time, wait for response, and provide Socratic feedback."
            
            curriculum.append({
                'id': f"anatomy1_ep_{ep_num:02d}",
                'episodeNumber': ep_num,
                'title': title,
                'youtubeId': v_id,
                'coreConcepts': concepts,
                'description': desc.replace('\r', '').replace('\n', ' '),
                'tutorSystemPrompt': prompt,
                'customSystemPrompt': prompt
            })
            ep_num += 1
            
            # Simple rate limiting delay
            time.sleep(1)
            
        # Write output file
        js_content = f"// BI 231Z - Anatomy & Physiology I Video Curriculum Data\nwindow.AnatomyVideoData = {{\n    videoCurriculum: {json.dumps(curriculum, indent=4)}\n}};\n"
        output_path = "t:\\StudyApps\\Gnosys-AI\\anatomy1\\video_data.js"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Success! Created {output_path} with {len(curriculum)} episodes.")
        
    except Exception as e:
        print(f"Execution Error: {e}")

if __name__ == "__main__":
    main()
