// Gnosys AI Universal Playlist & Global Floating Player
(function() {
    // Determine the API base URL
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://127.0.0.1:8020';
    
    // Broadcast Channel for syncing with background Audio Engine
    const channel = new BroadcastChannel('gnosys_audio_channel');
    
    // State variables
    let playlists = {};
    let activeClassId = getCurrentClassId();
    let currentTrack = null;
    let isPaused = true;
    let currentTime = 0;
    let duration = 0;
    let volume = 0.8;
    let isEngineAlive = false;
    let pingInterval = null;
    let dragSrcEl = null;

    // Mini visualizer variables & Pomodoro tracking
    let miniCanvas = null;
    let miniCtx = null;
    let miniAnimFrame = null;
    let preAlarmVolume = null;

    // Subject/Class Map
    const CLASS_NAMES = {
        "medical-terminology": "Medical Terminology",
        "intro-to-chemistry": "Intro to Chemistry",
        "chemistry-math-refresher": "Chemistry Math Refresher",
        "clinical-mathematics": "Clinical Mathematics",
        "psychology-care": "Intro to Psychology",
        "gnosys-music": "Music Studio",
        "anatomy-physiology-1": "Anatomy & Physiology I",
        "anatomy-physiology-2": "Anatomy & Physiology II",
        "anatomy-physiology-3": "Anatomy & Physiology III"
    };

    // Auto-detect class based on URL paths
    function getCurrentClassId() {
        const path = window.location.pathname;
        if (path.includes('/chemistry/math-refresher/')) return 'chemistry-math-refresher';
        if (path.includes('/chemistry/')) return 'intro-to-chemistry';
        if (path.includes('/math/')) return 'clinical-mathematics';
        if (path.includes('/syngnosia/')) return 'medical-terminology';
        if (path.includes('/music/')) return 'gnosys-music';
        if (path.includes('/anatomy1/')) return 'anatomy-physiology-1';
        if (path.includes('/anatomy2/')) return 'anatomy-physiology-2';
        if (path.includes('/anatomy3/')) return 'anatomy-physiology-3';
        return 'gnosys-music';
    }

    // Initialize UI on load
    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        createFloatingWidget();
        initMiniVisualizer();
        fetchPlaylists();
        
        // Start pinging and state checks
        pingInterval = setInterval(() => {
            checkEngineStatus();
            checkPomodoroState();
        }, 1000);
        checkEngineStatus();
        checkPomodoroState();
    });

    // Fetch lists from backend
    async function fetchPlaylists() {
        try {
            const res = await fetch(`${API_BASE}/api/playlists`);
            const data = await res.json();
            if (data && data.playlists) {
                playlists = data.playlists;
                renderPlaylistTracks();
                renderClassOptions();
            }
        } catch (e) {
            console.error('[Global Player] Failed to load playlists:', e);
        }
    }

    function checkEngineStatus() {
        isEngineAlive = false;
        channel.postMessage({ type: 'ping' });
        
        // Timeout to verify if engine responds
        setTimeout(() => {
            updateEngineStatusUI();
        }, 300);
    }

    function updateEngineStatusUI() {
        const indicator = document.getElementById('gnosys-player-status');
        const playBtnIcon = document.querySelector('#gnosys-player-btn-play i');
        
        if (indicator) {
            if (isEngineAlive) {
                indicator.className = 'status-dot active';
                indicator.title = 'Audio Engine Active';
            } else {
                indicator.className = 'status-dot inactive';
                indicator.title = 'Audio Engine Popout Closed. Click Play to open.';
            }
        }
    }

    // Launch hidden/popout window
    function launchEngineWindow() {
        const engineUrl = window.location.origin + '/music/player-engine.html';
        const w = window.open(
            engineUrl,
            'GnosysPlayerEngine',
            'width=360,height=240,menubar=no,toolbar=no,location=no,status=no,resizable=no'
        );
        isEngineAlive = true;
        updateEngineStatusUI();
        return w;
    }

    // Listen to engine updates
    channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'engine_state') {
            isEngineAlive = true;
            isPaused = data.paused;
            currentTime = data.currentTime;
            duration = data.duration;
            volume = data.volume;
            currentTrack = data.track;
            
            // Auto update active playlist if loading a track from another class
            if (data.classId && data.classId !== activeClassId && document.getElementById('gnosys-player-overlay').classList.contains('active')) {
                // Keep class selector in sync
                const select = document.getElementById('gnosys-player-class-select');
                if (select) {
                    activeClassId = data.classId;
                    select.value = activeClassId;
                    renderPlaylistTracks();
                }
            }
            
            updateUIState();
        } else if (data.type === 'track_ended') {
            playNextTrack();
        } else if (data.type === 'prev') {
            playPrevTrack();
        } else if (data.type === 'next') {
            playNextTrack();
        }
    };

    // UI render functions
    function createFloatingWidget() {
        if (document.getElementById('gnosys-global-player-widget')) return;

        // Widget Badge
        const widget = document.createElement('div');
        widget.id = 'gnosys-global-player-widget';
        widget.className = 'gnosys-player-badge';
        widget.innerHTML = `
            <div class="badge-content">
                <i class="fa-solid fa-music text-pink-400"></i>
                <div class="status-dot inactive" id="gnosys-player-status"></div>
            </div>
        `;
        document.body.appendChild(widget);

        // Sidebar/Overlay Drawer
        const overlay = document.createElement('div');
        overlay.id = 'gnosys-player-overlay';
        overlay.className = 'gnosys-player-drawer';
        overlay.innerHTML = `
            <!-- Ambient glows behind content -->
            <div class="drawer-glow glow-1"></div>
            <div class="drawer-glow glow-2"></div>
            
            <div class="drawer-header">
                <div class="logo">
                    <i class="fa-solid fa-compact-disc text-pink-500 animate-disc-slow"></i>
                    <span>Study Room Playlist</span>
                </div>
                <button id="gnosys-player-close" class="close-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div class="drawer-body">
                <!-- Dropdown Class Selector -->
                <div class="form-group">
                    <label>Active Subject Playlist</label>
                    <select id="gnosys-player-class-select" class="glass-select"></select>
                </div>

                <!-- Current Playing Box -->
                <div class="current-track-box">
                    <div class="title" id="gnosys-player-track-name">No track playing</div>
                    <div class="subject" id="gnosys-player-subject-name">Subject: None</div>
                    
                    <!-- Progress Bar -->
                    <div class="progress-wrap">
                        <div class="time" id="gnosys-player-time-curr">0:00</div>
                        <div class="progress-bar-container" id="gnosys-player-seek-bar">
                            <div class="progress-bar-fill" id="gnosys-player-seek-fill" style="width: 0%"></div>
                        </div>
                        <div class="time" id="gnosys-player-time-duration">0:00</div>
                    </div>
                    
                    <!-- Mini Canvas Visualizer -->
                    <div class="visualizer-wrap" style="position: relative; margin-top: 10px;">
                        <canvas id="gnosys-player-mini-canvas" class="player-mini-visualizer"></canvas>
                    </div>
                </div>

                <!-- Track List -->
                <div class="track-list-container">
                    <label class="section-label">Tracks in Playlist</label>
                    <div class="track-list" id="gnosys-player-track-list">
                        <div class="empty-state">No tracks saved yet. Generate some beats in the Music Studio!</div>
                    </div>
                </div>
                
                <!-- File Drop Zone -->
                <div class="file-drop-zone" id="gnosys-player-drop-zone">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>Drag & Drop MP3 / WAV here</span>
                    <span class="subtext">Add to class playlist</span>
                </div>
            </div>

            <!-- Controls Footer -->
            <div class="drawer-footer">
                <div class="buttons">
                    <button class="ctrl-btn" id="gnosys-player-btn-prev" title="Previous"><i class="fa-solid fa-backward-step"></i></button>
                    <button class="ctrl-btn play-btn" id="gnosys-player-btn-play" title="Play"><i class="fa-solid fa-play"></i></button>
                    <button class="ctrl-btn" id="gnosys-player-btn-next" title="Next"><i class="fa-solid fa-forward-step"></i></button>
                </div>
                <div class="volume-slider-wrap">
                    <i class="fa-solid fa-volume-low text-slate-400"></i>
                    <input type="range" id="gnosys-player-volume" min="0" max="1" step="0.05" value="0.8" class="volume-slider">
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Bind clicks
        widget.addEventListener('click', toggleDrawer);
        document.getElementById('gnosys-player-close').addEventListener('click', toggleDrawer);
        
        const select = document.getElementById('gnosys-player-class-select');
        select.addEventListener('change', (e) => {
            activeClassId = e.target.value;
            renderPlaylistTracks();
        });

        // Controls binding
        document.getElementById('gnosys-player-btn-play').addEventListener('click', togglePlay);
        document.getElementById('gnosys-player-btn-prev').addEventListener('click', playPrevTrack);
        document.getElementById('gnosys-player-btn-next').addEventListener('click', playNextTrack);
        
        const vol = document.getElementById('gnosys-player-volume');
        vol.addEventListener('input', (e) => {
            volume = parseFloat(e.target.value);
            channel.postMessage({ type: 'set_volume', volume: volume });
        });

        // Seek bar binding
        const seekBar = document.getElementById('gnosys-player-seek-bar');
        seekBar.addEventListener('click', (e) => {
            if (!duration) return;
            const rect = seekBar.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            const seekTime = clickPos * duration;
            channel.postMessage({ type: 'set_time', time: seekTime });
        });

        // File drag and drop
        const dropZone = document.getElementById('gnosys-player-drop-zone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('active');
        });
        dropZone.addEventListener('drop', handleFileDrop);
    }

    function toggleDrawer() {
        const overlay = document.getElementById('gnosys-player-overlay');
        overlay.classList.toggle('active');
        if (overlay.classList.contains('active')) {
            fetchPlaylists();
        }
    }

    function renderClassOptions() {
        const select = document.getElementById('gnosys-player-class-select');
        if (!select) return;
        select.innerHTML = Object.entries(CLASS_NAMES).map(([id, name]) => `
            <option value="${id}" ${id === activeClassId ? 'selected' : ''}>${name}</option>
        `).join('');
    }

    // Render list of tracks
    function renderPlaylistTracks() {
        const list = document.getElementById('gnosys-player-track-list');
        if (!list) return;

        const playlist = playlists[activeClassId];
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
            list.innerHTML = `<div class="empty-state">No tracks saved yet. Generate some beats in the Music Studio!</div>`;
            return;
        }

        list.innerHTML = playlist.tracks.map((track, idx) => {
            const isCurrent = currentTrack && currentTrack.id === track.id;
            return `
                <div class="track-row ${isCurrent ? 'playing' : ''}" draggable="true" data-id="${track.id}" style="animation-delay: ${idx * 0.04}s;">
                    <div class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
                    <div class="track-name-click" data-url="${track.url}" data-idx="${idx}">
                        <div class="name-display">${track.name}</div>
                    </div>
                    <div class="actions">
                        <button class="row-btn rename-btn" data-id="${track.id}" title="Rename"><i class="fa-solid fa-pencil"></i></button>
                        <button class="row-btn delete-btn" data-id="${track.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind drag and drop events
        const rows = list.querySelectorAll('.track-row');
        rows.forEach(row => {
            row.addEventListener('dragstart', handleDragStart);
            row.addEventListener('dragover', handleDragOver);
            row.addEventListener('drop', handleDrop);
            row.addEventListener('dragend', handleDragEnd);
        });

        // Click track to play
        list.querySelectorAll('.track-name-click').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(el.getAttribute('data-idx'));
                playTrack(idx);
            });
        });

        // Rename track
        list.querySelectorAll('.rename-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trackId = btn.getAttribute('data-id');
                const row = btn.closest('.track-row');
                const nameDisplay = row.querySelector('.name-display');
                
                const oldName = nameDisplay.textContent;
                const newName = prompt("Enter new track name:", oldName);
                if (newName && newName.trim() && newName !== oldName) {
                    renameTrackOnServer(trackId, newName.trim());
                }
            });
        });

        // Delete track
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trackId = btn.getAttribute('data-id');
                if (confirm("Delete this track?")) {
                    deleteTrackOnServer(trackId);
                }
            });
        });
    }

    // Playback control trigger
    function togglePlay() {
        if (!isEngineAlive) {
            // Engine is closed, launch and play the first track
            launchEngineWindow();
            setTimeout(() => {
                if (currentTrack) {
                    channel.postMessage({ type: 'play' });
                } else {
                    playTrack(0);
                }
            }, 800);
            return;
        }

        if (isPaused) {
            channel.postMessage({ type: 'play' });
        } else {
            channel.postMessage({ type: 'pause' });
        }
    }

    function playTrack(idx) {
        const playlist = playlists[activeClassId];
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
        
        // Clamp bounds
        if (idx < 0) idx = playlist.tracks.length - 1;
        if (idx >= playlist.tracks.length) idx = 0;

        const track = playlist.tracks[idx];
        
        if (!isEngineAlive) {
            launchEngineWindow();
            setTimeout(() => {
                sendLoadTrackMessage(track);
            }, 800);
        } else {
            sendLoadTrackMessage(track);
        }
    }

    function sendLoadTrackMessage(track) {
        channel.postMessage({
            type: 'load_track',
            url: track.url,
            track: track,
            classId: activeClassId,
            className: CLASS_NAMES[activeClassId] || 'Idle'
        });
    }

    function playNextTrack() {
        if (!currentTrack) return;
        const playlist = playlists[activeClassId];
        if (!playlist || !playlist.tracks) return;
        
        const idx = playlist.tracks.findIndex(t => t.id === currentTrack.id);
        if (idx !== -1) {
            playTrack(idx + 1);
        }
    }

    function playPrevTrack() {
        if (!currentTrack) return;
        const playlist = playlists[activeClassId];
        if (!playlist || !playlist.tracks) return;
        
        const idx = playlist.tracks.findIndex(t => t.id === currentTrack.id);
        if (idx !== -1) {
            playTrack(idx - 1);
        }
    }

    // Syncing UI changes
    function updateUIState() {
        const trackDisplay = document.getElementById('gnosys-player-track-name');
        const subjectDisplay = document.getElementById('gnosys-player-subject-name');
        const playBtnIcon = document.querySelector('#gnosys-player-btn-play i');
        const fill = document.getElementById('gnosys-player-seek-fill');
        const currTimeText = document.getElementById('gnosys-player-time-curr');
        const durationText = document.getElementById('gnosys-player-time-duration');
        const discIcon = document.querySelector('.logo i');

        if (currentTrack) {
            if (trackDisplay) trackDisplay.textContent = currentTrack.name;
            if (subjectDisplay) subjectDisplay.textContent = `Subject: ${CLASS_NAMES[activeClassId] || 'Unknown'}`;
        }
        
        if (playBtnIcon) {
            playBtnIcon.className = isPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
        }

        if (discIcon) {
            if (isPaused) {
                discIcon.classList.remove('animate-disc-slow');
            } else {
                discIcon.classList.add('animate-disc-slow');
            }
        }

        if (duration) {
            const pct = (currentTime / duration) * 100;
            if (fill) fill.style.width = pct + '%';
            if (currTimeText) currTimeText.textContent = formatTime(currentTime);
            if (durationText) durationText.textContent = formatTime(duration);
        } else {
            if (fill) fill.style.width = '0%';
            if (currTimeText) currTimeText.textContent = '0:00';
            if (durationText) durationText.textContent = '0:00';
        }
        
        // Highlight active track row
        const rows = document.querySelectorAll('#gnosys-player-track-list .track-row');
        rows.forEach(row => {
            const tid = row.getAttribute('data-id');
            if (currentTrack && tid === currentTrack.id) {
                row.classList.add('playing');
            } else {
                row.classList.remove('playing');
            }
        });

        // Update badge playing state
        const badge = document.getElementById('gnosys-global-player-widget');
        if (badge) {
            if (!isPaused && currentTrack) {
                badge.classList.add('playing');
            } else {
                badge.classList.remove('playing');
            }
        }
    }

    function formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Drag & Drop operations
    function handleDragStart(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.outerHTML);
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        return false;
    }

    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();
        
        if (dragSrcEl !== this) {
            const list = document.getElementById('gnosys-player-track-list');
            const nodes = Array.from(list.children);
            const srcIdx = nodes.indexOf(dragSrcEl);
            const destIdx = nodes.indexOf(this);
            
            // Re-order in array
            const tracks = playlists[activeClassId].tracks;
            const [moved] = tracks.splice(srcIdx, 1);
            tracks.splice(destIdx, 0, moved);
            
            // Re-render
            renderPlaylistTracks();
            
            // Sync reorder with Server
            const trackIds = tracks.map(t => t.id);
            syncReorderWithServer(trackIds);
        }
        return false;
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        const rows = document.querySelectorAll('#gnosys-player-track-list .track-row');
        rows.forEach(row => row.classList.remove('dragging'));
    }

    // Drag-and-drop file upload
    async function handleFileDrop(e) {
        e.preventDefault();
        const dropZone = document.getElementById('gnosys-player-drop-zone');
        dropZone.classList.remove('active');
        
        const files = Array.from(e.dataTransfer.files);
        const audioFiles = files.filter(f => f.type.startsWith('audio/') || f.name.endsWith('.mp3') || f.name.endsWith('.wav'));
        
        if (audioFiles.length === 0) {
            alert("Please drop audio files (.mp3, .wav) only.");
            return;
        }

        const file = audioFiles[0]; // Process first file
        dropZone.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-pink-500"></i><span>Uploading ${file.name}...</span>`;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Data = event.target.result;
            try {
                const res = await fetch(`${API_BASE}/api/playlists/save-track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        class_id: activeClassId,
                        name: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
                        audio_base64: base64Data
                    })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    await fetchPlaylists();
                } else {
                    alert("Upload failed: " + data.message);
                }
            } catch (err) {
                alert("Upload failed: " + err.message);
            } finally {
                // Restore upload zone
                dropZone.innerHTML = `
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>Drag & Drop MP3 / WAV here</span>
                    <span class="subtext">Add to class playlist</span>
                `;
            }
        };
        reader.readAsDataURL(file);
    }

    // Server interactions
    async function renameTrackOnServer(trackId, newName) {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/rename-track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ class_id: activeClassId, track_id: trackId, name: newName })
            });
            const data = await res.json();
            if (data.status === 'success') {
                playlists[activeClassId].tracks.find(t => t.id === trackId).name = newName;
                renderPlaylistTracks();
                if (currentTrack && currentTrack.id === trackId) {
                    currentTrack.name = newName;
                    updateUIState();
                }
            }
        } catch (e) {
            console.error('[Global Player] Failed to rename track:', e);
        }
    }

    async function syncReorderWithServer(trackIds) {
        try {
            await fetch(`${API_BASE}/api/playlists/reorder-tracks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ class_id: activeClassId, track_ids: trackIds })
            });
        } catch (e) {
            console.error('[Global Player] Failed to sync reorder:', e);
        }
    }

    async function deleteTrackOnServer(trackId) {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/delete-track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ class_id: activeClassId, track_id: trackId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (currentTrack && currentTrack.id === trackId) {
                    channel.postMessage({ type: 'pause' });
                    currentTrack = null;
                }
                await fetchPlaylists();
            }
        } catch (e) {
            console.error('[Global Player] Failed to delete track:', e);
        }
    }

    // Integrate with Pomodoro
    function checkPomodoroState() {
        try {
            const stateStr = localStorage.getItem('study_pomodoro_state');
            if (!stateStr) return;
            const state = JSON.parse(stateStr);
            if (state) {
                if (state.alarmActive && !isPaused) {
                    // Alarm is active! Dim music volume to 10%
                    if (preAlarmVolume === null) {
                        preAlarmVolume = volume; // Save current volume
                    }
                    channel.postMessage({ type: 'set_volume', volume: 0.1 });
                    const vol = document.getElementById('gnosys-player-volume');
                    if (vol) vol.value = 0.1;
                } else if (!state.alarmActive && preAlarmVolume !== null) {
                    // Alarm cleared. Restore original volume!
                    channel.postMessage({ type: 'set_volume', volume: preAlarmVolume });
                    const vol = document.getElementById('gnosys-player-volume');
                    if (vol) vol.value = preAlarmVolume;
                    preAlarmVolume = null; // Clear saved volume
                }
            }
        } catch (e) {
            console.error('[Global Player] Error checking Pomodoro state:', e);
        }
    }

    window.addEventListener('storage', (event) => {
        if (event.key === 'study_pomodoro_state') {
            checkPomodoroState();
        }
    });

    // Mini visualizer implementation
    function initMiniVisualizer() {
        miniCanvas = document.getElementById('gnosys-player-mini-canvas');
        if (!miniCanvas) return;
        miniCtx = miniCanvas.getContext('2d');
        
        function resize() {
            if (miniCanvas) {
                miniCanvas.width = miniCanvas.parentElement.clientWidth;
                miniCanvas.height = 36;
            }
        }
        window.addEventListener('resize', resize);
        resize();
        
        drawMiniVisualizer();
    }
    
    function drawMiniVisualizer() {
        if (!miniCanvas || !miniCtx) return;
        
        const ctx = miniCtx;
        const width = miniCanvas.width;
        const height = miniCanvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const barWidth = 4;
        const barGap = 3;
        const numBars = Math.floor(width / (barWidth + barGap));
        const center = height / 2;
        
        // Create dynamic fuchsia/indigo gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#6366f1'); // Indigo
        gradient.addColorStop(0.5, '#d946ef'); // Fuchsia
        gradient.addColorStop(1, '#6366f1'); // Indigo
        ctx.fillStyle = gradient;
        
        const time = Date.now() * 0.006;
        
        for (let i = 0; i < numBars; i++) {
            let barHeight = 2; // Default resting height
            
            if (!isPaused && currentTrack) {
                // Generate organic bouncing wave
                const wave1 = Math.sin(i * 0.2 + time) * 12;
                const wave2 = Math.cos(i * 0.35 - time * 0.8) * 8;
                const noise = Math.sin(i * 0.75 + time * 1.6) * 4;
                barHeight = Math.abs(wave1 + wave2 + noise) + 2;
                
                // Fade at edges
                const fade = Math.sin((i / numBars) * Math.PI);
                barHeight *= fade;
                
                // Keep within bounds
                barHeight = Math.min(barHeight, height - 4);
            } else if (currentTrack) {
                // Breathing effect when paused but track loaded
                const breathing = Math.sin(time * 0.5) * 1.5 + 2.5;
                barHeight = breathing * Math.sin((i / numBars) * Math.PI);
            }
            
            barHeight = Math.max(2, barHeight);
            
            const x = i * (barWidth + barGap);
            const y = center - barHeight / 2;
            
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 2);
            ctx.fill();
        }
        
        miniAnimFrame = requestAnimationFrame(drawMiniVisualizer);
    }

    // Inject CSS styles
    function injectStyles() {
        if (document.getElementById('gnosys-player-global-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'gnosys-player-global-styles';
        style.innerHTML = `
            /* Widget style */
            .gnosys-player-badge {
                position: fixed;
                bottom: 84px; /* Stacked right above Pomodoro widget (which is at ~20px) */
                right: 24px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 10px rgba(217, 70, 239, 0.2);
                cursor: pointer;
                z-index: 9990;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .gnosys-player-badge:hover {
                transform: scale(1.12) rotate(15deg);
                border-color: rgba(217, 70, 239, 0.5);
                box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(217, 70, 239, 0.5);
            }
            .gnosys-player-badge .badge-content {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .gnosys-player-badge i {
                font-size: 18px;
            }
            
            /* Status dot inside badge */
            .status-dot {
                position: absolute;
                bottom: 4px;
                right: 4px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                border: 1.5px solid rgba(15, 23, 42, 0.85);
            }
            .status-dot.active {
                background: #2dd4bf;
                box-shadow: 0 0 8px #2dd4bf;
            }
            .status-dot.inactive {
                background: #64748b;
            }

            /* Background Glow Effects */
            .drawer-glow {
                position: absolute;
                width: 200px;
                height: 200px;
                border-radius: 50%;
                filter: blur(60px);
                opacity: 0.12;
                pointer-events: none;
                z-index: 0;
                transition: opacity 0.5s ease;
            }
            .drawer-glow.glow-1 {
                background: #d946ef;
                top: 15%;
                left: -70px;
            }
            .drawer-glow.glow-2 {
                background: #6366f1;
                bottom: 20%;
                right: -70px;
            }

            /* Drawer Style */
            .gnosys-player-drawer {
                position: fixed;
                top: 0;
                right: -360px; /* Hidden offscreen initially */
                width: 360px;
                height: 100%;
                background: linear-gradient(160deg, rgba(15, 23, 42, 0.88) 0%, rgba(9, 13, 26, 0.92) 100%);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-left: 1px solid rgba(255, 255, 255, 0.05);
                box-shadow: -10px 0 50px rgba(0,0,0,0.6);
                z-index: 9995;
                display: flex;
                flex-direction: column;
                color: #f8fafc;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: 'Outfit', sans-serif;
                overflow: hidden;
            }
            .gnosys-player-drawer.active {
                right: 0;
            }
            
            .drawer-header {
                padding: 24px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                z-index: 1;
            }
            .drawer-header .logo {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 16px;
                font-weight: 800;
                letter-spacing: -0.3px;
            }
            .drawer-header .logo i {
                font-size: 20px;
            }
            .drawer-header .close-btn {
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 18px;
                transition: color 0.2s;
            }
            .drawer-header .close-btn:hover {
                color: #f8fafc;
            }

            /* Animation */
            @keyframes spinSlow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .animate-disc-slow {
                animation: spinSlow 6s linear infinite;
            }
            
            @keyframes badgeGlowPulse {
                0% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 8px rgba(217, 70, 239, 0.2); }
                50% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 18px rgba(217, 70, 239, 0.5); }
                100% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 8px rgba(217, 70, 239, 0.2); }
            }
            .gnosys-player-badge.playing {
                animation: badgeGlowPulse 2.4s infinite ease-in-out;
                border-color: rgba(217, 70, 239, 0.35);
            }
            .gnosys-player-badge.playing i {
                animation: spinSlow 6s linear infinite;
                color: #d946ef;
                text-shadow: 0 0 8px rgba(217, 70, 239, 0.6);
            }

            .drawer-body {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                position: relative;
                z-index: 1;
            }
            
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .form-group label, .section-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: #94a3b8;
                font-weight: 800;
            }
            
            .glass-select {
                background: rgba(0,0,0,0.25);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                color: #f8fafc;
                padding: 10px 14px;
                font-size: 13px;
                font-weight: 600;
                outline: none;
                transition: border-color 0.2s;
                cursor: pointer;
            }
            .glass-select:focus {
                border-color: rgba(217, 70, 239, 0.4);
            }
            .glass-select option {
                background: #0f172a;
                color: #f8fafc;
            }

            /* Current song area */
            .current-track-box {
                background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 20px;
                padding: 16px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            .current-track-box .title {
                font-size: 15px;
                font-weight: 800;
                letter-spacing: -0.3px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .current-track-box .subject {
                font-size: 11px;
                color: #d946ef;
                font-weight: 700;
                margin-top: 2px;
            }

            /* Progress Bar */
            .progress-wrap {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 14px;
            }
            .progress-wrap .time {
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
                color: #94a3b8;
                width: 32px;
                text-align: center;
            }
            .progress-bar-container {
                flex: 1;
                height: 5px;
                background: rgba(255,255,255,0.06);
                border-radius: 3px;
                cursor: pointer;
                position: relative;
                transition: all 0.2s;
            }
            .progress-bar-container:hover {
                height: 7px;
                background: rgba(255,255,255,0.12);
            }
            .progress-bar-fill {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: linear-gradient(to right, #6366f1, #d946ef);
                border-radius: 3px;
                transition: width 0.1s linear;
            }

            /* Mini Visualizer Canvas */
            .player-mini-visualizer {
                width: 100%;
                height: 36px;
                background: rgba(0, 0, 0, 0.25);
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.03);
                display: block;
            }

            /* Tracks list */
            .track-list-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                flex: 1;
                min-height: 150px;
            }
            .track-list {
                background: rgba(0,0,0,0.15);
                border: 1px solid rgba(255,255,255,0.03);
                border-radius: 16px;
                overflow-y: auto;
                max-height: 250px;
            }
            
            /* Fade in up animation */
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .track-row {
                display: flex;
                align-items: center;
                padding: 10px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.02);
                font-size: 13px;
                cursor: grab;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                z-index: 1;
                border-radius: 10px;
                margin: 4px 8px;
                animation: fadeInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            }
            .track-row.dragging {
                opacity: 0.4;
                background: rgba(217, 70, 239, 0.05);
            }
            .track-row:hover {
                background: rgba(255, 255, 255, 0.04);
                transform: translateX(4px);
                border-bottom-color: transparent;
            }
            .track-row.playing {
                background: linear-gradient(90deg, rgba(217, 70, 239, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%);
                border-left: 3px solid #d946ef;
                padding-left: 11px;
                box-shadow: 0 4px 12px rgba(217, 70, 239, 0.04);
            }
            .track-row.playing .name-display {
                color: #d946ef;
                font-weight: 700;
            }
            .track-row .drag-handle {
                color: #475569;
                margin-right: 12px;
                cursor: grab;
            }
            .track-name-click {
                flex: 1;
                overflow: hidden;
                cursor: pointer;
            }
            .track-name-click .name-display {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .track-row .actions {
                display: flex;
                gap: 6px;
            }
            .row-btn {
                background: none;
                border: none;
                color: #64748b;
                cursor: pointer;
                padding: 4px;
                font-size: 11px;
                transition: color 0.2s;
            }
            .row-btn:hover {
                color: #f8fafc;
            }
            .delete-btn:hover {
                color: #ef4444;
            }
            
            .empty-state {
                font-size: 11px;
                color: #64748b;
                padding: 30px;
                text-align: center;
                line-height: 1.5;
            }

            /* Dropzone */
            .file-drop-zone {
                border: 2px dashed rgba(255,255,255,0.08);
                border-radius: 16px;
                padding: 16px;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .file-drop-zone i {
                font-size: 20px;
                color: #64748b;
            }
            .file-drop-zone span {
                font-size: 12px;
                font-weight: 600;
            }
            .file-drop-zone .subtext {
                font-size: 9px;
                color: #64748b;
            }
            .file-drop-zone.active, .file-drop-zone:hover {
                border-color: #d946ef;
                background: rgba(217, 70, 239, 0.04);
            }
            .file-drop-zone.active i, .file-drop-zone:hover i {
                color: #d946ef;
            }

            /* Footer controls */
            .drawer-footer {
                padding: 20px 24px 28px;
                border-top: 1px solid rgba(255,255,255,0.05);
                background: rgba(15, 23, 42, 0.45);
                display: flex;
                flex-direction: column;
                gap: 16px;
                position: relative;
                z-index: 1;
            }
            .drawer-footer .buttons {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 24px;
            }
            .ctrl-btn {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .ctrl-btn:hover {
                color: #f8fafc;
                background: rgba(255,255,255,0.04);
            }
            .ctrl-btn.play-btn {
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #d946ef, #6366f1);
                color: #ffffff;
                font-size: 16px;
                box-shadow: 0 4px 15px rgba(217, 70, 239, 0.4);
                border: none;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .ctrl-btn.play-btn:hover {
                background: linear-gradient(135deg, #e879f9, #818cf8);
                transform: scale(1.1) rotate(5deg);
                box-shadow: 0 6px 20px rgba(217, 70, 239, 0.6);
            }
            
            .volume-slider-wrap {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .volume-slider {
                flex: 1;
                height: 3px;
                background: rgba(255,255,255,0.1);
                outline: none;
                border: none;
                appearance: none;
                -webkit-appearance: none;
                border-radius: 2px;
            }
            .volume-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #f8fafc;
                cursor: pointer;
                transition: transform 0.1s;
            }
            .volume-slider::-webkit-slider-thumb:hover {
                transform: scale(1.3);
            }
        `;
        document.head.appendChild(style);
    }
})();
