// Gnosys AI Universal Playlist & Global Floating Player
(function() {
    const isTopWindow = window.self === window.top;

    if (!isTopWindow) {
        // Child frame: forward auto-download events to the parent player
        window.addEventListener('gnosys_auto_download', (e) => {
            if (window.top && window.top !== window) {
                window.top.dispatchEvent(new CustomEvent('gnosys_auto_download', {
                    detail: e.detail
                }));
            }
        });
        return; // Abort remaining script initialization in the child iframe
    }

    // Music Studio is displayed inside the full-screen content iframe below.
    // Edge may still reject loopback fetches made by that frame even when the
    // permission is granted and delegated. Provide a tightly scoped top-level
    // bridge so child pages can reach only the Gnosys helper API.
    const GNOSYS_HELPER_ORIGIN = 'http://127.0.0.1:8020';
    let localAccessPanel = null;

    window.GnosysLocalHelperFetch = async function(input, init = {}) {
        const target = new URL(input, window.location.href);
        const allowedOrigins = new Set([
            'http://127.0.0.1:8020',
            'http://localhost:8020',
        ]);
        if (!allowedOrigins.has(target.origin) || !target.pathname.startsWith('/api/')) {
            throw new Error('Blocked an invalid local helper request.');
        }

        const requestInit = {
            method: init.method || 'GET',
            headers: init.headers,
            body: init.body,
            targetAddressSpace: 'loopback',
        };
        if (init.timeoutMs && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            requestInit.signal = AbortSignal.timeout(init.timeoutMs);
        }
        return fetch(target.href, requestInit);
    };

    function hideLocalAccessPanel() {
        if (localAccessPanel) {
            localAccessPanel.remove();
            localAccessPanel = null;
        }
    }

    async function getLocalAccessPermissionState() {
        if (!navigator.permissions?.query) return 'prompt';
        try {
            const permission = await navigator.permissions.query({ name: 'local-network-access' });
            return permission.state;
        } catch (_err) {
            return 'prompt';
        }
    }

    function showLocalAccessPanel(message) {
        if (window.location.protocol !== 'https:' || !window.location.hostname.endsWith('github.io')) return;
        if (!document.body) return;

        if (!localAccessPanel) {
            localAccessPanel = document.createElement('div');
            localAccessPanel.id = 'gnosys-local-access-panel';
            localAccessPanel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,6,23,.78);backdrop-filter:blur(8px);font-family:Inter,system-ui,sans-serif;';
            localAccessPanel.innerHTML = `
                <div style="width:min(520px,100%);padding:24px;border:1px solid rgba(45,212,191,.35);border-radius:20px;background:#0f172a;color:#e2e8f0;box-shadow:0 24px 80px rgba(0,0,0,.45)">
                    <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5eead4">One-time connection</div>
                    <h2 style="margin:8px 0 8px;font-size:22px;color:white">Enable Hosted Music Studio</h2>
                    <p id="gnosys-local-access-message" style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#cbd5e1"></p>
                    <div style="display:flex;gap:10px;flex-wrap:wrap">
                        <button id="gnosys-enable-local-access" type="button" style="padding:11px 16px;border:0;border-radius:11px;background:#0d9488;color:white;font-weight:800;cursor:pointer">Retry Connection</button>
                        <a href="${GNOSYS_HELPER_ORIGIN}/music/" target="_blank" rel="noopener" style="padding:10px 15px;border:1px solid #475569;border-radius:11px;color:#cbd5e1;text-decoration:none;font-weight:700">Local fallback</a>
                        <button id="gnosys-dismiss-local-access" type="button" style="padding:11px 14px;border:0;background:transparent;color:#94a3b8;font-weight:700;cursor:pointer">Not now</button>
                    </div>
                </div>`;
            document.body.appendChild(localAccessPanel);

            localAccessPanel.querySelector('#gnosys-enable-local-access')?.addEventListener('click', async event => {
                const button = event.currentTarget;
                button.disabled = true;
                button.textContent = 'Checking...';
                const allowed = await window.GnosysEnsureLocalNetworkAccess();
                if (!allowed && localAccessPanel) {
                    button.disabled = false;
                    button.textContent = 'Retry Connection';
                }
            });
            localAccessPanel.querySelector('#gnosys-dismiss-local-access')?.addEventListener('click', hideLocalAccessPanel);
        }

        const messageElement = localAccessPanel.querySelector('#gnosys-local-access-message');
        if (messageElement) messageElement.textContent = message;
    }

    window.GnosysEnsureLocalNetworkAccess = async function() {
        if (window.location.protocol !== 'https:' || !window.location.hostname.endsWith('github.io')) return true;
        try {
            const response = await window.GnosysLocalHelperFetch(`${GNOSYS_HELPER_ORIGIN}/api/accelerator/status`, {
                timeoutMs: 10000,
            });
            if (!response.ok) throw new Error(`Local helper returned ${response.status}.`);
            hideLocalAccessPanel();
            return true;
        } catch (err) {
            const permissionState = await getLocalAccessPermissionState();
            const message = permissionState === 'denied'
                ? 'Edge is still blocking the hosted app. Run run_backend.bat once to install the scoped Gnosys loopback exception, fully close and reopen Edge, then retry.'
                : 'Start run_backend.bat, click Retry Connection, and choose Allow if Microsoft Edge asks. Only the Gnosys GitHub Pages origin is allowlisted.';
            showLocalAccessPanel(message);
            console.warn('[Global Player] Hosted Music Studio connection check failed:', err);
            return false;
        }
    };

    async function initializeLocalAccessPrompt() {
        if (window.location.protocol !== 'https:' || !window.location.hostname.endsWith('github.io')) return;
        if (!window.location.pathname.includes('/music/')) return;
        await window.GnosysEnsureLocalNetworkAccess();
    }

    // Determine the API base URL
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://127.0.0.1:8020';
    
    // Broadcast Channel for syncing with background Audio Engine
    const channel = new BroadcastChannel('gnosys_audio_channel');
    
    // State variables
    let playlists = {};
    let activeClassId = localStorage.getItem('gnosys_player_activeClassId') || getCurrentClassId();
    let playingClassId = null;
    let currentTrack = null;
    let isPaused = true;
    let currentTime = 0;
    let duration = 0;
    let volume = 0.8;
    let isEngineAlive = false;
    let isTrackLoadedInEngine = false;
    let playlistBackendWarningShown = false;
    let pingInterval = null;
    let dragSrcEl = null;

    // Engine readiness queue — buffers commands until popup is confirmed alive
    let pendingEngineCommands = [];
    let engineLaunchRetries = 0;
    const MAX_ENGINE_RETRIES = 2;
    let engineRetryTimer = null;

    // Inline fallback audio element for popup blocker scenarios
    let inlineFallbackAudio = null;
    let usingInlineFallback = true;
    let inlineTrackUrl = null;
    let inlineHasTriedFallback = false;

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
        if (path.includes('/music/')) return 'medical-terminology';
        if (path.includes('/anatomy1/')) return 'anatomy-physiology-1';
        if (path.includes('/anatomy2/')) return 'anatomy-physiology-2';
        if (path.includes('/anatomy3/')) return 'anatomy-physiology-3';
        return 'medical-terminology';
    }

    // Synchronize floating player badge position to align with stats button in child iframe
    function syncPlayerPosition() {
        const badge = document.getElementById('gnosys-global-player-widget');
        if (!badge) return;

        const iframe = document.getElementById('gnosys-content-frame');
        let rightOffset = 24; // Default fallback right (px)
        let bottomOffset = 92; // Default fallback bottom (px)

        if (iframe && iframe.contentWindow && iframe.contentDocument) {
            try {
                const doc = iframe.contentDocument;
                // Find stats button inside child iframe
                const statsBtn = doc.getElementById('floating-stats-btn-container') || doc.getElementById('stats-modal-trigger-btn');
                
                if (statsBtn) {
                    const rect = statsBtn.getBoundingClientRect();
                    if (rect.width > 0 && rect.right > 0) {
                        rightOffset = window.innerWidth - rect.right;
                        bottomOffset = (window.innerHeight - rect.top) + 12;
                    } else {
                        // Exists but not rendered, fall back to scrollbar calculation
                        const win = iframe.contentWindow;
                        const docEl = doc.documentElement;
                        const scrollbarWidth = win.innerWidth - docEl.clientWidth;
                        rightOffset = 24 + (scrollbarWidth > 0 ? scrollbarWidth : 0);
                    }
                } else {
                    // Fall back to scrollbar calculation
                    const win = iframe.contentWindow;
                    const docEl = doc.documentElement;
                    const scrollbarWidth = win.innerWidth - docEl.clientWidth;
                    rightOffset = 24 + (scrollbarWidth > 0 ? scrollbarWidth : 0);
                }
            } catch (e) {
                console.warn('[Global Player] Dynamic position alignment fallback:', e);
            }
        }

        badge.style.right = `${rightOffset}px`;
        badge.style.bottom = `${bottomOffset}px`;
    }

    // Initialize UI on load and wrap page in full-screen iframe
    document.addEventListener('DOMContentLoaded', () => {
        const body = document.body;
        const currentUrl = window.location.href;

        // Clear parent body content to build wrapper layout
        body.innerHTML = '';
        body.style.margin = '0';
        body.style.padding = '0';
        body.style.overflow = 'hidden';
        body.style.width = '100vw';
        body.style.height = '100vh';
        body.style.backgroundColor = '#020617';

        // Create the full-screen iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'gnosys-content-frame';
        iframe.src = currentUrl;
        // Edge requires explicit Permissions Policy delegation before content
        // inside an iframe can contact a localhost/loopback helper. Keep the
        // legacy permission plus Edge's split local and loopback permissions.
        iframe.setAttribute('allow', 'local-network-access; loopback-network; local-network');
        iframe.style.cssText = 'border: none; width: 100%; height: 100%; margin: 0; padding: 0; display: block;';
        body.appendChild(iframe);
        initializeLocalAccessPrompt();

        // Initialize persistent parent player UI
        injectStyles();
        createFloatingWidget();
        initMiniVisualizer();
        activateInlineFallback();
        restoreStateFromStorage();
        fetchPlaylists();

        let iframeObserver = null;

        // Start checking Pomodoro state in the parent
        pingInterval = setInterval(() => {
            checkPomodoroState();
            syncPlayerPosition();
        }, 1000);
        checkPomodoroState();
        syncPlayerPosition();

        // Sync URL & Title when iframe navigates
        iframe.addEventListener('load', () => {
            try {
                const iframeUrl = iframe.contentWindow.location.href;
                if (window.location.href !== iframeUrl) {
                    window.history.pushState(null, '', iframeUrl);
                }
                document.title = iframe.contentWindow.document.title;
            } catch (e) {
                console.warn('[Global Player] URL sync blocked or failed:', e);
            }

            // Sync position on page load
            syncPlayerPosition();

            // Set up listener for resizing inside iframe
            try {
                if (iframe.contentWindow) {
                    iframe.contentWindow.removeEventListener('resize', syncPlayerPosition);
                    iframe.contentWindow.addEventListener('resize', syncPlayerPosition);
                }
            } catch (e) {
                console.warn('[Global Player] Failed to bind inner resize:', e);
            }

            // Set up MutationObserver inside iframe to react to dynamic scrollbar/layout updates
            try {
                if (iframeObserver) {
                    iframeObserver.disconnect();
                }
                if (iframe.contentDocument && iframe.contentDocument.body) {
                    iframeObserver = new MutationObserver(() => {
                        syncPlayerPosition();
                    });
                    iframeObserver.observe(iframe.contentDocument.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                }
            } catch (e) {
                console.warn('[Global Player] Failed to set up inner MutationObserver:', e);
            }
        });

        // Listen for browser navigation buttons to sync back with iframe
        window.addEventListener('popstate', () => {
            iframe.src = window.location.href;
        });

        // Listen to parent window resize
        window.addEventListener('resize', syncPlayerPosition);
    });

    // Restore player state from localStorage for cross-module persistence
    function restoreStateFromStorage() {
        try {
            const stateStr = localStorage.getItem('gnosys_audio_engine_state');
            if (stateStr) {
                const state = JSON.parse(stateStr);
                if (state && state.track) {
                    currentTrack = state.track;
                    playingClassId = state.classId || null;
                    isPaused = state.paused !== false;
                    volume = state.volume || 0.8;
                    currentTime = state.currentTime || 0;
                    duration = state.duration || 0;
                    
                    // Restore volume slider
                    const vol = document.getElementById('gnosys-player-volume');
                    if (vol) vol.value = volume;
                }
            }
        } catch (e) {
            console.warn('[Global Player] Failed to restore state from localStorage:', e);
        }

        // Restore drawer open state
        const drawerOpen = localStorage.getItem('gnosys_player_drawer_open');
        if (drawerOpen === 'true') {
            const overlay = document.getElementById('gnosys-player-overlay');
            if (overlay) overlay.classList.add('active');
        }
    }

    // Fetch lists from backend
    async function fetchPlaylists() {
        try {
            const res = await fetch(`${API_BASE}/api/playlists`);
            if (!res.ok) throw new Error(`Playlist service returned ${res.status}.`);
            const data = await res.json();
            if (data && data.playlists) {
                playlistBackendWarningShown = false;
                playlists = data.playlists;
                renderPlaylistTracks();
                renderClassOptions();
            }
        } catch (e) {
            if (!playlistBackendWarningShown) {
                console.warn('[Global Player] Local playlist service is unavailable. Start the Gnosys helper to enable playlists.', e);
                playlistBackendWarningShown = true;
            }
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
        
        if (indicator) {
            if (isEngineAlive || usingInlineFallback) {
                indicator.className = 'status-dot active';
                indicator.title = usingInlineFallback ? 'Audio Engine (Inline Mode)' : 'Audio Engine Active';
            } else {
                indicator.className = 'status-dot inactive';
                indicator.title = 'Audio Engine Popout Closed. Click Play to open.';
            }
        }
    }

    // Launch hidden/popout window with retry logic
    function launchEngineWindow() {
        const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
        const engineUrl = window.location.origin + baseHref + 'music/player-engine.html';
        const w = window.open(
            engineUrl,
            'GnosysPlayerEngine',
            'width=360,height=240,menubar=no,toolbar=no,location=no,status=no,resizable=no'
        );

        // Detect popup blocker
        if (!w || w.closed || typeof w.closed === 'undefined') {
            console.warn('[Global Player] Popup blocked! Falling back to inline audio.');
            activateInlineFallback();
            return null;
        }

        // Set a retry timer: if engine doesn't announce ready within 3s, retry
        if (engineRetryTimer) clearTimeout(engineRetryTimer);
        engineRetryTimer = setTimeout(() => {
            if (!isEngineAlive && !usingInlineFallback) {
                engineLaunchRetries++;
                if (engineLaunchRetries <= MAX_ENGINE_RETRIES) {
                    console.warn(`[Global Player] Engine not responding, retry ${engineLaunchRetries}/${MAX_ENGINE_RETRIES}`);
                    launchEngineWindow();
                } else {
                    console.warn('[Global Player] Engine launch failed after retries. Using inline fallback.');
                    activateInlineFallback();
                }
            }
        }, 3000);

        return w;
    }

    // Inline fallback: create a hidden <audio> element on the main page
    function activateInlineFallback() {
        if (inlineFallbackAudio) return; // Already active
        usingInlineFallback = true;
        isEngineAlive = true; // Treat as alive for UI purposes

        inlineFallbackAudio = document.createElement('audio');
        inlineFallbackAudio.id = 'gnosys-inline-fallback-audio';
        inlineFallbackAudio.style.display = 'none';
        document.body.appendChild(inlineFallbackAudio);

        // Wire up events to mirror the popup engine behaviour
        inlineFallbackAudio.addEventListener('play', () => {
            broadcastInlineState();
            channel.postMessage({ type: 'global_play' });
        });
        inlineFallbackAudio.addEventListener('pause', broadcastInlineState);
        inlineFallbackAudio.addEventListener('timeupdate', broadcastInlineState);
        inlineFallbackAudio.addEventListener('durationchange', broadcastInlineState);
        inlineFallbackAudio.addEventListener('volumechange', broadcastInlineState);
        inlineFallbackAudio.addEventListener('ended', () => {
            broadcastInlineState();
            playNextTrack();
        });

        inlineFallbackAudio.addEventListener('error', (e) => {
            console.error('[Global Player] Inline fallback audio error:', inlineFallbackAudio.error);
            const errorMsg = inlineFallbackAudio.error ? (inlineFallbackAudio.error.message || `Code ${inlineFallbackAudio.error.code}`) : 'Unknown error';
            
            if (!inlineHasTriedFallback && inlineTrackUrl) {
                inlineHasTriedFallback = true;
                let fallbackUrl = inlineTrackUrl;
                if (!fallbackUrl.startsWith('http')) {
                    const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
                    if (fallbackUrl.startsWith('/')) {
                        fallbackUrl = window.location.origin + baseHref + fallbackUrl.substring(1);
                    } else {
                        fallbackUrl = window.location.origin + baseHref + fallbackUrl;
                    }
                }
                console.log('[Global Player] Attempting inline fallback audio URL:', fallbackUrl);
                inlineFallbackAudio.src = fallbackUrl;
                inlineFallbackAudio.play()
                    .then(() => broadcastInlineState())
                    .catch(err => {
                        console.error('[Global Player] Inline fallback playback also failed:', err);
                        showGlobalToast(`Playback Error: ${errorMsg}`, 'error');
                        isPaused = true;
                        broadcastInlineState();
                    });
                return;
            }
            
            showGlobalToast(`Playback Error: ${errorMsg}`, 'error');
            isPaused = true;
            broadcastInlineState();
        });

        updateEngineStatusUI();
        flushPendingCommands();
    }

    function broadcastInlineState() {
        if (!inlineFallbackAudio) return;
        isPaused = inlineFallbackAudio.paused;
        currentTime = inlineFallbackAudio.currentTime;
        duration = inlineFallbackAudio.duration || 0;
        volume = inlineFallbackAudio.volume;
        updateUIState();

        // Mirror localStorage backup like the popup engine does
        const state = {
            type: 'engine_state',
            paused: isPaused,
            currentTime: currentTime,
            duration: duration,
            volume: volume,
            track: currentTrack,
            classId: playingClassId,
            timestamp: Date.now()
        };
        localStorage.setItem('gnosys_audio_engine_state', JSON.stringify(state));
    }

    // Process a command locally on the inline fallback audio element
    function handleInlineCommand(data) {
        if (!inlineFallbackAudio || !data) return;
        switch (data.type) {
            case 'play':
                inlineFallbackAudio.play().catch(err => console.log('Inline play blocked:', err));
                break;
            case 'pause':
                inlineFallbackAudio.pause();
                break;
            case 'set_volume':
                inlineFallbackAudio.volume = Math.max(0, Math.min(1, data.volume));
                break;
            case 'set_time':
                inlineFallbackAudio.currentTime = data.time;
                break;
            case 'load_track':
                inlineTrackUrl = data.track ? data.track.url : data.url;
                inlineHasTriedFallback = false;
                inlineFallbackAudio.src = data.url;
                currentTrack = data.track;
                playingClassId = data.classId;
                inlineFallbackAudio.play()
                    .then(() => broadcastInlineState())
                    .catch(err => { 
                        console.log('Inline playback error (handled by error listener if it fired an error):', err); 
                    });
                break;
            case 'clear_track':
                inlineFallbackAudio.pause();
                inlineFallbackAudio.removeAttribute('src');
                try {
                    inlineFallbackAudio.load();
                } catch (e) {}
                inlineTrackUrl = null;
                currentTrack = null;
                playingClassId = null;
                currentTime = 0;
                duration = 0;
                broadcastInlineState();
                break;
        }
    }

    // Flush any commands buffered while the engine was starting
    function flushPendingCommands() {
        if (pendingEngineCommands.length === 0) return;
        const commands = [...pendingEngineCommands];
        pendingEngineCommands = [];
        commands.forEach(cmd => {
            if (usingInlineFallback) {
                handleInlineCommand(cmd);
            } else {
                channel.postMessage(cmd);
            }
        });
    }

    // Resolve a track URL to an absolute URL using API_BASE
    function resolveTrackUrl(url) {
        if (!url) return url;
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        if (API_BASE) {
            return API_BASE + (url.startsWith('/') ? url : '/' + url);
        }
        const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
        if (url.startsWith('/')) {
            return window.location.origin + baseHref + url.substring(1);
        }
        return window.location.origin + baseHref + url;
    }

    // Listen to engine updates
    channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'engine_ready') {
            // Engine popup just initialized — mark alive and flush queued commands
            isEngineAlive = true;
            engineLaunchRetries = 0;
            if (engineRetryTimer) { clearTimeout(engineRetryTimer); engineRetryTimer = null; }
            updateEngineStatusUI();
            flushPendingCommands();
        } else if (data.type === 'engine_state') {
            isEngineAlive = true;
            isPaused = data.paused;
            currentTime = data.currentTime;
            duration = data.duration;
            volume = data.volume;
            currentTrack = data.track;
            playingClassId = data.classId;
            if (currentTrack) {
                isTrackLoadedInEngine = true;
            }
            
            // Auto update active playlist if loading a track from another class
            if (data.classId && data.classId !== activeClassId && document.getElementById('gnosys-player-overlay').classList.contains('active')) {
                // Keep class selector in sync
                const select = document.getElementById('gnosys-player-class-select');
                if (select) {
                    activeClassId = data.classId;
                    select.value = activeClassId;
                    localStorage.setItem('gnosys_player_activeClassId', activeClassId);
                    renderPlaylistTracks();
                }
            }
            
            updateUIState();
        } else if (data.type === 'engine_error') {
            console.error('[Global Player] Engine error received:', data.error);
            showGlobalToast(`Playback Error: ${data.error}`, 'error');
            isPaused = true;
            updateUIState();
        } else if (data.type === 'track_ended') {
            playNextTrack();
        } else if (data.type === 'prev') {
            playPrevTrack();
        } else if (data.type === 'next') {
            playNextTrack();
        } else if (data.type === 'playlist_updated') {
            // Another window (Music Studio) added/changed a track — refresh list
            fetchPlaylists();
        } else if (data.type === 'pause') {
            if (usingInlineFallback && inlineFallbackAudio) {
                inlineFallbackAudio.pause();
            } else {
                sendEngineCommand({ type: 'pause' });
            }
            isPaused = true;
            updateUIState();
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
            <div class="badge-ripples">
                <div class="ripple-wave"></div>
                <div class="ripple-wave"></div>
                <div class="ripple-wave"></div>
            </div>
            <div class="badge-content">
                <i class="fa-solid fa-music text-pink-400"></i>
                <div class="equalizer-bar-container">
                    <div class="eq-bar"></div>
                    <div class="eq-bar"></div>
                    <div class="eq-bar"></div>
                </div>
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
                <!-- Launch Music Studio Button -->
                <div style="margin-bottom: 5px;">
                    <a id="gnosys-player-studio-link" href="#" class="studio-link-btn">
                        <i class="fa-solid fa-sliders"></i>
                        <span>Launch Music Studio AI</span>
                    </a>
                </div>

                <!-- Dropdown Class Selector -->
                <div class="form-group">
                    <label>Active Subject Playlist</label>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <select id="gnosys-player-class-select" class="glass-select"></select>
                        <div id="gnosys-player-new-playlist-input-container" class="hidden" style="display: flex; gap: 6px; align-items: center;">
                            <input type="text" id="gnosys-player-new-playlist-input" placeholder="New playlist name..." class="glass-input" style="flex: 1; min-width: 0;">
                            <button id="gnosys-player-new-playlist-submit" class="studio-action-btn" style="padding: 10px 14px; font-size: 13px; font-weight: 700; background: linear-gradient(135deg, #d946ef 0%, #6366f1 100%); border: none; border-radius: 12px; color: #fff; cursor: pointer; transition: opacity 0.2s;">Create</button>
                            <button id="gnosys-player-new-playlist-cancel" style="padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
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

                <!-- Collapsible Settings Section -->
                <div class="player-settings-section">
                    <div class="settings-header" id="gnosys-settings-toggle">
                        <span><i class="fa-solid fa-gear mr-1"></i> Auto-Download Settings</span>
                        <i class="fa-solid fa-chevron-down toggle-icon" id="gnosys-settings-chevron"></i>
                    </div>
                    <div class="settings-content hidden" id="gnosys-settings-content">
                        <div class="settings-row">
                            <span class="switch-label">Enable Auto-Download</span>
                            <label class="switch">
                                <input type="checkbox" id="gnosys-auto-download-toggle">
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div class="settings-row folder-row">
                            <div class="folder-info">
                                <span class="label">Download Folder</span>
                                <span class="folder-name" id="gnosys-download-folder-display">Not Configured</span>
                            </div>
                            <button id="gnosys-change-folder-btn" class="select-folder-btn" style="border: none;">
                                <i class="fa-solid fa-folder-open"></i> Select Folder
                            </button>
                        </div>
                        <div class="settings-status-row">
                            <span class="status-badge" id="gnosys-api-status-badge">Checking...</span>
                        </div>
                    </div>
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

        // Bind Launch Music Studio AI Link
        const studioLink = document.getElementById('gnosys-player-studio-link');
        if (studioLink) {
            const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
            const musicStudioUrl = window.location.origin + baseHref + 'music/index.html';
            studioLink.href = musicStudioUrl;
            studioLink.addEventListener('click', (e) => {
                e.preventDefault();
                const iframe = document.getElementById('gnosys-content-frame');
                if (iframe) {
                    iframe.src = musicStudioUrl;
                    toggleDrawer(); // Close the drawer on navigation
                }
            });
        }
        
        const select = document.getElementById('gnosys-player-class-select');
        const newPlaylistContainer = document.getElementById('gnosys-player-new-playlist-input-container');
        const newPlaylistInput = document.getElementById('gnosys-player-new-playlist-input');
        const newPlaylistSubmit = document.getElementById('gnosys-player-new-playlist-submit');
        const newPlaylistCancel = document.getElementById('gnosys-player-new-playlist-cancel');

        if (select) {
            select.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'create-new-playlist') {
                    if (newPlaylistContainer) {
                        newPlaylistContainer.classList.remove('hidden');
                        if (newPlaylistInput) {
                            newPlaylistInput.value = '';
                            newPlaylistInput.focus();
                        }
                    }
                    select.value = activeClassId;
                    return;
                }
                activeClassId = val;
                localStorage.setItem('gnosys_player_activeClassId', activeClassId);
                renderPlaylistTracks();
            });
        }

        if (newPlaylistCancel && newPlaylistContainer) {
            newPlaylistCancel.addEventListener('click', () => {
                newPlaylistContainer.classList.add('hidden');
            });
        }

        if (newPlaylistSubmit && newPlaylistContainer && newPlaylistInput) {
            newPlaylistSubmit.addEventListener('click', async () => {
                const name = newPlaylistInput.value.trim();
                if (!name) {
                    showGlobalToast('Please enter a playlist name.', 'error');
                    return;
                }
                newPlaylistSubmit.disabled = true;
                newPlaylistSubmit.textContent = '...';
                try {
                    const response = await fetch(`${API_BASE}/api/playlists/create`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ name: name })
                    });
                    const resData = await response.json();
                    if (resData.status === 'success') {
                        showGlobalToast(`Playlist "${name}" created!`, 'success');
                        newPlaylistContainer.classList.add('hidden');
                        
                        activeClassId = resData.class_id;
                        localStorage.setItem('gnosys_player_activeClassId', activeClassId);
                        
                        await fetchPlaylists();
                        
                        window.dispatchEvent(new CustomEvent('gnosys_playlist_updated'));
                        channel.postMessage({ type: 'playlist_updated' });
                    } else {
                        showGlobalToast(resData.message || 'Failed to create playlist.', 'error');
                    }
                } catch (err) {
                    console.error('[Global Player] Error creating playlist:', err);
                    showGlobalToast('Error creating playlist.', 'error');
                } finally {
                    newPlaylistSubmit.disabled = false;
                    newPlaylistSubmit.textContent = 'Create';
                }
            });

            newPlaylistInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    newPlaylistSubmit.click();
                }
            });
        }

        // Controls binding
        document.getElementById('gnosys-player-btn-play').addEventListener('click', togglePlay);
        document.getElementById('gnosys-player-btn-prev').addEventListener('click', playPrevTrack);
        document.getElementById('gnosys-player-btn-next').addEventListener('click', playNextTrack);
        
        const vol = document.getElementById('gnosys-player-volume');
        vol.addEventListener('input', (e) => {
            volume = parseFloat(e.target.value);
            sendEngineCommand({ type: 'set_volume', volume: volume });
        });

        // Seek bar binding
        const seekBar = document.getElementById('gnosys-player-seek-bar');
        seekBar.addEventListener('click', (e) => {
            if (!duration) return;
            const rect = seekBar.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            const seekTime = clickPos * duration;
            sendEngineCommand({ type: 'set_time', time: seekTime });
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

        // Settings Section Event Listeners
        const settingsToggle = document.getElementById('gnosys-settings-toggle');
        const settingsContent = document.getElementById('gnosys-settings-content');
        const autoDownloadToggle = document.getElementById('gnosys-auto-download-toggle');
        const changeFolderBtn = document.getElementById('gnosys-change-folder-btn');

        if (settingsToggle && settingsContent) {
            settingsToggle.addEventListener('click', () => {
                const isHidden = settingsContent.classList.contains('hidden');
                if (isHidden) {
                    settingsContent.classList.remove('hidden');
                    settingsToggle.classList.add('active');
                    localStorage.setItem('gnosys_player_settings_open', 'true');
                } else {
                    settingsContent.classList.add('hidden');
                    settingsToggle.classList.remove('active');
                    localStorage.setItem('gnosys_player_settings_open', 'false');
                }
            });

            // Restore settings panel toggle state
            const settingsOpen = localStorage.getItem('gnosys_player_settings_open');
            if (settingsOpen === 'true') {
                settingsContent.classList.remove('hidden');
                settingsToggle.classList.add('active');
            }
        }

        if (autoDownloadToggle) {
            const autoDownloadEnabled = localStorage.getItem('gnosys_auto_download_enabled') !== 'false';
            autoDownloadToggle.checked = autoDownloadEnabled;
            autoDownloadToggle.addEventListener('change', (e) => {
                localStorage.setItem('gnosys_auto_download_enabled', e.target.checked ? 'true' : 'false');
                showGlobalToast(e.target.checked ? 'Auto-download enabled!' : 'Auto-download disabled.');
            });
        }

        if (changeFolderBtn) {
            changeFolderBtn.addEventListener('click', async () => {
                if (!('showDirectoryPicker' in window)) {
                    showGlobalToast('File System Access API not supported in this browser.', 'error');
                    return;
                }
                try {
                    const dirHandle = await window.showDirectoryPicker({
                        mode: 'readwrite'
                    });
                    await setStoredDirectoryHandle(dirHandle);
                    localStorage.setItem('gnosys_download_dir_name', dirHandle.name);
                    updateSettingsUI();
                    showGlobalToast(`Download folder set to: ${dirHandle.name}`, 'success');
                } catch (err) {
                    console.error('[Global Player] Failed to pick directory:', err);
                    if (err.name !== 'AbortError') {
                        showGlobalToast(`Failed to set folder: ${err.message}`, 'error');
                    }
                }
            });
        }

        updateSettingsUI();
    }

    function toggleDrawer() {
        const overlay = document.getElementById('gnosys-player-overlay');
        overlay.classList.toggle('active');
        const isOpen = overlay.classList.contains('active');
        localStorage.setItem('gnosys_player_drawer_open', isOpen ? 'true' : 'false');
        if (isOpen) {
            // Context-Aware Auto-Detect:
            // 1. Try reading the active subject from the iframe's chatbot subject-selector (if inside Music Studio)
            let detectedClassId = null;
            try {
                const iframe = document.getElementById('gnosys-content-frame');
                if (iframe && iframe.contentWindow) {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    const subjectSelector = doc.getElementById('subject-selector');
                    if (subjectSelector && subjectSelector.value && subjectSelector.value !== 'custom') {
                        detectedClassId = subjectSelector.value;
                    }
                }
            } catch (e) {
                // Ignore cross-origin error, though Gnosys AI should be on same origin
            }
            
            // 2. Fall back to path-based detection if no chatbot selector found
            if (!detectedClassId) {
                detectedClassId = getCurrentClassId();
            }
            
            if (detectedClassId && detectedClassId !== activeClassId) {
                activeClassId = detectedClassId;
                localStorage.setItem('gnosys_player_activeClassId', activeClassId);
                const select = document.getElementById('gnosys-player-class-select');
                if (select) {
                    select.value = activeClassId;
                }
            }

            fetchPlaylists();
        }
    }

    function renderClassOptions() {
        const select = document.getElementById('gnosys-player-class-select');
        if (!select) return;
        
        const sourceList = (playlists && Object.keys(playlists).length > 0) ? 
            Object.entries(playlists).map(([id, info]) => [id, info.class_name]) :
            Object.entries(CLASS_NAMES);
            
        let optionsHtml = sourceList.map(([id, name]) => `
            <option value="${id}" ${id === activeClassId ? 'selected' : ''}>${name}</option>
        `).join('');
        
        optionsHtml += `<option value="create-new-playlist">+ Create Custom Playlist...</option>`;
        
        select.innerHTML = optionsHtml;
        // Force the dropdown value to match activeClassId explicitly after updating options
        select.value = activeClassId;
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
                        <button class="row-btn move-btn" data-id="${track.id}" title="Move to Playlist"><i class="fa-solid fa-right-left"></i></button>
                        <button class="row-btn download-track-btn" data-url="${track.url}" data-name="${track.name}" title="Download"><i class="fa-solid fa-download"></i></button>
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

        // Move track inline action
        list.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackId = btn.getAttribute('data-id');
                const row = btn.closest('.track-row');
                
                // Save original action HTML
                const originalActions = row.querySelector('.actions').innerHTML;
                const actionsContainer = row.querySelector('.actions');
                const nameDisplay = row.querySelector('.track-name-click');
                const dragHandle = row.querySelector('.drag-handle');
                
                // Hide drag handle and name display, replace with select dropdown
                dragHandle.style.display = 'none';
                nameDisplay.style.display = 'none';
                
                // Generate inline playlist options
                let selectHtml = `<select class="inline-playlist-select" style="flex: 1; min-width: 120px; font-size: 11px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.15); color: #f8fafc; border-radius: 6px; padding: 2px 4px; outline: none; margin-right: 6px;">`;
                for (const [classId, className] of Object.entries(CLASS_NAMES)) {
                    if (classId !== activeClassId) {
                        selectHtml += `<option value="${classId}">${className}</option>`;
                    }
                }
                selectHtml += `</select>`;
                
                // Insert select element before actions
                const selectWrapper = document.createElement('div');
                selectWrapper.className = 'inline-select-wrapper';
                selectWrapper.style.cssText = 'display: flex; flex: 1; align-items: center; overflow: hidden;';
                selectWrapper.innerHTML = selectHtml;
                row.insertBefore(selectWrapper, actionsContainer);
                
                // Update actions to confirm / cancel buttons
                actionsContainer.innerHTML = `
                    <button class="row-btn confirm-move-btn" style="color: #10b981;" title="Confirm Move"><i class="fa-solid fa-check"></i></button>
                    <button class="row-btn cancel-move-btn" style="color: #ef4444;" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
                `;
                
                // Bind Confirm / Cancel listeners
                const cancelBtn = actionsContainer.querySelector('.cancel-move-btn');
                const confirmBtn = actionsContainer.querySelector('.confirm-move-btn');
                const selectElement = selectWrapper.querySelector('.inline-playlist-select');
                
                cancelBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    selectWrapper.remove();
                    dragHandle.style.display = '';
                    nameDisplay.style.display = '';
                    actionsContainer.innerHTML = originalActions;
                    // Re-bind actions since we innerHTML'd them
                    renderPlaylistTracks();
                });
                
                confirmBtn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    const destClassId = selectElement.value;
                    confirmBtn.disabled = true;
                    cancelBtn.disabled = true;
                    confirmBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
                    
                    const success = await moveTrackOnServer(activeClassId, destClassId, trackId);
                    if (success) {
                        await fetchPlaylists();
                    } else {
                        alert("Failed to move track.");
                        renderPlaylistTracks();
                    }
                });
            });
        });

        // Click track to download
        list.querySelectorAll('.download-track-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const trackUrl = btn.getAttribute('data-url');
                const trackName = btn.getAttribute('data-name');
                const ext = trackUrl.split('.').pop() || 'mp3';
                const filename = `${trackName.replace(/[^a-z0-9_-]/gi, '_')}.${ext}`;
                await downloadTrackFile(trackUrl, filename);
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

    // Send a command — either to the BroadcastChannel, inline fallback, or queue it
    function sendEngineCommand(cmd) {
        if (usingInlineFallback) {
            handleInlineCommand(cmd);
        } else if (isEngineAlive) {
            channel.postMessage(cmd);
        } else {
            // Engine not ready yet — queue the command for later
            pendingEngineCommands.push(cmd);
        }
    }

    // Playback control trigger
    function togglePlay() {
        if (!isEngineAlive && !usingInlineFallback) {
            // Engine is closed, launch and queue commands
            launchEngineWindow();
            if (currentTrack) {
                if (!isTrackLoadedInEngine) {
                    sendLoadTrackMessageOfClass(playingClassId || activeClassId, currentTrack);
                } else {
                    sendEngineCommand({ type: 'play' });
                }
            } else {
                playTrack(0);
            }
            return;
        }

        if (!currentTrack) {
            playTrack(0);
            return;
        }

        if (!isTrackLoadedInEngine) {
            sendLoadTrackMessageOfClass(playingClassId || activeClassId, currentTrack);
            return;
        }

        if (isPaused) {
            sendEngineCommand({ type: 'play' });
        } else {
            sendEngineCommand({ type: 'pause' });
        }
    }

    function playTrack(idx) {
        playingClassId = activeClassId;
        playTrackOfClass(activeClassId, idx);
    }

    function playTrackOfClass(classId, idx) {
        const playlist = playlists[classId];
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
        
        // Clamp bounds
        if (idx < 0) idx = playlist.tracks.length - 1;
        if (idx >= playlist.tracks.length) idx = 0;

        const track = playlist.tracks[idx];
        
        if (!isEngineAlive && !usingInlineFallback) {
            launchEngineWindow();
        }
        sendLoadTrackMessageOfClass(classId, track);
    }

    function sendLoadTrackMessageOfClass(classId, track) {
        const resolvedUrl = resolveTrackUrl(track.url);
        isTrackLoadedInEngine = true;
        sendEngineCommand({
            type: 'load_track',
            url: resolvedUrl,
            track: track,
            classId: classId,
            className: (playlists[classId] && playlists[classId].class_name) || CLASS_NAMES[classId] || 'Idle'
        });
    }

    function playNextTrack() {
        const targetClassId = playingClassId || activeClassId;
        const playlist = playlists[targetClassId];
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
        
        let idx = 0; // Default to first track
        if (currentTrack) {
            const currentIdx = playlist.tracks.findIndex(t => t.id === currentTrack.id);
            if (currentIdx !== -1) {
                idx = currentIdx + 1;
            }
        }
        playTrackOfClass(targetClassId, idx);
    }

    function playPrevTrack() {
        const targetClassId = playingClassId || activeClassId;
        const playlist = playlists[targetClassId];
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
        
        let idx = playlist.tracks.length - 1; // Default to last track
        if (currentTrack) {
            const currentIdx = playlist.tracks.findIndex(t => t.id === currentTrack.id);
            if (currentIdx !== -1) {
                idx = currentIdx - 1;
            }
        }
        playTrackOfClass(targetClassId, idx);
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
            const currentClassId = playingClassId || activeClassId;
            const currentClassName = (playlists[currentClassId] && playlists[currentClassId].class_name) || CLASS_NAMES[currentClassId] || 'Unknown';
            if (subjectDisplay) subjectDisplay.textContent = `Subject: ${currentClassName}`;
        } else {
            if (trackDisplay) trackDisplay.textContent = 'No track playing';
            if (subjectDisplay) subjectDisplay.textContent = 'Subject: None';
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

        if (duration && currentTrack) {
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

        // Update badge playing state & icon animation
        const badge = document.getElementById('gnosys-global-player-widget');
        if (badge) {
            const icon = badge.querySelector('i');
            if (!isPaused && currentTrack) {
                badge.classList.add('playing');
                if (icon) {
                    icon.classList.remove('fa-music', 'text-pink-400');
                    icon.classList.add('fa-compact-disc', 'text-pink-500');
                }
            } else {
                badge.classList.remove('playing');
                if (icon) {
                    icon.classList.remove('fa-compact-disc', 'text-pink-500');
                    icon.classList.add('fa-music', 'text-pink-400');
                }
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
                    sendEngineCommand({ type: 'clear_track' });
                    currentTrack = null;
                    isTrackLoadedInEngine = false;
                }
                await fetchPlaylists();
            }
        } catch (e) {
            console.error('[Global Player] Failed to delete track:', e);
        }
    }

    async function moveTrackOnServer(srcClassId, destClassId, trackId) {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/move-track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    src_class_id: srcClassId,
                    dest_class_id: destClassId,
                    track_id: trackId
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                // If the moved track is currently playing, update its playing class ID and relative URL path
                if (currentTrack && currentTrack.id === trackId) {
                    playingClassId = destClassId;
                    const ext = currentTrack.url.split('.').pop();
                    currentTrack.url = `/music/saved_tracks/${destClassId}/${currentTrack.id}.${ext}`;
                    updateUIState();
                }
                
                // Post to BroadcastChannel to notify other components/instances of the update
                try {
                    const notifyChannel = new BroadcastChannel('gnosys_audio_channel');
                    notifyChannel.postMessage({ type: 'playlist_updated', classId: srcClassId });
                    notifyChannel.postMessage({ type: 'playlist_updated', classId: destClassId });
                } catch (err) {
                    console.warn('[Global Player] Failed to post playlist_updated notification:', err);
                }
                return true;
            }
        } catch (e) {
            console.error('[Global Player] Failed to move track on server:', e);
        }
        return false;
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
                    sendEngineCommand({ type: 'set_volume', volume: 0.1 });
                    const vol = document.getElementById('gnosys-player-volume');
                    if (vol) vol.value = 0.1;
                } else if (!state.alarmActive && preAlarmVolume !== null) {
                    // Alarm cleared. Restore original volume!
                    sendEngineCommand({ type: 'set_volume', volume: preAlarmVolume });
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

    async function downloadTrackFile(url, filename, isManual = true) {
        let targetUrl = url;
        if (!targetUrl.startsWith('http') && !targetUrl.startsWith('data:')) {
            const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
            if (targetUrl.startsWith('/')) {
                targetUrl = window.location.origin + baseHref + targetUrl.substring(1);
            } else {
                targetUrl = window.location.origin + baseHref + targetUrl;
            }
        }
        
        // Use API_BASE if on GitHub Pages
        if (API_BASE && !url.startsWith('http') && !url.startsWith('data:')) {
            targetUrl = API_BASE + url;
        }

        try {
            const res = await fetch(targetUrl);
            const blob = await res.blob();
            
            // Allow user to choose folder if showSaveFilePicker is supported (only if manual download)
            if ('showSaveFilePicker' in window && isManual) {
                const ext = filename.split('.').pop() || 'mp3';
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Audio File',
                        accept: {
                            [`audio/${ext === 'mp3' ? 'mpeg' : ext}`]: [`.${ext}`]
                        }
                    }]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                showGlobalToast('Track successfully saved to your system!');
            } else {
                // Fallback to standard <a> tag click
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                showGlobalToast('Track download started!');
            }
        } catch (err) {
            console.error('Download failed:', err);
            // Fallback for user cancellation or cross-origin block
            if (err.name !== 'AbortError') {
                if (isManual) {
                    const a = document.createElement('a');
                    a.href = targetUrl;
                    a.download = filename;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    showGlobalToast('Auto-download blocked by browser security. Download manually from the track list.', 'warning');
                }
            }
        }
    }

    function showGlobalToast(msg, type = 'success') {
        if (window.GnosysLLM && typeof window.GnosysLLM.showTransientToast === 'function') {
            window.GnosysLLM.showTransientToast(msg, type);
            return;
        }

        // Custom DOM toast system fallback (non-blocking)
        let toastContainer = document.getElementById('gnosys-custom-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'gnosys-custom-toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 24px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
            padding: 12px 20px;
            border-radius: 8px;
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
            background: ${type === 'error' ? 'rgba(239, 68, 68, 0.95)' : type === 'info' ? 'rgba(99, 102, 241, 0.95)' : 'rgba(15, 23, 42, 0.95)'};
            border: 1px solid ${type === 'error' ? 'rgba(239, 68, 68, 0.2)' : type === 'info' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)'};
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            backdrop-filter: blur(8px);
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
            font-family: 'Outfit', sans-serif;
        `;
        
        const icon = type === 'error' ? '<i class="fa-solid fa-triangle-exclamation mr-2 text-red-400"></i>' :
                     type === 'info' ? '<i class="fa-solid fa-circle-info mr-2 text-indigo-400"></i>' :
                     '<i class="fa-solid fa-circle-check mr-2 text-green-400"></i>';
                     
        toast.innerHTML = `${icon}<span>${msg}</span>`;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // IndexedDB Helpers for Directory Handles
    const DB_NAME = 'GnosysMusicDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'settings';
    const KEY_DIR_HANDLE = 'download_directory_handle';

    function getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    function getStoredDirectoryHandle() {
        return getDB().then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(KEY_DIR_HANDLE);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    function setStoredDirectoryHandle(handle) {
        return getDB().then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(handle, KEY_DIR_HANDLE);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        });
    }

    async function verifyPermission(handle, readWrite) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        try {
            if ((await handle.queryPermission(options)) === 'granted') {
                return true;
            }
            if ((await handle.requestPermission(options)) === 'granted') {
                return true;
            }
        } catch (e) {
            console.error('[Global Player] Permission request failed:', e);
        }
        return false;
    }

    async function handleAutoDownload(track) {
        // Check if auto-download is enabled
        const autoDownloadEnabled = localStorage.getItem('gnosys_auto_download_enabled') !== 'false';
        if (!autoDownloadEnabled) {
            console.log('[Global Player] Auto-download is disabled in settings.');
            return;
        }

        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            console.warn('[Global Player] File System Access API not supported. Falling back to standard download.');
            const ext = track.filename ? track.filename.split('.').pop() : 'wav';
            const filename = track.filename || `${track.name.replace(/[\/\\:\*\?"<>\|]/g, '_')}.${ext}`;
            downloadTrackFile(track.url, filename, false);
            return;
        }

        try {
            let dirHandle = await getStoredDirectoryHandle();
            let needToPrompt = !dirHandle;

            if (dirHandle) {
                const hasPermission = await verifyPermission(dirHandle, true);
                if (!hasPermission) {
                    needToPrompt = true;
                }
            }

            if (needToPrompt) {
                // Since we are running asynchronously after a network fetch, we cannot prompt for a directory picker here 
                // due to browser security restrictions requiring a user gesture. Fallback to standard browser download.
                console.warn('[Global Player] Auto-download directory permission missing or expired. Falling back to standard browser download.');
                const ext = track.filename ? track.filename.split('.').pop() : 'wav';
                const filename = track.filename || `${track.name.replace(/[\/\\:\*\?"<>\|]/g, '_')}.${ext}`;
                downloadTrackFile(track.url, filename, false);
                return;
            }

            if (!dirHandle) return;

            const resolvedUrl = resolveTrackUrl(track.url);
            
            const res = await fetch(resolvedUrl);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const blob = await res.blob();

            const ext = track.filename ? track.filename.split('.').pop() : 'wav';
            const filename = track.filename || `${track.name.replace(/[\/\\:\*\?"<>\|]/g, '_')}.${ext}`;
            
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            showGlobalToast(`Saved "${track.name}" to folder: ${dirHandle.name}`, 'success');
        } catch (err) {
            console.error('[Global Player] Auto-download failed:', err);
            if (err.name !== 'AbortError') {
                showGlobalToast(`Auto-download failed: ${err.message}. Falling back to standard download.`, 'error');
                const ext = track.filename ? track.filename.split('.').pop() : 'wav';
                const filename = track.filename || `${track.name.replace(/[\/\\:\*\?"<>\|]/g, '_')}.${ext}`;
                downloadTrackFile(track.url, filename, false);
            }
        }
    }

    function updateSettingsUI() {
        const folderDisplay = document.getElementById('gnosys-download-folder-display');
        const badge = document.getElementById('gnosys-api-status-badge');
        
        if (!folderDisplay || !badge) return;

        const isSupported = 'showDirectoryPicker' in window;
        if (isSupported) {
            badge.textContent = 'API Supported';
            badge.className = 'status-badge supported';
        } else {
            badge.textContent = 'API Not Supported';
            badge.className = 'status-badge unsupported';
            const changeFolderBtn = document.getElementById('gnosys-change-folder-btn');
            if (changeFolderBtn) changeFolderBtn.disabled = true;
        }

        const dirName = localStorage.getItem('gnosys_download_dir_name');
        if (dirName) {
            folderDisplay.textContent = `📁 ${dirName}`;
        } else {
            folderDisplay.textContent = 'Not Configured';
        }
    }

    async function prepareDirectoryPermission() {
        const autoDownloadEnabled = localStorage.getItem('gnosys_auto_download_enabled') !== 'false';
        if (!autoDownloadEnabled) return;
        if (!('showDirectoryPicker' in window)) return;

        let dirHandle = await getStoredDirectoryHandle();
        let needToPrompt = !dirHandle;

        if (dirHandle) {
            const hasPermission = await verifyPermission(dirHandle, true);
            if (!hasPermission) {
                needToPrompt = true;
            }
        }

        if (needToPrompt) {
            showGlobalToast('Please select a local folder for automatic music downloads.', 'info');
            dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            await setStoredDirectoryHandle(dirHandle);
            localStorage.setItem('gnosys_download_dir_name', dirHandle.name);
            updateSettingsUI();
        }
    }

    window.addEventListener('gnosys_prepare_auto_download', (e) => {
        e.detail.promise = prepareDirectoryPermission();
    });

    window.addEventListener('gnosys_auto_download', async (e) => {
        const { track } = e.detail;
        if (track) {
            await handleAutoDownload(track);
        }
    });

    window.addEventListener('gnosys_playlist_updated', () => {
        fetchPlaylists();
    });

    window.addEventListener('gnosys_set_active_class', (e) => {
        const { classId } = e.detail;
        if (classId && classId !== activeClassId) {
            activeClassId = classId;
            localStorage.setItem('gnosys_player_activeClassId', activeClassId);
            const select = document.getElementById('gnosys-player-class-select');
            if (select) {
                select.value = activeClassId;
            }
            renderPlaylistTracks();
        }
    });

    // Inject CSS styles
    function injectStyles() {
        if (document.getElementById('gnosys-player-global-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'gnosys-player-global-styles';
        style.innerHTML = `
            /* Widget style */
            .gnosys-player-badge {
                position: fixed;
                bottom: 92px; /* Stacked right above Stats widget (which is at ~24px) */
                right: 24px;
                width: 56px;
                height: 56px;
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
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s, border-color 0.3s, box-shadow 0.3s, opacity 0.3s;
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
                font-size: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                line-height: 1;
                vertical-align: middle;
                transform-origin: center center;
            }
            
            /* Status dot inside badge */
            .status-dot {
                position: absolute;
                bottom: 6px;
                right: 6px;
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
            
            /* Ripple Wave Animations */
            .gnosys-player-badge .badge-ripples {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                pointer-events: none;
                z-index: -1;
            }
            .gnosys-player-badge.playing .ripple-wave {
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 50%;
                border: 1.5px solid rgba(217, 70, 239, 0.45);
                box-shadow: 0 0 15px rgba(217, 70, 239, 0.25);
                opacity: 0;
                animation: soundWavePropagation 2.4s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
            }
            .gnosys-player-badge.playing .ripple-wave:nth-child(2) {
                animation-delay: 0.8s;
            }
            .gnosys-player-badge.playing .ripple-wave:nth-child(3) {
                animation-delay: 1.6s;
            }
            
            @keyframes soundWavePropagation {
                0% {
                    transform: scale(1);
                    opacity: 0.8;
                }
                100% {
                    transform: scale(2.0);
                    opacity: 0;
                }
            }

            /* Rotating playback border ring */
            .gnosys-player-badge.playing::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 50%;
                padding: 1.5px;
                background: conic-gradient(from 0deg, #d946ef, #6366f1, #3b82f6, #d946ef);
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                animation: spinSlow 3s linear infinite;
                z-index: 1;
            }

            /* Mini Soundwave Equalizer Columns */
            .equalizer-bar-container {
                display: none;
                align-items: flex-end;
                justify-content: center;
                gap: 2.5px;
                width: 20px;
                height: 16px;
                position: absolute;
                z-index: 2;
            }
            .gnosys-player-badge.playing .equalizer-bar-container {
                display: flex;
            }
            .gnosys-player-badge.playing i {
                display: none !important; /* Hide music note when equalizer is playing */
            }
            
            .eq-bar {
                width: 2.5px;
                height: 4px;
                background-color: #d946ef;
                border-radius: 9999px;
                animation: eqBounce 1.2s ease-in-out infinite alternate;
                box-shadow: 0 0 6px rgba(217, 70, 239, 0.8);
            }
            .eq-bar:nth-child(1) { animation-duration: 0.8s; background-color: #d946ef; }
            .eq-bar:nth-child(2) { animation-duration: 0.5s; background-color: #a855f7; animation-delay: 0.15s; }
            .eq-bar:nth-child(3) { animation-duration: 0.7s; background-color: #6366f1; animation-delay: 0.3s; }
            
            @keyframes eqBounce {
                0% { height: 3px; }
                100% { height: 15px; }
            }

            .gnosys-player-badge.playing {
                animation: badgeGlowPulse 2.4s infinite ease-in-out;
                border-color: transparent !important; /* hide default border to let rotating ring shine */
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
            .glass-input {
                background: rgba(0,0,0,0.25);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                color: #f8fafc;
                padding: 10px 14px;
                font-size: 13px;
                font-weight: 500;
                outline: none;
                transition: border-color 0.2s;
            }
            .glass-input:focus {
                border-color: rgba(217, 70, 239, 0.4);
            }

            /* Studio launch button styling */
            .studio-link-btn {
                background: linear-gradient(135deg, rgba(217, 70, 239, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%);
                border: 1px solid rgba(217, 70, 239, 0.25);
                border-radius: 12px;
                color: #f5f3ff;
                padding: 10px 14px;
                font-size: 13px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(217, 70, 239, 0.04);
            }
            .studio-link-btn:hover {
                background: linear-gradient(135deg, rgba(217, 70, 239, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
                border-color: rgba(217, 70, 239, 0.45);
                transform: translateY(-1px);
                box-shadow: 0 4px 18px rgba(217, 70, 239, 0.12);
                color: #ffffff;
            }
            .studio-link-btn i {
                font-size: 14px;
                color: #d946ef;
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
            .download-track-btn:hover {
                color: #10b981;
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

            /* Settings Section Styles */
            .player-settings-section {
                margin-top: 15px;
                border-top: 1px solid rgba(255,255,255,0.05);
                padding-top: 15px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                color: #94a3b8;
                font-size: 13px;
                font-weight: 600;
                transition: color 0.2s;
                user-select: none;
            }
            .settings-header:hover {
                color: #f8fafc;
            }
            .settings-header .toggle-icon {
                font-size: 11px;
                transition: transform 0.3s ease;
            }
            .settings-header.active .toggle-icon {
                transform: rotate(180deg);
            }
            .settings-content {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 4px 0 8px;
                transition: all 0.3s ease;
            }
            .settings-content.hidden {
                display: none !important;
            }
            .settings-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
            }
            .settings-row.folder-row {
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.04);
                padding: 10px;
                border-radius: 8px;
            }
            .folder-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .folder-info .label {
                color: #64748b;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .folder-info .folder-name {
                color: #cbd5e1;
                font-weight: 500;
                word-break: break-all;
                font-family: monospace;
            }
            .select-folder-btn {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(217, 70, 239, 0.2));
                border: 1px solid rgba(255,255,255,0.08);
                color: #f8fafc;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: all 0.2s;
            }
            .select-folder-btn:hover {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(217, 70, 239, 0.3));
                border-color: rgba(255,255,255,0.15);
            }
            .settings-status-row {
                display: flex;
                justify-content: flex-end;
            }
            .status-badge {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
            }
            .status-badge.supported {
                background: rgba(34, 197, 94, 0.15);
                color: #4ade80;
                border: 1px solid rgba(34, 197, 94, 0.2);
            }
            .status-badge.unsupported {
                background: rgba(239, 68, 68, 0.15);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.2);
            }
            
            /* Toggle Switch Style */
            .switch {
                position: relative;
                display: inline-block;
                width: 34px;
                height: 20px;
            }
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255,255,255,0.1);
                transition: .4s;
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 3px;
                bottom: 3px;
                background-color: #f8fafc;
                transition: .4s;
            }
            input:checked + .slider {
                background: linear-gradient(135deg, #6366f1, #d946ef);
            }
            input:checked + .slider:before {
                transform: translateX(14px);
            }
            .slider.round {
                border-radius: 20px;
            }
            .slider.round:before {
                border-radius: 50%;
            }
        `;
        document.head.appendChild(style);
    }
})();
