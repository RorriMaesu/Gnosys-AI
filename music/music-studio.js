(function() {
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://127.0.0.1:8020';
    let comfyPath = localStorage.getItem('gnosys_comfy_path') || 'D:\\ComfyUI';
    let vramProfile = localStorage.getItem('gnosys_music_vram_profile') || 'high';
    const clientId = Math.random().toString(36).substring(2, 15);
    let ws = null;
    let installPollInterval = null;
    let pendingGeneration = false;
    let isLaunchingService = false;
    let isLaunchingAssistant = false;
    let pendingTrack = null;

    let explorerCurrentPath = comfyPath;

    let downloadPollInterval = null;

    document.addEventListener('DOMContentLoaded', () => {
        // If we are in the top-level parent window wrapper (where the page is wrapped in an iframe), abort
        if (window.self === window.top && document.getElementById('gnosys-content-frame')) {
            return;
        }
        initUI();
        checkMusicServiceStatus();
    });

    async function updatePathStatus(path) {
        const statusDiv = document.getElementById('explorer-path-status');
        if (!statusDiv) return;
        if (!path) {
            statusDiv.innerHTML = '<span class="text-slate-500 font-medium">Select a drive to browse files.</span>';
            return;
        }
        statusDiv.innerHTML = '<span class="text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Probing folder contents...</span>';
        try {
            const res = await fetch(`${API_BASE}/api/music/status`, {
                headers: { 'X-ComfyUI-Path': path }
            });
            const data = await res.json();
            if (data.comfy_installed) {
                statusDiv.innerHTML = '<span class="text-teal-400 font-bold"><i class="fa-solid fa-circle-check mr-1.5"></i> ACE-Step 1.5 root detected here.</span>';
            } else {
                statusDiv.innerHTML = '<span class="text-amber-400"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ACE-Step files not found in this folder.</span>';
            }
        } catch (e) {
            statusDiv.innerHTML = '<span class="text-slate-500">Failed to probe directory.</span>';
        }
    }

    // Helper to query and render directory list
    async function loadDirectory(path) {
        const listContainer = document.getElementById('explorer-list');
        const pathDisplay = document.getElementById('explorer-current-path');
        listContainer.innerHTML = '<div class="text-xs text-slate-400 py-4 text-center"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Scanning directory...</div>';
        
        try {
            const res = await fetch(`${API_BASE}/api/explorer?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            if (data.status === 'success') {
                explorerCurrentPath = path;
                pathDisplay.textContent = path || "My Computer (Root Drives)";
                updatePathStatus(path);
                
                listContainer.innerHTML = '';
                if (data.directories.length === 0) {
                    listContainer.innerHTML = '<div class="text-xs text-slate-500 py-4 text-center">Empty directory or access restricted.</div>';
                    return;
                }
                
                data.directories.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer text-xs text-slate-300 transition-colors border border-transparent hover:border-white/5';
                    
                    let inner = `<i class="fa-solid ${path ? 'fa-folder' : 'fa-hard-drive'} text-indigo-400"></i> <span class="truncate font-medium">${item.name}</span>`;
                    if (item.compatibility) {
                        inner += `<span class="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">${item.compatibility}</span>`;
                    }
                    row.innerHTML = inner;
                    
                    // Simple select on click, browse on dblclick
                    row.addEventListener('click', () => {
                        // Highlight selected row visually
                        Array.from(listContainer.children).forEach(child => child.classList.remove('bg-indigo-500/10', 'border-indigo-500/20'));
                        row.classList.add('bg-indigo-500/10', 'border-indigo-500/20');
                        explorerCurrentPath = item.path;
                        pathDisplay.textContent = item.path;
                        updatePathStatus(item.path);
                    });
                    
                    row.addEventListener('dblclick', () => {
                        loadDirectory(item.path);
                    });
                    
                    listContainer.appendChild(row);
                });
            } else {
                listContainer.innerHTML = `<div class="text-xs text-red-400 py-4 text-center">Error: ${data.message}</div>`;
            }
        } catch (err) {
            listContainer.innerHTML = `<div class="text-xs text-red-400 py-4 text-center">Connection failed: ${err.message}</div>`;
        }
    }

    const PERSISTED_FIELDS = [
        'music-prompt',
        'music-model',
        'music-bpm',
        'music-length',
        'music-steps',
        'music-vocals',
        'music-thinking',
        'music-format',
        'music-key',
        'music-signature',
        'music-seed',
        'music-lm-cfg',
        'lyrics-prompt',
        'generated-lyrics'
    ];

    function saveMusicStudioSettings() {
        const settings = {};
        PERSISTED_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') {
                    settings[id] = el.checked;
                } else {
                    settings[id] = el.value;
                }
            }
        });
        localStorage.setItem('gnosys_music_studio_settings', JSON.stringify(settings));
    }

    function loadMusicStudioSettings() {
        try {
            const settingsStr = localStorage.getItem('gnosys_music_studio_settings');
            if (settingsStr) {
                const settings = JSON.parse(settingsStr);
                PERSISTED_FIELDS.forEach(id => {
                    if (id in settings) {
                        const el = document.getElementById(id);
                        if (el) {
                            if (el.type === 'checkbox') {
                                el.checked = settings[id];
                            } else {
                                el.value = settings[id];
                            }
                        }
                    }
                });
            }
        } catch (e) {
            console.error('[Music Studio] Failed to load persisted settings:', e);
        }
    }

    function initUI() {
        const pathEl = document.getElementById('current-comfy-path');
        if (!pathEl) return;
        pathEl.textContent = comfyPath;
        
        // Auto-start and Auto-download checkboxes
        const autoStartChk = document.getElementById('auto-start-checkbox');
        const autoDownloadChk = document.getElementById('auto-download-checkbox');
        
        if (autoStartChk) {
            const savedAutoStart = localStorage.getItem('gnosys_music_auto_start');
            autoStartChk.checked = savedAutoStart === null ? true : savedAutoStart === 'true';
            autoStartChk.addEventListener('change', (e) => {
                localStorage.setItem('gnosys_music_auto_start', e.target.checked);
                if (e.target.checked) checkMusicServiceStatus();
            });
        }
        
        if (autoDownloadChk) {
            const savedAutoDownload = localStorage.getItem('gnosys_music_auto_download');
            autoDownloadChk.checked = savedAutoDownload === null ? true : savedAutoDownload === 'true';
            autoDownloadChk.addEventListener('change', (e) => {
                localStorage.setItem('gnosys_music_auto_download', e.target.checked);
                if (e.target.checked) checkMusicServiceStatus();
            });
        }

        // Models selector change checker
        const modelSelector = document.getElementById('music-model');
        if (modelSelector) {
            modelSelector.addEventListener('change', () => {
                checkMusicServiceStatus();
            });
        }

        // Preset length buttons handler
        document.querySelectorAll('.preset-length-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.currentTarget.getAttribute('data-value');
                const lengthInput = document.getElementById('music-length');
                if (lengthInput) {
                    lengthInput.value = val;
                    saveMusicStudioSettings();
                }
            });
        });

        // Load persisted studio settings
        loadMusicStudioSettings();

        // Attach event listeners to auto-persist changes
        PERSISTED_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
                el.addEventListener(eventType, saveMusicStudioSettings);
            }
        });

        // Auto-sync active subject selector to playlist dropdown
        const selectSubject = document.getElementById('subject-selector');
        const selectPlaylist = document.getElementById('playlist-target-select');
        if (selectSubject && selectPlaylist) {
            selectSubject.addEventListener('change', () => {
                const val = selectSubject.value;
                if (val === 'medicine') selectPlaylist.value = 'medical-terminology';
                else if (val === 'chemistry') selectPlaylist.value = 'intro-to-chemistry';
                else if (val === 'psychology') selectPlaylist.value = 'psychology-care';
                else if (val === 'anatomy') selectPlaylist.value = 'anatomy-physiology-1';
                else selectPlaylist.value = 'medical-terminology';
            });
        }

        // Add to Playlist Button Handler
        const btnAddPlaylist = document.getElementById('btn-add-to-playlist');
        if (btnAddPlaylist) {
            btnAddPlaylist.addEventListener('click', async () => {
                if (btnAddPlaylist.classList.contains('btn-playlist-success')) return;

                const audioPlayer = document.getElementById('audio-player');
                if (!audioPlayer || !audioPlayer.src || !audioPlayer.src.startsWith('data:')) {
                    showBannerNotification('No generated track available to add.', 'error');
                    return;
                }

                const classId = selectPlaylist ? selectPlaylist.value : 'medical-terminology';
                
                // Prompt user for track name
                const promptVal = document.getElementById('music-prompt').value;
                const bpmVal = document.getElementById('music-bpm').value;
                const defaultName = `${promptVal.substring(0, 35)} (${bpmVal} BPM)`;
                const trackName = prompt("Enter a name for this track:", defaultName);
                if (trackName === null) return; // Cancelled

                const nameToSave = trackName.trim() || defaultName;

                // Show loading state
                const originalHtml = btnAddPlaylist.innerHTML;
                btnAddPlaylist.disabled = true;
                btnAddPlaylist.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Saving...</span>`;

                try {
                    const response = await fetch(`${API_BASE}/api/playlists/save-track`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            class_id: classId,
                            name: nameToSave,
                            audio_base64: audioPlayer.src
                        })
                    });
                    const resData = await response.json();
                    if (resData.status === 'success') {
                        btnAddPlaylist.classList.remove('btn-playlist-glow');
                        btnAddPlaylist.classList.add('btn-playlist-success');
                        btnAddPlaylist.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Added!</span>`;
                        showBannerNotification('Track successfully added to playlist!', 'success');

                        // Automatically download to user's persistent local folder
                        if (resData.track && resData.track.url) {
                            window.dispatchEvent(new CustomEvent('gnosys_auto_download', {
                                detail: { track: resData.track, classId: classId }
                            }));
                        }

                        // Trigger broadcast channel refresh of all global player instances
                        const globalChannel = new BroadcastChannel('gnosys_audio_channel');
                        globalChannel.postMessage({ type: 'playlist_updated' });
                    } else {
                        throw new Error(resData.message);
                    }
                } catch (err) {
                    btnAddPlaylist.innerHTML = originalHtml;
                    btnAddPlaylist.disabled = false;
                    showBannerNotification('Failed to save track: ' + err.message, 'error');
                }
            });
        }

        // Overlap Prevention: Pause background audio engine when local player starts playing
        const localAudio = document.getElementById('audio-player');
        if (localAudio) {
            localAudio.addEventListener('play', () => {
                const globalChannel = new BroadcastChannel('gnosys_audio_channel');
                globalChannel.postMessage({ type: 'pause' });
            });

            localAudio.addEventListener('ended', () => {
                if (pendingTrack) {
                    const url = pendingTrack.url;
                    pendingTrack = null;
                    loadAudioToPlayer(url);
                }
            });

            localAudio.addEventListener('pause', () => {
                // Wait 100ms to verify it's a real pause rather than src transition reset
                setTimeout(() => {
                    if (localAudio.paused && pendingTrack) {
                        const url = pendingTrack.url;
                        pendingTrack = null;
                        loadAudioToPlayer(url);
                    }
                }, 100);
            });
        }

        // Preview player download button click handler
        const downloadPreviewBtn = document.getElementById('btn-download-audio');
        if (downloadPreviewBtn) {
            downloadPreviewBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const audioPlayer = document.getElementById('audio-player');
                if (!audioPlayer.src || audioPlayer.src.startsWith('#') || audioPlayer.src === window.location.href) {
                    showBannerNotification('No audio track loaded to download.', 'error');
                    return;
                }
                const promptVal = document.getElementById('music-prompt').value;
                const bpmVal = document.getElementById('music-bpm').value;
                const ext = audioPlayer.src.startsWith('data:') ? (audioPlayer.src.split(';')[0].split('/').pop() === 'mpeg' ? 'mp3' : audioPlayer.src.split(';')[0].split('/').pop() || 'mp3') : (audioPlayer.src.split('.').pop() || 'mp3');
                const defaultName = `${promptVal.substring(0, 35).replace(/[^a-z0-9_-]/gi, '_')}__${bpmVal}_BPM.${ext}`;
                await downloadTrackFile(audioPlayer.src, defaultName);
            });
        }

        // Download All button
        const downloadAllBtn = document.getElementById('btn-download-all');
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', triggerDownloadAllMissing);
        }
        
        // VRAM profile initialization and change handler
        const vramSelector = document.getElementById('music-vram-profile');
        if (vramSelector) {
            vramSelector.value = vramProfile;
            vramSelector.addEventListener('change', (e) => {
                vramProfile = e.target.value;
                localStorage.setItem('gnosys_music_vram_profile', vramProfile);
            });
        }
        document.getElementById('explorer-current-path').textContent = comfyPath;
        document.getElementById('install-dir-input').value = comfyPath;

        // Path modal controls
        document.getElementById('btn-configure-path').addEventListener('click', () => {
            document.getElementById('path-modal').classList.remove('hidden');
            document.getElementById('path-modal').classList.add('flex');
            loadDirectory(comfyPath);
        });
        document.getElementById('btn-close-path-modal').addEventListener('click', () => {
            document.getElementById('path-modal').classList.add('hidden');
            document.getElementById('path-modal').classList.remove('flex');
        });
        
        // Explorer back button
        document.getElementById('btn-explorer-back').addEventListener('click', () => {
            if (!explorerCurrentPath || explorerCurrentPath === '/' || /^[a-zA-Z]:\\?$/.test(explorerCurrentPath)) {
                // Go to root drives list
                loadDirectory('');
            } else {
                // Find parent folder path
                const parts = explorerCurrentPath.split(/[/\\]/);
                if (parts.length > 1) {
                    // Remove last folder name
                    parts.pop();
                    let parent = parts.join('\\');
                    if (parent.endsWith(':')) {
                        parent += '\\';
                    }
                    loadDirectory(parent);
                } else {
                    loadDirectory('');
                }
            }
        });

        document.getElementById('btn-save-path').addEventListener('click', () => {
            if (explorerCurrentPath) {
                comfyPath = explorerCurrentPath;
                localStorage.setItem('gnosys_comfy_path', comfyPath);
                document.getElementById('current-comfy-path').textContent = comfyPath;
                document.getElementById('install-dir-input').value = comfyPath;
                document.getElementById('path-modal').classList.add('hidden');
                document.getElementById('path-modal').classList.remove('flex');
                checkMusicServiceStatus();
            }
        });

        // Auto-detect button click
        document.getElementById('btn-auto-detect-path').addEventListener('click', async () => {
            const btn = document.getElementById('btn-auto-detect-path');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Detecting...';
            
            try {
                const res = await fetch(`${API_BASE}/api/music/auto-detect`);
                const data = await res.json();
                if (data.status === 'success' && data.candidates && data.candidates.length > 0) {
                    const bestCandidate = data.candidates[0].path;
                    showBannerNotification(`Auto-detected ACE-Step folder: ${bestCandidate}`, 'success');
                    loadDirectory(bestCandidate);
                } else {
                    showBannerNotification('Could not auto-detect ACE-Step folder. Please browse manually.', 'error');
                }
            } catch (err) {
                showBannerNotification('Auto-detect query failed: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });

        // Launch service click
        document.getElementById('btn-launch-service').addEventListener('click', () => {
            launchService();
        });

        // Installer wizard modal
        document.getElementById('btn-install-wizard').addEventListener('click', () => {
            document.getElementById('install-modal').classList.remove('hidden');
            document.getElementById('install-modal').classList.add('flex');
        });
        document.getElementById('btn-close-install').addEventListener('click', () => {
            document.getElementById('install-modal').classList.add('hidden');
            document.getElementById('install-modal').classList.remove('flex');
        });
        document.getElementById('btn-cancel-install').addEventListener('click', () => {
            document.getElementById('install-modal').classList.add('hidden');
            document.getElementById('install-modal').classList.remove('flex');
        });

        document.getElementById('btn-start-install').addEventListener('click', async () => {
            const path = document.getElementById('install-dir-input').value.trim();
            if (!path) return;
            
            document.getElementById('install-progress-box').classList.remove('hidden');
            document.getElementById('btn-start-install').disabled = true;
            document.getElementById('btn-start-install').textContent = 'Installing...';

            try {
                const res = await fetch(`${API_BASE}/api/music/install`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ install_path: path })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    startInstallPolling();
                } else {
                    document.getElementById('install-step-text').textContent = 'Installation failed: ' + data.message;
                    document.getElementById('btn-start-install').disabled = false;
                    document.getElementById('btn-start-install').textContent = 'Start Auto-Installation';
                }
            } catch (err) {
                document.getElementById('install-step-text').textContent = 'Error initiating installer: ' + err.message;
                document.getElementById('btn-start-install').disabled = false;
                document.getElementById('btn-start-install').textContent = 'Start Auto-Installation';
            }
        });

        // Subject change custom toggle
        document.getElementById('subject-selector').addEventListener('change', (e) => {
            const container = document.getElementById('custom-subject-container');
            if (e.target.value === 'custom') {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        });

        // Advanced settings accordion toggle
        document.getElementById('btn-toggle-advanced').addEventListener('click', () => {
            const panel = document.getElementById('advanced-settings-panel');
            const chevron = document.getElementById('advanced-chevron');
            const isHidden = panel.classList.contains('hidden');
            
            if (isHidden) {
                panel.classList.remove('hidden');
                chevron.classList.add('rotate-180');
            } else {
                panel.classList.add('hidden');
                chevron.classList.remove('rotate-180');
            }
        });

        // LM CFG slider update value label
        document.getElementById('music-lm-cfg').addEventListener('input', (e) => {
            document.getElementById('lm-cfg-val').textContent = parseFloat(e.target.value).toFixed(1);
        });

        // Gemma lyric brainstorm trigger
        document.getElementById('btn-brainstorm').addEventListener('click', handleBrainstormLyrics);

        // Music generation trigger
        document.getElementById('btn-generate-track').addEventListener('click', generateStudyTrack);

        // Copy launch command helper
        const copyCmdBtn = document.getElementById('btn-copy-launch-cmd');
        if (copyCmdBtn) {
            copyCmdBtn.addEventListener('click', () => {
                navigator.clipboard.writeText("python server.py");
                showBannerNotification("Local run command copied to clipboard!", "success");
            });
        }

        // Auto-launch assistant server helper
        const launchAssistantBtn = document.getElementById('btn-launch-assistant');
        if (launchAssistantBtn) {
            launchAssistantBtn.addEventListener('click', () => {
                launchAssistantServer(true);
            });
        }

        // Assistant Setup Guide Modal wireup
        const setupModal = document.getElementById('assistant-setup-modal');
        if (setupModal) {
            document.getElementById('btn-close-setup').addEventListener('click', () => {
                setupModal.classList.add('hidden');
                setupModal.classList.remove('flex');
            });
            document.getElementById('btn-setup-ok').addEventListener('click', () => {
                setupModal.classList.add('hidden');
                setupModal.classList.remove('flex');
                checkMusicServiceStatus();
            });
        }

        // Mobile / Tablet Warning Dialog & Banner Check
        const isMobile = window.innerWidth < 1024 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            const dismissed = sessionStorage.getItem('gnosys_mobile_warning_dismissed') === 'true';
            const overlay = document.getElementById('mobile-warning-overlay');
            const inlineWarning = document.getElementById('mobile-inline-warning');
            
            if (inlineWarning) {
                inlineWarning.classList.remove('hidden');
            }
            
            const generateBtn = document.getElementById('btn-generate-track');
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.innerHTML = '<i class="fa-solid fa-desktop mr-1.5"></i> Desktop Only';
                generateBtn.style.opacity = '0.5';
                generateBtn.style.cursor = 'not-allowed';
            }
            
            if (overlay && !dismissed) {
                overlay.style.display = 'flex';
                overlay.classList.remove('hidden');
                
                const dismissBtn = document.getElementById('btn-dismiss-mobile-warning');
                if (dismissBtn) {
                    dismissBtn.addEventListener('click', () => {
                        overlay.style.display = 'none';
                        overlay.classList.add('hidden');
                        sessionStorage.setItem('gnosys_mobile_warning_dismissed', 'true');
                    });
                }
            }
        }
    }

    function launchAssistantServer(isManual = false) {
        if (isLaunchingAssistant) return;
        isLaunchingAssistant = true;

        const launchAssistantBtn = document.getElementById('btn-launch-assistant');
        const onboardingCard = document.getElementById('backend-onboarding-card');
        const titleEl = onboardingCard ? onboardingCard.querySelector('h2') : null;
        const descEl = onboardingCard ? onboardingCard.querySelector('p') : null;

        const originalBtnText = launchAssistantBtn ? launchAssistantBtn.innerHTML : '';
        if (launchAssistantBtn) {
            launchAssistantBtn.disabled = true;
            launchAssistantBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Launching...';
        }

        if (titleEl) titleEl.textContent = 'Starting Local Assistant Server...';
        if (descEl) descEl.innerHTML = 'Connecting to custom protocol <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">gnosys-assistant://</code>... Attempting connection (1/15)';

        if (onboardingCard) onboardingCard.classList.remove('hidden');

        showBannerNotification("Launching local assistant server...", "info");
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'gnosys-assistant://';
            document.body.appendChild(iframe);
            setTimeout(() => iframe.remove(), 1000);
        } catch (err) {
            console.warn('[MusicStudio] Custom protocol invocation failed:', err);
        }

        let attempts = 0;
        const maxAttempts = 15;
        const interval = setInterval(async () => {
            attempts++;
            if (descEl) descEl.innerHTML = `Connecting to custom protocol <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">gnosys-assistant://</code>... Attempting connection (${attempts}/${maxAttempts})`;
            try {
                const res = await fetch(`${API_BASE}/api/music/status`, {
                    headers: { 'X-ComfyUI-Path': comfyPath }
                });
                if (res.ok) {
                    clearInterval(interval);
                    showBannerNotification("Local assistant server successfully connected!", "success");
                    isLaunchingAssistant = false;
                    
                    if (launchAssistantBtn) {
                        launchAssistantBtn.disabled = false;
                        launchAssistantBtn.innerHTML = originalBtnText;
                    }
                    if (titleEl) titleEl.textContent = 'Local Assistant Server is Offline';
                    if (onboardingCard) onboardingCard.classList.add('hidden');
                    checkMusicServiceStatus();
                }
            } catch (e) {}
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                isLaunchingAssistant = false;
                
                if (launchAssistantBtn) {
                    launchAssistantBtn.disabled = false;
                    launchAssistantBtn.innerHTML = originalBtnText;
                }
                if (titleEl) titleEl.textContent = 'Local Assistant Server is Offline';
                if (descEl) descEl.innerHTML = 'Because this application is hosted statically, browsers cannot launch local programs automatically. Please open your installation folder and run <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">run_backend.bat</code> (Windows) or <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">run_backend.sh</code> (Mac/Linux) to start the local helper.';
                
                const setupModal = document.getElementById('assistant-setup-modal');
                if (setupModal) {
                    setupModal.classList.remove('hidden');
                    setupModal.classList.add('flex');
                }
                showBannerNotification('Connection attempt timed out. Opening assistant setup guide...', 'warning');
            }
        }, 1500);
    }

    async function launchService() {
        if (isLaunchingService) return;
        isLaunchingService = true;
        const badge = document.getElementById('comfy-status-badge');
        if (badge) {
            badge.className = 'text-xs px-2.5 py-0.5 rounded-full uppercase font-extrabold tracking-wider badge-pulse-amber';
            badge.textContent = 'Starting (0/150)';
        }
        try {
            const res = await fetch(`${API_BASE}/api/music/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comfy_path: comfyPath, vram_profile: vramProfile })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showBannerNotification('Starting ComfyUI background service...', 'success');
                pollComfyStartup();
            } else {
                showBannerNotification('Failed to launch: ' + data.message, 'error');
                isLaunchingService = false;
            }
        } catch (err) {
            showBannerNotification('Error launching ComfyUI service: ' + err.message, 'error');
            isLaunchingService = false;
        }
    }

    function getMissingModelsList(data) {
        if (!data || !data.diagnostics) return [];
        const selectedModel = document.getElementById('music-model').value;
        const missing = [];
        
        if (!data.diagnostics.vocoder) {
            missing.push({
                label: "Vocoder",
                repoId: "Comfy-Org/ACE-Step_ComfyUI_repackaged",
                targetSubdir: "models/TTS/ACE-Step-v1-3.5B/music_vocoder"
            });
        }
        if (!data.diagnostics.dcae) {
            missing.push({
                label: "DCAE Encoder",
                repoId: "Comfy-Org/ACE-Step_ComfyUI_repackaged",
                targetSubdir: "models/TTS/ACE-Step-v1-3.5B/music_dcae_f8c8"
            });
        }
        if (!data.diagnostics.umt5) {
            missing.push({
                label: "UMT5 Text",
                repoId: "Comfy-Org/ACE-Step_ComfyUI_repackaged",
                targetSubdir: "models/TTS/ACE-Step-v1-3.5B/umt5-base"
            });
        }

        if (selectedModel === "acemusic/acestep-v15-xl-sft" && !data.diagnostics.xl_sft) {
            missing.push({
                label: "XL SFT Model",
                repoId: "ACE-Step/acestep-v15-xl-sft",
                targetSubdir: "checkpoints/acestep-v15-xl-sft"
            });
        } else if (selectedModel === "acemusic/acestep-v15-xl-turbo" && !data.diagnostics.xl_turbo) {
            missing.push({
                label: "XL Turbo Model",
                repoId: "ACE-Step/acestep-v15-xl-turbo",
                targetSubdir: "checkpoints/acestep-v15-xl-turbo"
            });
        }

        return missing;
    }

    async function triggerBackgroundDownload(label, repoId, targetSubdir) {
        const targetPath = `${comfyPath}\\${targetSubdir.replace(/\//g, '\\')}`;
        try {
            if (!window.latestStatusData) window.latestStatusData = {};
            if (!window.latestStatusData.active_downloads) window.latestStatusData.active_downloads = {};
            window.latestStatusData.active_downloads[repoId] = 'downloading';
            
            const dlRes = await fetch(`${API_BASE}/api/music/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_id: repoId, target_dir: targetPath })
            });
            const dlData = await dlRes.json();
            if (dlData.status === 'success') {
                showBannerNotification(`Background download initiated for ${label}!`, 'success');
                checkMusicServiceStatus();
            }
        } catch (err) {
            console.error(`Failed to start download for ${label}:`, err);
        }
    }

    async function triggerDownloadAllMissing() {
        const data = window.latestStatusData;
        if (!data || !data.diagnostics) {
            showBannerNotification("Unable to determine missing models. Please wait for status scan.", "error");
            return;
        }

        const missing = getMissingModelsList(data);
        if (missing.length === 0) {
            showBannerNotification("All required models are already installed!", "info");
            return;
        }

        showBannerNotification(`Starting downloads for ${missing.length} missing models in background...`, "info");
        for (const item of missing) {
            await triggerBackgroundDownload(item.label, item.repoId, item.targetSubdir);
        }
    }

    async function checkMusicServiceStatus() {
        const badge = document.getElementById('comfy-status-badge');
        if (!badge) return;
        const icon = document.getElementById('comfy-status-icon');
        const launchBtn = document.getElementById('btn-launch-service');
        const installBtn = document.getElementById('btn-install-wizard');

        try {
            const res = await fetch(`${API_BASE}/api/music/status`, {
                headers: { 'X-ComfyUI-Path': comfyPath }
            });
            const data = await res.json();

            // Sync with backend corrected path if drive fallback occurred
            if (data.comfy_path && data.comfy_path !== comfyPath) {
                comfyPath = data.comfy_path;
                localStorage.setItem('gnosys_comfy_path', comfyPath);
                document.getElementById('current-comfy-path').textContent = comfyPath;
                document.getElementById('explorer-current-path').textContent = comfyPath;
                document.getElementById('install-dir-input').value = comfyPath;
            }

            // Hide onboarding warning if port 8020 responds
            const onboardingCard = document.getElementById('backend-onboarding-card');
            if (onboardingCard) onboardingCard.classList.add('hidden');

            // Render diagnostic indicators if path exists
            const diagBox = document.getElementById('comfy-diagnostics-box');
            if (diagBox) {
                diagBox.innerHTML = '';
                if (data.diagnostics) {
                    const makeBadge = (label, status, repoId, targetSubdir) => {
                        const isDownloading = data.active_downloads && data.active_downloads[repoId] === 'downloading';
                        const isFailed = data.active_downloads && data.active_downloads[repoId] === 'failed';
                        const isSuccess = status || (data.active_downloads && data.active_downloads[repoId] === 'success');
                        
                        const baseClass = "text-[9px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 shrink-0 transition-all text-decoration-none cursor-pointer";
                        let themeClass = "";
                        let iconHtml = "";
                        let text = label;
                        let tooltip = "";

                        if (isDownloading) {
                            themeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20 badge-pulse-amber";
                            iconHtml = '<i class="fa-solid fa-spinner fa-spin"></i>';
                            text = `${label} (Downloading...)`;
                            tooltip = "Downloading model checkpoints from Hugging Face...";
                        } else if (isSuccess) {
                            themeClass = "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20";
                            iconHtml = '<i class="fa-solid fa-circle-check"></i>';
                            tooltip = "Installed and verified.";
                        } else {
                            themeClass = "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 animate-pulse";
                            iconHtml = '<i class="fa-solid fa-download"></i>';
                            tooltip = isFailed ? "Download failed. Click to retry." : "Missing. Click to download directly.";
                        }

                        const targetPath = `${comfyPath}\\${targetSubdir.replace(/\//g, '\\')}`;
                        const badgeEl = document.createElement('a');
                        badgeEl.className = `${baseClass} ${themeClass}`;
                        badgeEl.title = tooltip;
                        badgeEl.innerHTML = `${iconHtml}${text}`;
                        
                        if (!isSuccess && !isDownloading) {
                            badgeEl.addEventListener('click', async (e) => {
                                e.preventDefault();
                                showBannerNotification(`Starting download for ${label}...`, 'info');
                                try {
                                    const dlRes = await fetch(`${API_BASE}/api/music/download`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ repo_id: repoId, target_dir: targetPath })
                                    });
                                    const dlData = await dlRes.json();
                                    if (dlData.status === 'success') {
                                        showBannerNotification(`Download initiated for ${label}!`, 'success');
                                        checkMusicServiceStatus();
                                    } else {
                                        showBannerNotification(`Failed to start download: ${dlData.message}`, 'error');
                                    }
                                } catch (err) {
                                    showBannerNotification(`Failed to start download: ${err.message}`, 'error');
                                }
                            });
                        } else {
                            badgeEl.addEventListener('click', (e) => e.preventDefault());
                        }

                        return badgeEl;
                    };

                    diagBox.appendChild(makeBadge("XL SFT", data.diagnostics.xl_sft, "ACE-Step/acestep-v15-xl-sft", "checkpoints/acestep-v15-xl-sft"));
                    diagBox.appendChild(makeBadge("XL Turbo", data.diagnostics.xl_turbo, "ACE-Step/acestep-v15-xl-turbo", "checkpoints/acestep-v15-xl-turbo"));
                    diagBox.appendChild(makeBadge("Vocoder", data.diagnostics.vocoder, "Comfy-Org/ACE-Step_ComfyUI_repackaged", "models/TTS/ACE-Step-v1-3.5B/music_vocoder"));
                    diagBox.appendChild(makeBadge("DCAE Encoder", data.diagnostics.dcae, "Comfy-Org/ACE-Step_ComfyUI_repackaged", "models/TTS/ACE-Step-v1-3.5B/music_dcae_f8c8"));
                    diagBox.appendChild(makeBadge("UMT5 Text", data.diagnostics.umt5, "Comfy-Org/ACE-Step_ComfyUI_repackaged", "models/TTS/ACE-Step-v1-3.5B/umt5-base"));
                }
            }

            // Cache latest status data
            window.latestStatusData = data;

            if (data.comfy_running) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase font-extrabold tracking-wider';
                badge.textContent = 'Running';
                icon.innerHTML = '<i class="fa-solid fa-circle-check text-teal-400"></i>';
                launchBtn.classList.add('hidden');
                installBtn.classList.add('hidden');
                
                // Fetch models dynamically from local API server
                fetchModelsList();

                // Check missing models
                const missing = getMissingModelsList(data);
                const downloadAllBtn = document.getElementById('btn-download-all');
                
                if (downloadAllBtn) {
                    if (missing.length > 0) {
                        downloadAllBtn.classList.remove('hidden');
                        
                        const downloadsActive = data.active_downloads && Object.values(data.active_downloads).some(status => status === 'downloading');
                        downloadAllBtn.disabled = downloadsActive;
                        if (downloadsActive) {
                            downloadAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Downloading Models...';
                            downloadAllBtn.classList.add('opacity-75');
                        } else {
                            downloadAllBtn.innerHTML = '<i class="fa-solid fa-download mr-1"></i> Download All Missing Models';
                            downloadAllBtn.classList.remove('opacity-75');
                        }
                    } else {
                        downloadAllBtn.classList.add('hidden');
                    }
                }

                // Auto-download missing models if enabled
                const autoDownloadEnabled = document.getElementById('auto-download-checkbox')?.checked ?? true;
                if (autoDownloadEnabled && missing.length > 0) {
                    const activeRepos = data.active_downloads ? Object.keys(data.active_downloads).filter(k => data.active_downloads[k] === 'downloading') : [];
                    for (const item of missing) {
                        if (!activeRepos.includes(item.repoId)) {
                            triggerBackgroundDownload(item.label, item.repoId, item.targetSubdir);
                        }
                    }
                }
            } else if (data.comfy_installed) {
                const isStarting = badge && badge.textContent.startsWith('Starting');
                if (isStarting) {
                    // Keep the starting layout
                } else {
                    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider';
                    badge.textContent = 'Offline';
                    icon.innerHTML = '<i class="fa-solid fa-server text-amber-400"></i>';
                    launchBtn.classList.remove('hidden');
                    installBtn.classList.add('hidden');

                    // Auto-start server if enabled
                    const autoStartEnabled = document.getElementById('auto-start-checkbox')?.checked ?? true;
                    if (autoStartEnabled && !isLaunchingService) {
                        launchService();
                    }
                }
            } else {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 uppercase font-extrabold tracking-wider';
                badge.textContent = 'Not Found';
                icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>';
                launchBtn.classList.add('hidden');
                installBtn.classList.remove('hidden');
            }
            
            // Hide download-all button if server is not running
            if (!data.comfy_running) {
                const downloadAllBtn = document.getElementById('btn-download-all');
                if (downloadAllBtn) downloadAllBtn.classList.add('hidden');
            }

            // Control polling for active downloads
            const downloadsActive = data.active_downloads && Object.values(data.active_downloads).some(status => status === 'downloading');
            if (downloadsActive) {
                if (!downloadPollInterval) {
                    downloadPollInterval = setInterval(checkMusicServiceStatus, 3000);
                }
            } else {
                if (downloadPollInterval) {
                    clearInterval(downloadPollInterval);
                    downloadPollInterval = null;
                }
                
                // If downloads just completed and we have a queued generation, run it!
                if (pendingGeneration && data.comfy_running) {
                    const missing = getMissingModelsList(data);
                    if (missing.length === 0) {
                        pendingGeneration = false;
                        showBannerNotification('All required models are now ready! Starting generation...', 'success');
                        generateStudyTrack();
                    }
                }
            }
        } catch (err) {
            badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-white/5 uppercase font-extrabold tracking-wider';
            badge.textContent = 'Unknown';
            icon.innerHTML = '<i class="fa-solid fa-server text-slate-400"></i>';
            launchBtn.classList.add('hidden');
            installBtn.classList.remove('hidden');

            // Show onboarding warning if connection failed
            const onboardingCard = document.getElementById('backend-onboarding-card');
            if (onboardingCard) onboardingCard.classList.remove('hidden');

            if (downloadPollInterval) {
                clearInterval(downloadPollInterval);
                downloadPollInterval = null;
            }

            // Attempt to auto-launch the local assistant server via custom protocol
            if (!window._assistantLaunchAttempted) {
                window._assistantLaunchAttempted = true;
                launchAssistantServer(false);
            }
        }
    }

    async function fetchModelsList() {
        const select = document.getElementById('music-model');
        if (!select) return;
        try {
            const res = await fetch(`${API_BASE}/api/music/models`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const data = await res.json();
                if (data && data.data && data.data.length > 0) {
                    // Keep track of existing option values to avoid duplicates
                    const existingValues = new Set(Array.from(select.options).map(opt => opt.value));
                    
                    data.data.forEach(model => {
                        if (!existingValues.has(model.id)) {
                            const opt = document.createElement('option');
                            opt.value = model.id;
                            opt.textContent = `${model.id} (${model.name || 'ACE-Step'})`;
                            select.appendChild(opt);
                        }
                    });
                }
            }
        } catch (e) {
            console.log('Failed to fetch models list, using static options:', e);
        }
    }

    function pollComfyStartup() {
        let attempts = 0;
        const maxAttempts = 150; // Supports up to 10 minutes for slow disk/first-time weight loading
        const badge = document.getElementById('comfy-status-badge');
        const icon = document.getElementById('comfy-status-icon');
        const launchBtn = document.getElementById('btn-launch-service');

        if (launchBtn) {
            launchBtn.disabled = true;
            launchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Starting...';
        }

        if (badge) {
            badge.className = 'text-xs px-2.5 py-0.5 rounded-full uppercase font-extrabold tracking-wider badge-pulse-amber';
            badge.textContent = `Starting (0/${maxAttempts})`;
        }
        if (icon) {
            icon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-amber-400"></i>';
        }

        showBannerNotification('Service launch triggered. Loading neural weights into memory (may take 2-5 mins)...', 'info');

        const interval = setInterval(async () => {
            attempts++;
            if (badge) {
                badge.textContent = `Starting (${attempts}/${maxAttempts})`;
            }
            try {
                const res = await fetch('http://127.0.0.1:8002/health', { signal: AbortSignal.timeout(1000) });
                if (res.ok) {
                    clearInterval(interval);
                    isLaunchingService = false;
                    if (launchBtn) {
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<i class="fa-solid fa-rocket mr-1.5"></i> Launch Service';
                    }
                    showBannerNotification('ACE-Step API Server connected successfully!', 'success');
                    checkMusicServiceStatus();
                    
                    if (pendingGeneration) {
                        // Wait for status data to be fetched and stored
                        setTimeout(() => {
                            const data = window.latestStatusData;
                            const missing = getMissingModelsList(data);
                            if (missing.length === 0) {
                                pendingGeneration = false;
                                showBannerNotification('API server online! Starting queued track generation...', 'success');
                                generateStudyTrack();
                            } else {
                                // Keep pendingGeneration true, we will wait for auto-download status checking to trigger it!
                                showBannerNotification('API server online! Waiting for missing model weights to download...', 'info');
                                const progressContainer = document.getElementById('generation-progress-container');
                                const statusText = document.getElementById('gen-status-text');
                                if (statusText) statusText.textContent = 'Queued: Waiting for required models to finish downloading...';
                            }
                        }, 500);
                    }
                }
            } catch (e) {
                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    isLaunchingService = false;
                    if (launchBtn) {
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<i class="fa-solid fa-rocket mr-1.5"></i> Launch Service';
                    }
                    showBannerNotification('ACE-Step API Server launch timed out. Please check if it is running.', 'error');
                    checkMusicServiceStatus();
                    
                    if (pendingGeneration) {
                        pendingGeneration = false;
                        const progressContainer = document.getElementById('generation-progress-container');
                        if (progressContainer) progressContainer.classList.add('hidden');
                        const genBtn = document.getElementById('btn-generate-track');
                        if (genBtn) genBtn.disabled = false;
                    }
                }
            }
        }, 4000);
    }

    function startInstallPolling() {
        const stepText = document.getElementById('install-step-text');
        const percentText = document.getElementById('install-percent');
        const fill = document.getElementById('install-progress-bar-fill');

        if (installPollInterval) clearInterval(installPollInterval);
        
        installPollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/music/install-status`);
                const data = await res.json();
                
                stepText.textContent = data.step;
                percentText.textContent = data.progress + '%';
                fill.style.width = data.progress + '%';

                if (data.step === 'done') {
                    clearInterval(installPollInterval);
                    showBannerNotification('Installation completed successfully!', 'success');
                    setTimeout(() => {
                        document.getElementById('install-modal').classList.add('hidden');
                        document.getElementById('install-modal').classList.remove('flex');
                        checkMusicServiceStatus();
                    }, 1500);
                } else if (data.step === 'failed') {
                    clearInterval(installPollInterval);
                    stepText.textContent = 'Error: ' + data.error;
                    document.getElementById('btn-start-install').disabled = false;
                    document.getElementById('btn-start-install').textContent = 'Start Auto-Installation';
                }
            } catch (err) {
                clearInterval(installPollInterval);
                stepText.textContent = 'Installer connection lost.';
                document.getElementById('btn-start-install').disabled = false;
            }
        }, 1000);
    }

    async function handleBrainstormLyrics() {
        const btn = document.getElementById('btn-brainstorm');
        const originalText = btn.innerHTML;
        const generatedLyricsTextarea = document.getElementById('generated-lyrics');
        const lyricsPromptVal = document.getElementById('lyrics-prompt').value.trim();
        const subjectSelector = document.getElementById('subject-selector').value;
        const customSubjectVal = document.getElementById('custom-subject-input').value.trim();
        const audioLengthVal = document.getElementById('music-length').value;

        let subjectName = '';
        if (subjectSelector === 'custom') {
            subjectName = customSubjectVal || 'a custom academic study subject';
        } else {
            subjectName = document.getElementById('subject-selector').options[document.getElementById('subject-selector').selectedIndex].text;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Brainstorming lyric lines...';
        generatedLyricsTextarea.value = '';

        const systemPrompt = `You are a creative, expert educational songwriter and music producer for Gnosys AI.
Your objective is to brainstorm catchy, mnemonically dense, and rhythmically aligned study lyrics to help a student master a specific field of study.
The user wants to generate song lyrics about: "${subjectName}".
Keep the lines rhyming, easy to read/sing, and packed with actual educational keywords, facts, and definitions.

IMPORTANT: Always generate full, complete song lyrics including at least 2-3 Verses, a Chorus (repeated), and a Bridge to provide a comprehensive, high-quality study track. Do not truncate or abbreviate the song structure.

Output your response using the following XML structure:
<lyrics>
[Verse 1]
(lyrics here)

[Chorus]
(lyrics here)

[Verse 2]
(lyrics here)

[Chorus]
(lyrics here)

[Bridge]
(lyrics here)

[Chorus]
(lyrics here)
</lyrics>
<meta>
genre: (recommend a prompt string like "synthwave, electronic, energetic, focus tempo")
bpm: (recommend 80, 100, or 120)
key: (recommend a key scale compatible with the UI: "C Major", "G Major", "A Minor", "E Minor", "D Minor", or "F Major")
signature: (recommend "4", "3", or "6" for time signature)
</meta>`;

        const userPrompt = lyricsPromptVal || `Generate educational study lyrics for a song about ${subjectName}.`;

        try {
            if (window.GnosysLLM) {
                await window.GnosysLLM.generateResponse(systemPrompt, userPrompt, {
                    stream: true,
                    onToken: (token, fullText) => {
                        // Extract only the <lyrics> content for display
                        const lyricsMatch = fullText.match(/<lyrics>([\s\S]*?)<\/lyrics>/i);
                        if (lyricsMatch) {
                            generatedLyricsTextarea.value = lyricsMatch[1].trim();
                        } else {
                            // Strip out any partial raw tags for a cleaner stream
                            generatedLyricsTextarea.value = fullText.replace(/<lyrics>/i, '').replace(/<\/lyrics>/i, '').trim();
                        }

                        // Try to extract and apply the <meta> configuration if the stream is complete
                        const metaMatch = fullText.match(/<meta>([\s\S]*?)<\/meta>/i);
                        if (metaMatch) {
                            try {
                                const metaText = metaMatch[1].trim();
                                const lines = metaText.split('\n');
                                lines.forEach(line => {
                                    const parts = line.split(':');
                                    if (parts.length >= 2) {
                                        const key = parts[0].trim().toLowerCase();
                                        const val = parts.slice(1).join(':').trim();
                                        
                                        if (key === 'genre' && val) {
                                            document.getElementById('music-prompt').value = val;
                                        } else if (key === 'bpm') {
                                            // Find closest matching option (80, 100, 120)
                                            const bpmNum = parseInt(val);
                                            const select = document.getElementById('music-bpm');
                                            if (bpmNum <= 90) select.value = "80";
                                            else if (bpmNum <= 110) select.value = "100";
                                            else select.value = "120";
                                        } else if (key === 'key') {
                                            const select = document.getElementById('music-key');
                                            // Map string to selector options
                                            for (let i = 0; i < select.options.length; i++) {
                                                if (select.options[i].value.toLowerCase() === val.toLowerCase()) {
                                                    select.value = select.options[i].value;
                                                    break;
                                                }
                                            }
                                        } else if (key === 'signature') {
                                            const select = document.getElementById('music-signature');
                                            if (val === '4' || val === '3' || val === '6') {
                                                select.value = val;
                                            }
                                        }
                                    }
                                });
                            } catch (e) {
                                console.log('Meta parsing error:', e);
                            }
                        }
                    }
                });
            } else {
                generatedLyricsTextarea.value = "Gnosys LLM Engine is currently loading or unavailable on this device tab.";
            }
        } catch (err) {
            generatedLyricsTextarea.value = "Failed to brainstorm lyrics: " + err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            saveMusicStudioSettings();
        }
    }

    function loadAudioToPlayer(url) {
        const container = document.getElementById('player-container');
        const audio = document.getElementById('audio-player');
        const downloadBtn = document.getElementById('btn-download-audio');
        const prompt = document.getElementById('music-prompt').value;
        const bpm = document.getElementById('music-bpm').value;

        // Check if the local audio player is currently playing a track
        const isLocalPlaying = audio && !audio.paused && !audio.ended && audio.currentTime > 0;
        if (isLocalPlaying) {
            pendingTrack = { url };
            showBannerNotification("Your new study beat is ready! Pause the current track or let it finish to load the new one.", "info");
            return;
        }

        audio.src = url;
        downloadBtn.href = url;
        document.getElementById('player-track-info').textContent = `${bpm} BPM • ${prompt}`;
        
        container.classList.remove('hidden');
        document.getElementById('generation-progress-container').classList.add('hidden');

        // Reset Add to Playlist button to default pulsing state
        const btnAddPlaylist = document.getElementById('btn-add-to-playlist');
        if (btnAddPlaylist) {
            btnAddPlaylist.disabled = false;
            btnAddPlaylist.className = 'btn-playlist-glow px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer';
            btnAddPlaylist.innerHTML = `<i class="fa-solid fa-folder-plus"></i> <span>Add to Playlist</span>`;
        }

        // Auto-select corresponding playlist for the current field of study
        const selectSubject = document.getElementById('subject-selector');
        const selectPlaylist = document.getElementById('playlist-target-select');
        if (selectSubject && selectPlaylist) {
            const val = selectSubject.value;
            if (val === 'medicine') selectPlaylist.value = 'medical-terminology';
            else if (val === 'chemistry') selectPlaylist.value = 'intro-to-chemistry';
            else if (val === 'psychology') selectPlaylist.value = 'psychology-care';
            else if (val === 'anatomy') selectPlaylist.value = 'anatomy-physiology-1';
            else selectPlaylist.value = 'medical-terminology';
        }

        // Smart Autoplay Check: check if background audio engine is currently playing a track
        let isBackgroundPlaying = false;
        try {
            const stateStr = localStorage.getItem('gnosys_audio_engine_state');
            if (stateStr) {
                const state = JSON.parse(stateStr);
                if (state && !state.paused && state.track) {
                    isBackgroundPlaying = true;
                }
            }
        } catch (e) {}

        if (isBackgroundPlaying) {
            // Background playlist is active: do not autoplay local preview to avoid cacophony
            showBannerNotification("New track generation completed! Your study beat is ready for preview in the player below.", "info");
        } else {
            // Background playlist is idle: silently autoplay local player preview
            audio.play().catch(err => {
                console.log('Autoplay blocked by browser policy:', err);
            });
        }
    }

    async function generateStudyTrack() {
        const btn = document.getElementById('btn-generate-track');
        const progressContainer = document.getElementById('generation-progress-container');
        const statusText = document.getElementById('gen-status-text');
        const fill = document.getElementById('gen-progress-bar-fill');
        const percent = document.getElementById('gen-percent');

        // Check if server is online
        const statusTextVal = document.getElementById('comfy-status-badge').textContent.trim();
        if (statusTextVal !== 'Running') {
            if (statusTextVal.startsWith('Starting')) {
                pendingGeneration = true;
                btn.disabled = true;
                progressContainer.classList.remove('hidden');
                fill.style.width = '10%';
                percent.textContent = '10%';
                statusText.textContent = 'Queued: Waiting for ACE-Step API Server to finish starting...';
                showBannerNotification('Generation queued. It will run automatically once the server starts.', 'info');
            } else if (statusTextVal === 'Not Found') {
                showBannerNotification('ACE-Step service not found. Please run the install wizard to set it up.', 'error');
            } else {
                pendingGeneration = true;
                btn.disabled = true;
                progressContainer.classList.remove('hidden');
                fill.style.width = '10%';
                percent.textContent = '10%';
                statusText.textContent = 'Auto-starting background server and queuing generation...';
                showBannerNotification('Auto-starting background server to generate track...', 'info');
                launchService();
            }
            return;
        }

        // Check if any required weights are missing
        const data = window.latestStatusData;
        if (data && data.diagnostics) {
            const missing = getMissingModelsList(data);
            if (missing.length > 0) {
                const downloadsActive = data.active_downloads && Object.values(data.active_downloads).some(status => status === 'downloading');
                
                pendingGeneration = true;
                btn.disabled = true;
                progressContainer.classList.remove('hidden');
                fill.style.width = '15%';
                percent.textContent = '15%';
                
                if (downloadsActive) {
                    statusText.textContent = 'Queued: Waiting for required models to finish downloading...';
                    showBannerNotification('Required weights are currently downloading. Track generation will start automatically when downloads complete.', 'info');
                } else {
                    statusText.textContent = 'Queued: Initiating required model downloads...';
                    showBannerNotification('Required weights are missing. Initiating automatic background download...', 'warning');
                    triggerDownloadAllMissing();
                }
                return;
            }
        }

        btn.disabled = true;
        progressContainer.classList.remove('hidden');
        
        let progressPercent = 10;
        fill.style.width = '10%';
        percent.textContent = '10%';
        statusText.textContent = 'Pre-processing audio configurations...';

        const loadingStages = [
            { pct: 20, text: 'Allocating VRAM workspace (RTX 5060 Ti)...' },
            { pct: 35, text: 'Loading 4B Diffusion Transformer (DiT) weights...' },
            { pct: 50, text: 'Resolving UMT5 Text Encoder weights...' },
            { pct: 65, text: 'Running neural audio synthesis steps...' },
            { pct: 80, text: 'Decoding features using DCAE f8c8 model...' },
            { pct: 92, text: 'Reconstructing WAV output using Music Vocoder...' }
        ];

        let stageIndex = 0;
        let stageInterval = setInterval(() => {
            if (stageIndex < loadingStages.length) {
                const stage = loadingStages[stageIndex];
                fill.style.width = stage.pct + '%';
                percent.textContent = stage.pct + '%';
                statusText.textContent = stage.text;
                stageIndex++;
            }
        }, 3000);

        const modelVal = document.getElementById('music-model').value;
        const promptVal = document.getElementById('music-prompt').value;
        const bpmVal = document.getElementById('music-bpm').value;
        const lengthVal = document.getElementById('music-length').value;
        const stepsVal = document.getElementById('music-steps').value;
        const vocalsVal = document.getElementById('music-vocals').value;
        const lyricsVal = document.getElementById('generated-lyrics').value || "";

        // Collect new advanced parameters
        const thinkingVal = document.getElementById('music-thinking').checked;
        const formatVal = document.getElementById('music-format').checked;
        const keyVal = document.getElementById('music-key').value;
        const sigVal = document.getElementById('music-signature').value;
        const seedInputVal = document.getElementById('music-seed').value.trim();
        const lmCfgVal = parseFloat(document.getElementById('music-lm-cfg').value);

        // Construct standard OpenRouter payload format accepted by openrouter_api_server.py
        const payload = {
            model: modelVal,
            messages: [
                {
                    role: "user",
                    content: `<prompt>${promptVal}</prompt>${vocalsVal === 'on' && lyricsVal ? `\n<lyrics>${lyricsVal}</lyrics>` : ''}`
                }
            ],
            audio_config: {
                duration: parseFloat(lengthVal),
                bpm: parseInt(bpmVal),
                instrumental: vocalsVal !== 'on',
                key_scale: keyVal || null,
                time_signature: sigVal || null
            },
            inference_steps: parseInt(stepsVal),
            thinking: thinkingVal,
            use_format: formatVal,
            lm_cfg_scale: lmCfgVal,
            seed: seedInputVal ? parseInt(seedInputVal) : null
        };

        try {
            const res = await fetch(`${API_BASE}/api/music/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            clearInterval(stageInterval);
            fill.style.width = '95%';
            percent.textContent = '95%';
            statusText.textContent = 'Decoding final WAV file...';

            if (!res.ok) {
                throw new Error(await res.text());
            }

            const data = await res.json();
            
            // Extract the generated audio base64 url
            const audioItem = data?.choices?.[0]?.message?.audio?.[0];
            if (audioItem && audioItem.audio_url && audioItem.audio_url.url) {
                const audioUrl = audioItem.audio_url.url; // This is a data:audio/mp3;base64,... URL
                fill.style.width = '100%';
                percent.textContent = '100%';
                loadAudioToPlayer(audioUrl);
            } else {
                throw new Error("No audio block returned in API response.");
            }
        } catch (err) {
            if (typeof stageInterval !== 'undefined') clearInterval(stageInterval);
            statusText.textContent = 'Generation failed: ' + err.message;
            showBannerNotification('Generation failed.', 'error');
        } finally {
            if (typeof stageInterval !== 'undefined') clearInterval(stageInterval);
            btn.disabled = false;
        }
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
        if (typeof API_BASE !== 'undefined' && API_BASE && !url.startsWith('http') && !url.startsWith('data:')) {
            targetUrl = API_BASE + url;
        }

        try {
            const res = await fetch(targetUrl);
            const blob = await res.blob();
            
            // Allow user to choose folder if showSaveFilePicker is supported
            if ('showSaveFilePicker' in window) {
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
                showBannerNotification('Track successfully saved to your system!', 'success');
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
                showBannerNotification('Track download started!', 'success');
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
                    showBannerNotification('Auto-download blocked by browser security.', 'warning');
                }
            }
        }
    }

    function showBannerNotification(msg, variant = 'success') {
        if (window.GnosysLLM && typeof window.GnosysLLM.showTransientToast === 'function') {
            window.GnosysLLM.showTransientToast(msg, variant);
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
            background: ${variant === 'error' ? 'rgba(239, 68, 68, 0.95)' : variant === 'info' ? 'rgba(99, 102, 241, 0.95)' : 'rgba(15, 23, 42, 0.95)'};
            border: 1px solid ${variant === 'error' ? 'rgba(239, 68, 68, 0.2)' : variant === 'info' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)'};
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            backdrop-filter: blur(8px);
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
            font-family: 'Outfit', sans-serif;
        `;
        
        const icon = variant === 'error' ? '<i class="fa-solid fa-triangle-exclamation mr-2 text-red-400"></i>' :
                     variant === 'info' ? '<i class="fa-solid fa-circle-info mr-2 text-indigo-400"></i>' :
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
})();
