(function() {
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://127.0.0.1:8020';
    let comfyPath = localStorage.getItem('gnosys_comfy_path') || 'D:\\ComfyUI\\ACE-Step-1.5';
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

    // Chat and Lyric Editor State
    window.lyricStudioState = {
        history: [], // Undo stack
        currentText: "",
        highlight: null // { text, startLine, endLine, startChar, endChar }
    };
    const MAX_HISTORY = 30;
    let studioConversationHistory = [];
    let isChatResponding = false;
    let isCritiqueMode = false;
    let activeCritiqueData = null;

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
        'music-vocals',
        'music-thinking',
        'music-format',
        'music-key',
        'music-signature',
        'music-seed',
        'music-steps',
        'music-vram-profile',
        'music-lm-cfg',
        'music-guidance-scale',
        'music-vocal-lang',
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
                                // Update labels for sliders if restored
                                if (id === 'music-lm-cfg') {
                                    const valText = document.getElementById('lm-cfg-val');
                                    if (valText) valText.textContent = parseFloat(el.value).toFixed(1);
                                } else if (id === 'music-guidance-scale') {
                                    const valText = document.getElementById('guidance-scale-val');
                                    if (valText) valText.textContent = parseFloat(el.value).toFixed(1);
                                }
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
        const updateStepsRecommendation = () => {
            const badge = document.getElementById('steps-recommendation-badge');
            if (!badge || !modelSelector) return;
            if (modelSelector.value.includes('turbo')) {
                badge.textContent = "Rec: 8 (Turbo)";
                badge.className = "text-[8px] text-sky-400 font-bold transition-all";
            } else {
                badge.textContent = "Rec: 24-50 (SFT)";
                badge.className = "text-[8px] text-indigo-300 font-bold transition-all";
            }
        };

        if (modelSelector) {
            modelSelector.addEventListener('change', () => {
                checkMusicServiceStatus();
                // Auto-set default steps and guidance scale based on model type
                const stepsInput = document.getElementById('music-steps');
                const guidanceInput = document.getElementById('music-guidance-scale');
                const guidanceValLabel = document.getElementById('guidance-scale-val');
                
                if (stepsInput) {
                    if (modelSelector.value.includes('turbo')) {
                        stepsInput.value = 8;
                        if (guidanceInput) {
                            guidanceInput.value = 1.0;
                            if (guidanceValLabel) guidanceValLabel.textContent = "1.0";
                        }
                    } else {
                        stepsInput.value = 50;
                        if (guidanceInput) {
                            guidanceInput.value = 7.0;
                            if (guidanceValLabel) guidanceValLabel.textContent = "7.0";
                        }
                    }
                    updateStepsRecommendation();
                    saveMusicStudioSettings();
                }
            });
        }

        // Preset steps buttons handler
        document.querySelectorAll('.preset-steps-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.currentTarget.getAttribute('data-value');
                const stepsInput = document.getElementById('music-steps');
                if (stepsInput) {
                    stepsInput.value = val;
                    saveMusicStudioSettings();
                }
            });
        });

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
        updateStepsRecommendation();



        // Initialize lyric state from loaded textarea value
        const initialLyricsTextarea = document.getElementById('generated-lyrics');
        if (initialLyricsTextarea) {
            window.lyricStudioState.currentText = initialLyricsTextarea.value;
            setTimeout(updateLyricsGutter, 100); // Small timeout to ensure fonts/layout are ready
        }

        // Attach event listeners to auto-persist changes
        PERSISTED_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
                el.addEventListener(eventType, saveMusicStudioSettings);
            }
        });

        // Auto-sync active subject selector to playlist dropdown and global player view
        const selectSubject = document.getElementById('subject-selector');
        const selectPlaylist = document.getElementById('playlist-target-select');
        if (selectSubject && selectPlaylist) {
            const syncSubjectToPlaylist = () => {
                const val = selectSubject.value;
                if (val === 'custom') return;

                selectPlaylist.value = val;

                // Notify global floating player to update its active playlist view
                window.dispatchEvent(new CustomEvent('gnosys_set_active_class', {
                    detail: { classId: val }
                }));
            };

            selectSubject.addEventListener('change', syncSubjectToPlaylist);
            selectSubject.addEventListener('input', syncSubjectToPlaylist);
            
            // Sync on page load (with a small timeout to let the global player load first)
            setTimeout(syncSubjectToPlaylist, 100);
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

                // Prepare directory permissions while user gesture is active
                const prepareEvent = new CustomEvent('gnosys_prepare_auto_download', {
                    detail: { promise: null }
                });
                window.dispatchEvent(prepareEvent);
                if (prepareEvent.detail.promise) {
                    try {
                        await prepareEvent.detail.promise;
                    } catch (err) {
                        console.warn('[Music Studio] Auto-download directory permission preparation failed/cancelled:', err);
                    }
                }

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

                        // Dispatch local event to refresh local playlist drawer
                        window.dispatchEvent(new CustomEvent('gnosys_playlist_updated'));

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
        
        const vramSelector = document.getElementById('music-vram-profile');
        if (vramSelector) {
            vramSelector.value = vramProfile;
            vramSelector.addEventListener('change', (e) => {
                vramProfile = e.target.value;
                localStorage.setItem('gnosys_music_vram_profile', vramProfile);
                
                const badge = document.getElementById('comfy-status-badge');
                const isRunning = badge && badge.textContent.trim() === 'Running';
                if (isRunning) {
                    showBannerNotification("VRAM profile saved! Please close your local helper terminal (or batch runner) and restart the service to apply.", "warning");
                } else {
                    showBannerNotification(`VRAM profile updated to ${vramProfile === 'low' ? 'Optimized (Low VRAM)' : 'Standard (High VRAM)'}.`, "success");
                }
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
            if (window.latestStatusData) {
                const missing = getMissingModelsList(window.latestStatusData);
                if (missing.length > 0) {
                    showBannerNotification('Cannot launch: Required model files are missing or still downloading.', 'warning');
                    return;
                }
            }
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
            const container = document.getElementById('custom-subject-input');
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
                
                // Auto-scroll the newly visible settings panel into viewport smoothly
                setTimeout(() => {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            } else {
                panel.classList.add('hidden');
                chevron.classList.remove('rotate-180');
            }
        });

        // LM CFG slider update value label
        document.getElementById('music-lm-cfg').addEventListener('input', (e) => {
            document.getElementById('lm-cfg-val').textContent = parseFloat(e.target.value).toFixed(1);
        });

        // DiT CFG guidance scale slider update value label
        const guidanceScaleSlider = document.getElementById('music-guidance-scale');
        if (guidanceScaleSlider) {
            guidanceScaleSlider.addEventListener('input', (e) => {
                const valLabel = document.getElementById('guidance-scale-val');
                if (valLabel) valLabel.textContent = parseFloat(e.target.value).toFixed(1);
            });
        }

        // Lyrics Textarea listeners
        const lyricsTextarea = document.getElementById('generated-lyrics');
        if (lyricsTextarea) {
            lyricsTextarea.addEventListener('scroll', () => {
                const gutter = document.getElementById('lyrics-gutter');
                if (gutter) gutter.scrollTop = lyricsTextarea.scrollTop;
            });
            lyricsTextarea.addEventListener('input', () => {
                window.lyricStudioState.currentText = lyricsTextarea.value;
                updateLyricsGutter();
            });
            
            // Caret selection listener for highlight capture
            const handleSelectEvent = () => handleLyricsSelection();
            lyricsTextarea.addEventListener('select', handleSelectEvent);
            lyricsTextarea.addEventListener('mouseup', handleSelectEvent);
            lyricsTextarea.addEventListener('keyup', handleSelectEvent);
        }

        // Chat Input and Send listeners
        const btnSendChat = document.getElementById('btn-send-chat');
        const chatInput = document.getElementById('studio-chat-input');
        if (btnSendChat && chatInput) {
            btnSendChat.addEventListener('click', handleSendChatMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                }
            });
        }

        // Floating badge clear selection listener
        const btnClearSel = document.getElementById('btn-clear-selection');
        if (btnClearSel) {
            btnClearSel.addEventListener('click', clearLyricsSelection);
        }

        // Assistant Mode Toggles & Critique Button
        const btnModeWrite = document.getElementById('btn-mode-write');
        const btnModeCritique = document.getElementById('btn-mode-critique');
        if (btnModeWrite && btnModeCritique) {
            btnModeWrite.addEventListener('click', () => toggleAssistantMode('write'));
            btnModeCritique.addEventListener('click', () => toggleAssistantMode('critique'));
        }

        const btnCritiqueLyrics = document.getElementById('btn-critique-lyrics');
        if (btnCritiqueLyrics) {
            btnCritiqueLyrics.addEventListener('click', triggerLyricCritiqueRun);
        }

        // Toolbar Buttons
        const btnUndo = document.getElementById('btn-undo-lyrics');
        if (btnUndo) btnUndo.addEventListener('click', handleUndoLyrics);

        const btnClear = document.getElementById('btn-clear-lyrics');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                if (lyricsTextarea) {
                    pushLyricHistory(lyricsTextarea.value);
                    lyricsTextarea.value = '';
                    window.lyricStudioState.currentText = '';
                    clearLyricsSelection();
                    saveMusicStudioSettings();
                    showBannerNotification("Workspace cleared.", "info");
                }
            });
        }

        const btnCopy = document.getElementById('btn-copy-lyrics');
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                if (lyricsTextarea && lyricsTextarea.value.trim()) {
                    navigator.clipboard.writeText(lyricsTextarea.value);
                    showBannerNotification("Lyrics copied to clipboard!", "success");
                } else {
                    showBannerNotification("No lyrics to copy.", "warning");
                }
            });
        }

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

        // BroadcastChannel listener to pause local preview audio when global playlist music plays
        const studioChannel = new BroadcastChannel('gnosys_audio_channel');
        studioChannel.onmessage = (event) => {
            const data = event.data;
            if (!data) return;
            if (data.type === 'global_play' || data.type === 'play' || data.type === 'load_track' || (data.type === 'engine_state' && !data.paused)) {
                const localAudio = document.getElementById('audio-player');
                if (localAudio && !localAudio.paused) {
                    localAudio.pause();
                }
            }
        };

        // AI Tutor router status & enable banner handling
        const updateAiStatusUI = (status) => {
            const warningCard = document.getElementById('ai-disabled-warning');
            if (!warningCard) return;
            if (status && status.provider === 'no-ai') {
                warningCard.classList.remove('hidden');
            } else {
                warningCard.classList.add('hidden');
            }
        };

        // Initialize display using current status
        if (window.GnosysLLM) {
            updateAiStatusUI(window.GnosysLLM.getStatus());
        }

        window.addEventListener('gnosys-llm-provider-changed', (event) => {
            if (event.detail) {
                updateAiStatusUI(event.detail);
            }
        });

        const btnEnableAi = document.getElementById('btn-enable-ai-tutor');
        if (btnEnableAi) {
            btnEnableAi.addEventListener('click', (e) => {
                e.preventDefault();
                const badge = document.querySelector('[data-llm-provider-badge]');
                if (badge) {
                    badge.click();
                } else if (window.GnosysLLM) {
                    // Fallback to show choice modal directly if badge element is missing
                    window.GnosysLLM.showMobileChoiceModal();
                }
            });
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
        } else if (selectedModel === "acemusic/acestep-v15-turbo" && !data.diagnostics.turbo) {
            missing.push({
                label: "Turbo Model (2B)",
                repoId: "ACE-Step/acestep-v15-turbo",
                targetSubdir: "checkpoints/acestep-v15-turbo"
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
                        const dlStatus = data.active_downloads_status && data.active_downloads_status[repoId];
                        const isSuccess = status || (data.active_downloads && data.active_downloads[repoId] === 'success') || (dlStatus && dlStatus.status === 'success');
                        const isDownloading = !isSuccess && (dlStatus ? dlStatus.status === 'downloading' : (data.active_downloads && data.active_downloads[repoId] === 'downloading'));
                        const isStopped = !isSuccess && dlStatus && dlStatus.status === 'stopped';
                        const isFailed = !isSuccess && ((data.active_downloads && data.active_downloads[repoId] === 'failed') || (dlStatus && dlStatus.status === 'failed'));
                        
                        const wrapper = document.createElement('div');
                        wrapper.className = "flex items-center gap-1.5 shrink-0";

                        const baseClass = "text-[9px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 shrink-0 transition-all text-decoration-none cursor-pointer";
                        let themeClass = "";
                        let iconHtml = "";
                        let text = label;
                        let tooltip = "";

                        if (isDownloading) {
                            themeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20 badge-pulse-amber";
                            iconHtml = '<i class="fa-solid fa-spinner fa-spin"></i>';
                            const pct = dlStatus ? dlStatus.progress : 0;
                            const speed = dlStatus ? dlStatus.speed : '0 MB/s';
                            const eta = dlStatus ? dlStatus.eta : '--:--';
                            text = `${label} (${pct}% - ${speed}, ETA: ${eta})`;
                            tooltip = "Downloading model checkpoints from Hugging Face...";
                        } else if (isStopped) {
                            themeClass = "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20";
                            iconHtml = '<i class="fa-solid fa-circle-pause"></i>';
                            const pct = dlStatus ? dlStatus.progress : 0;
                            text = `${label} (Paused: ${pct}%)`;
                            tooltip = "Download paused. Click to resume.";
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

                        wrapper.appendChild(badgeEl);

                        if (isDownloading) {
                            const stopBtn = document.createElement('button');
                            stopBtn.className = "text-[9px] w-5 h-5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/25 flex items-center justify-center transition-all cursor-pointer";
                            stopBtn.title = "Pause Download";
                            stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                            stopBtn.addEventListener('click', async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showBannerNotification(`Pausing download for ${label}...`, 'info');
                                try {
                                    const stopRes = await fetch(`${API_BASE}/api/music/download/stop`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ repo_id: repoId })
                                    });
                                    const stopData = await stopRes.json();
                                    if (stopData.status === 'success') {
                                        showBannerNotification(`Download paused for ${label}.`, 'success');
                                        checkMusicServiceStatus();
                                    } else {
                                        showBannerNotification(`Failed to pause: ${stopData.message}`, 'error');
                                    }
                                } catch (err) {
                                    showBannerNotification(`Failed to pause: ${err.message}`, 'error');
                                }
                            });
                            wrapper.appendChild(stopBtn);
                        }

                        return wrapper;
                    };

                    diagBox.appendChild(makeBadge("XL SFT", data.diagnostics.xl_sft, "ACE-Step/acestep-v15-xl-sft", "checkpoints/acestep-v15-xl-sft"));
                    diagBox.appendChild(makeBadge("XL Turbo", data.diagnostics.xl_turbo, "ACE-Step/acestep-v15-xl-turbo", "checkpoints/acestep-v15-xl-turbo"));
                    diagBox.appendChild(makeBadge("Turbo 2B", data.diagnostics.turbo, "ACE-Step/acestep-v15-turbo", "checkpoints/acestep-v15-turbo"));
                    diagBox.appendChild(makeBadge("Vocoder", data.diagnostics.vocoder, "Comfy-Org/ACE-Step_ComfyUI_repackaged", "models/TTS/ACE-Step-v1-3.5B/music_vocoder"));
                    diagBox.appendChild(makeBadge("DCAE Encoder", data.diagnostics.dcae, "Comfy-Org/ACE-Step_ComfyUI_repackaged", "models/TTS/ACE-Step-v1-3.5B/music_dcae_f8c8"));
                    diagBox.appendChild(makeBadge("UMT5 Text", data.diagnostics.umt5, "Comfy-Org/ACE-Step_ComfyUI_repackaged", "models/TTS/ACE-Step-v1-3.5B/umt5-base"));
                }
            }

            // Cache latest status data
            window.latestStatusData = data;

            if (data.comfy_running) {
                launchBtn.classList.add('hidden');
                installBtn.classList.add('hidden');

                if (data.comfy_state === 'loading') {
                    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider badge-pulse-amber';
                    badge.textContent = 'Loading Weights';
                    icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-amber-400"></i>';
                } else if (data.comfy_state === 'lazy') {
                    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase font-extrabold tracking-wider';
                    badge.textContent = 'Lazy Ready';
                    icon.innerHTML = '<i class="fa-solid fa-bolt text-sky-400"></i>';
                } else {
                    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase font-extrabold tracking-wider';
                    badge.textContent = 'Running';
                    icon.innerHTML = '<i class="fa-solid fa-circle-check text-teal-400"></i>';
                }
                
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
                    const activeRepos = data.active_downloads ? Object.keys(data.active_downloads).filter(k => data.active_downloads[k] === 'downloading' || data.active_downloads[k] === 'failed') : [];
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
                    const missing = getMissingModelsList(data);
                    if (missing.length > 0) {
                        badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider badge-pulse-amber';
                        badge.textContent = 'Waiting for Models';
                        icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-amber-400"></i>';
                    } else {
                        badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider';
                        badge.textContent = 'Offline';
                        icon.innerHTML = '<i class="fa-solid fa-server text-amber-400"></i>';
                    }
                    launchBtn.classList.remove('hidden');
                    installBtn.classList.add('hidden');

                    // Auto-start server if enabled
                    const autoStartEnabled = document.getElementById('auto-start-checkbox')?.checked ?? true;
                    if (autoStartEnabled && !isLaunchingService && missing.length === 0) {
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

        showBannerNotification('Service launch triggered. Loading neural weights into memory...', 'info');

        const interval = setInterval(async () => {
            attempts++;
            if (badge) {
                badge.textContent = `Starting (${attempts}/${maxAttempts})`;
            }
            try {
                const res = await fetch('http://127.0.0.1:8002/health', { signal: AbortSignal.timeout(1000) });
                if (res.ok) {
                    const healthData = await res.json();
                    
                    if (healthData.status === 'loading') {
                        // Keep polling but show loading weights message
                        if (badge) {
                            badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider badge-pulse-amber';
                            badge.textContent = `Loading Weights... (${attempts})`;
                        }
                        return;
                    }
                    
                    clearInterval(interval);
                    isLaunchingService = false;
                    if (launchBtn) {
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<i class="fa-solid fa-rocket mr-1.5"></i> Launch Service';
                    }
                    
                    if (healthData.status === 'lazy') {
                        showBannerNotification('ACE-Step API Server connected successfully (Lazy Ready)!', 'success');
                    } else {
                        showBannerNotification('ACE-Step API Server connected and fully loaded!', 'success');
                    }
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

    // ==========================================
    // CHATBOT & LYRICS WORKSPACE LOGIC
    // ==========================================

    function updateLyricsGutter() {
        const textarea = document.getElementById('generated-lyrics');
        const gutter = document.getElementById('lyrics-gutter');
        if (!textarea || !gutter) return;

        const lines = textarea.value.split('\n');
        const totalLines = Math.max(1, lines.length);
        
        let gutterHtml = '';
        const highlight = window.lyricStudioState.highlight;
        
        for (let i = 1; i <= totalLines; i++) {
            const isActive = highlight && i >= highlight.startLine && i <= highlight.endLine;
            gutterHtml += `<div class="lyrics-gutter-line${isActive ? ' active-highlight' : ''}">${i}</div>`;
        }
        
        gutter.innerHTML = gutterHtml;
        gutter.scrollTop = textarea.scrollTop;
    }

    function handleLyricsSelection() {
        const textarea = document.getElementById('generated-lyrics');
        const contextBadge = document.getElementById('selection-context-badge');
        const badgeText = document.getElementById('selection-badge-text');
        if (!textarea) return;

        const text = textarea.value;
        const startChar = textarea.selectionStart;
        const endChar = textarea.selectionEnd;

        if (startChar !== endChar) {
            const beforeStart = text.substring(0, startChar);
            const startLine = beforeStart.split('\n').length;
            
            const selectedText = text.substring(startChar, endChar);
            const selectedLinesCount = selectedText.split('\n').length;
            const endLine = startLine + selectedLinesCount - 1;

            window.lyricStudioState.highlight = {
                text: selectedText,
                startLine,
                endLine,
                startChar,
                endChar
            };

            updateLyricsGutter();

            if (contextBadge && badgeText) {
                badgeText.textContent = `Lines ${startLine} to ${endLine} selected`;
                contextBadge.classList.remove('hidden');
                contextBadge.classList.add('flex');
            }
        } else {
            if (window.lyricStudioState.highlight) {
                window.lyricStudioState.highlight = null;
                updateLyricsGutter();
                if (contextBadge) {
                    contextBadge.classList.add('hidden');
                    contextBadge.classList.remove('flex');
                }
            }
        }
    }

    function clearLyricsSelection() {
        const textarea = document.getElementById('generated-lyrics');
        const contextBadge = document.getElementById('selection-context-badge');
        if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = 0;
        }
        window.lyricStudioState.highlight = null;
        updateLyricsGutter();
        if (contextBadge) {
            contextBadge.classList.add('hidden');
            contextBadge.classList.remove('flex');
        }
    }

    function pushLyricHistory(text) {
        const history = window.lyricStudioState.history;
        if (history.length === 0 || history[history.length - 1] !== text) {
            history.push(text);
            if (history.length > MAX_HISTORY) {
                history.shift();
            }
            const undoBtn = document.getElementById('btn-undo-lyrics');
            if (undoBtn) undoBtn.disabled = false;
        }
    }

    function handleUndoLyrics() {
        const history = window.lyricStudioState.history;
        const textarea = document.getElementById('generated-lyrics');
        if (history.length > 0 && textarea) {
            const previousText = history.pop();
            textarea.value = previousText;
            window.lyricStudioState.currentText = previousText;
            
            window.lyricStudioState.highlight = null;
            updateLyricsGutter();
            
            const contextBadge = document.getElementById('selection-context-badge');
            if (contextBadge) {
                contextBadge.classList.add('hidden');
                contextBadge.classList.remove('flex');
            }
            
            saveMusicStudioSettings();
            
            const undoBtn = document.getElementById('btn-undo-lyrics');
            if (undoBtn) {
                undoBtn.disabled = history.length === 0;
            }
            
            showBannerNotification("Lyrics restored to previous state.", "info");
        }
    }

    function toggleAssistantMode(mode) {
        const btnWrite = document.getElementById('btn-mode-write');
        const btnCritique = document.getElementById('btn-mode-critique');
        const chatHistory = document.getElementById('studio-chat-history');
        const critiquePanel = document.getElementById('studio-critique-panel');
        const chatInput = document.getElementById('studio-chat-input');
        
        if (mode === 'critique') {
            isCritiqueMode = true;
            if (btnCritique) {
                btnCritique.classList.add('active');
                btnCritique.classList.remove('bg-transparent');
                btnCritique.classList.add('bg-white/5');
            }
            if (btnWrite) {
                btnWrite.classList.remove('active', 'bg-white/5');
                btnWrite.classList.add('bg-transparent');
            }
            
            if (chatHistory) chatHistory.classList.add('hidden');
            if (critiquePanel) critiquePanel.classList.remove('hidden');
            
            if (chatInput) {
                chatInput.placeholder = "Ask the chatbot to critique or help revise a section...";
            }
        } else {
            isCritiqueMode = false;
            if (btnWrite) {
                btnWrite.classList.add('active');
                btnWrite.classList.remove('bg-transparent');
                btnWrite.classList.add('bg-white/5');
            }
            if (btnCritique) {
                btnCritique.classList.remove('active', 'bg-white/5');
                btnCritique.classList.add('bg-transparent');
            }
            
            if (critiquePanel) critiquePanel.classList.add('hidden');
            if (chatHistory) chatHistory.classList.remove('hidden');
            
            if (chatInput) {
                chatInput.placeholder = "Ask the chatbot to write or modify lyrics...";
            }
        }
    }

    async function triggerLyricCritiqueRun() {
        if (isChatResponding) return;
        
        // Force critique mode active
        toggleAssistantMode('critique');
        
        const lyricsTextarea = document.getElementById('generated-lyrics');
        const currentLyrics = lyricsTextarea ? lyricsTextarea.value : '';
        
        if (!currentLyrics.trim()) {
            showBannerNotification("Write or generate some lyrics in the workspace first!", "warning");
            return;
        }
        
        // Show loading state in annotations list
        const listContainer = document.getElementById('critique-annotations-list');
        if (listContainer) {
            listContainer.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center italic bg-slate-950/20 rounded-2xl border border-white/5"><i class="fa-solid fa-circle-notch fa-spin mr-1.5 text-fuchsia-400 animate-spin"></i> Running lyric structure and rhythm analysis...</div>`;
        }
        
        // Construct user critique prompt
        const userPrompt = "Perform a complete critique analysis of my current lyrics. Provide quality scores and line-by-line annotations.";
        
        // Send critique request
        await runCritiqueAPI(userPrompt);
    }

    async function runCritiqueAPI(userPrompt) {
        if (isChatResponding) return;
        isChatResponding = true;
        
        const sendBtn = document.getElementById('btn-send-chat');
        const critiqueBtn = document.getElementById('btn-critique-lyrics');
        
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>';
        }
        if (critiqueBtn) {
            critiqueBtn.disabled = true;
            critiqueBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5 text-fuchsia-400 animate-spin"></i> Analyzing...';
        }

        const subjectSelector = document.getElementById('subject-selector');
        let subjectName = '';
        if (subjectSelector) {
            if (subjectSelector.value === 'custom') {
                const customSubjectVal = document.getElementById('custom-subject-input')?.value.trim();
                subjectName = customSubjectVal || 'a custom academic study subject';
            } else {
                subjectName = subjectSelector.options[subjectSelector.selectedIndex]?.text || 'Study Topic';
            }
        } else {
            subjectName = 'Study Topic';
        }

        const lyricsTextarea = document.getElementById('generated-lyrics');
        const currentLyrics = lyricsTextarea ? lyricsTextarea.value : '';

        const systemPrompt = `You are a creative, expert educational songwriter and music producer for Gnosys AI.
Your objective is to help the student write, refine, and structure catchy, mnemonically dense, and rhythmically aligned study lyrics for their target subject.

The target subject is: "${subjectName}".

CURRENT LYRICS WORKSPACE CONTENT:
"""
${currentLyrics}
"""

CRITIQUE & REVIEW MODE IS ACTIVE:
The user is focusing on reviewing and critiquing the current lyrics.
You MUST analyze the lyrics across four dimensions and return a scorecard and specific line annotations.
Place this data in a <critique_data>...</critique_data> tag containing a JSON object in this format:
{
  "scores": {
    "mnemonic": 85, // Mnemonic Density (0-100)
    "rhythm": 70,    // Rhythm & Flow (0-100)
    "accuracy": 90,  // Scientific Accuracy (0-100)
    "rhyme": 80      // Rhyme & Catchiness (0-100)
  },
  "annotations": [
    {
      "startLine": 5,
      "endLine": 6,
      "category": "rhythm", // "rhythm", "mnemonic", "accuracy", "rhyme"
      "message": "Line 6 is metrically heavy. Suggest shortening to balance syllables.",
      "suggestion": "Physiology is how it works, the chemistry!"
    }
  ]
}
Note: Place constructive critique explanations inside the <chat_response> tag, walking the user through 1 or 2 key critique points step-by-step. Let the user decide when to apply changes. Do not output <edit_lyrics> unless the user explicitly requested you to edit the document directly.
`;

        try {
            if (window.GnosysLLM) {
                let responseText = '';
                
                await window.GnosysLLM.generateResponse(systemPrompt, userPrompt, {
                    stream: true,
                    history: studioConversationHistory.slice(0, -1),
                    onToken: (token, fullText) => {
                        responseText = fullText;
                    }
                });

                // Add to chat history
                studioConversationHistory.push({ role: "user", content: userPrompt });
                studioConversationHistory.push({ role: "assistant", content: responseText });

                // Also append the chat response to the chat history bubble so they can read it when switching back
                const bubble = appendChatMessage("Gnosys AI", "", "agent");
                const bubbleBody = bubble.querySelector('.agent-message-body');
                const chatText = parseChatResponse(responseText);
                if (chatText) {
                    bubbleBody.innerHTML = parseMarkdown(chatText);
                } else {
                    bubbleBody.innerHTML = "Lyrical critique completed. See scorecard and cards on the Critique Panel.";
                }

                const critiqueData = parseCritiqueData(responseText);
                if (critiqueData) {
                    renderCritiqueDashboard(critiqueData);
                } else {
                    const listContainer = document.getElementById('critique-annotations-list');
                    if (listContainer) {
                        listContainer.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center italic bg-slate-950/20 rounded-2xl border border-white/5">Failed to extract structured critique data. The model might not have structured it properly. Please try again.</div>`;
                    }
                }
                
                const settings = parseUpdateSettings(responseText);
                if (settings) {
                    applySettingsUpdate(settings);
                }
            } else {
                showBannerNotification("Gnosys LLM Engine is unavailable.", "error");
            }
        } catch (err) {
            showBannerNotification(`Critique run failed: ${err.message}`, "error");
        } finally {
            isChatResponding = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
            }
            if (critiqueBtn) {
                critiqueBtn.disabled = false;
                critiqueBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles animate-pulse"></i> <span>Critique</span>';
            }
        }
    }

    function cleanJsonString(jsonStr) {
        let cleaned = "";
        let inString = false;
        for (let i = 0; i < jsonStr.length; i++) {
            let char = jsonStr[i];
            if (char === '"' && (i === 0 || jsonStr[i-1] !== '\\')) {
                // Structural quote checks
                let isStructural = false;
                let after = jsonStr.substring(i + 1).trim();
                let before = jsonStr.substring(0, i).trim();
                
                if (before.endsWith('{') || before.endsWith('[') || before.endsWith(',')) {
                    isStructural = true;
                    inString = true;
                } else if (after.startsWith(':')) {
                    isStructural = true;
                    inString = false;
                } else if (before.endsWith(':')) {
                    isStructural = true;
                    inString = true;
                } else if (after.startsWith(',') || after.startsWith('}') || after.startsWith(']')) {
                    isStructural = true;
                    inString = false;
                }
                
                if (isStructural) {
                    cleaned += char;
                } else {
                    cleaned += '\\"'; // Escape internal unescaped double quote
                }
            } else {
                cleaned += char;
            }
        }
        return cleaned;
    }

    function parseCritiqueData(rawText) {
        const match = rawText.match(/<critique_data>([\s\S]*?)<\/critique_data>/i);
        if (match) {
            try {
                const cleanedContent = cleanJsonString(match[1].trim());
                return JSON.parse(cleanedContent);
            } catch (e) {
                console.error("Failed to parse critique JSON:", e, match[1]);
            }
        }
        return null;
    }

    function parseUpdateSettings(rawText) {
        const match = rawText.match(/<update_settings>([\s\S]*?)<\/update_settings>/i);
        if (match) {
            try {
                const cleanedContent = cleanJsonString(match[1].trim());
                return JSON.parse(cleanedContent);
            } catch (e) {
                console.error("Failed to parse settings update JSON:", e, match[1]);
            }
        }
        return null;
    }

    function renderCritiqueDashboard(data) {
        if (!data) return;
        activeCritiqueData = data;
        
        // Update scorecard numbers and bars
        const fields = ['mnemonic', 'rhythm', 'accuracy', 'rhyme'];
        fields.forEach(f => {
            const valEl = document.getElementById(`score-${f}-val`);
            const barEl = document.getElementById(`score-${f}-bar`);
            if (valEl && barEl && data.scores && typeof data.scores[f] !== 'undefined') {
                const score = data.scores[f];
                valEl.textContent = `${score}%`;
                barEl.style.width = `${score}%`;
            }
        });
        
        // Update annotations list
        const listContainer = document.getElementById('critique-annotations-list');
        if (!listContainer) return;
        
        if (!data.annotations || data.annotations.length === 0) {
            listContainer.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center italic bg-slate-950/20 rounded-2xl border border-white/5">
                No critiques found! Your lyrics look great.
            </div>`;
            return;
        }
        
        listContainer.innerHTML = '';
        data.annotations.forEach((item, idx) => {
            const card = document.createElement('div');
            const categoryClass = item.category ? `critique-indicator-${item.category.toLowerCase()}` : '';
            card.className = `critique-card p-4 space-y-3 ${categoryClass}`;
            
            // Format line range label
            const linesLabel = item.startLine === item.endLine ? `Line ${item.startLine}` : `Lines ${item.startLine}-${item.endLine}`;
            
            // Format category badge label
            const catLabel = item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'Critique';
            let badgeColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
            if (item.category === 'rhythm') badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            else if (item.category === 'mnemonic') badgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
            else if (item.category === 'accuracy') badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            else if (item.category === 'rhyme') badgeColor = 'text-pink-400 bg-pink-500/10 border-pink-500/20';

            let suggestionHtml = '';
            if (item.suggestion) {
                suggestionHtml = `
                <div class="mt-2.5 p-2.5 rounded-xl bg-slate-950/40 border border-white/5 space-y-2">
                    <p class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 text-left">Suggested Replacement</p>
                    <pre class="font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-normal text-left">${escapeHtml(item.suggestion)}</pre>
                    <button class="btn-apply-critique-suggestion w-full py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-[10px] font-bold text-indigo-300 hover:text-white transition-all border border-indigo-500/20 cursor-pointer" 
                        data-idx="${idx}">
                        <i class="fa-solid fa-check mr-1"></i> Apply Refinement
                    </button>
                </div>`;
            }

            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="text-[9px] px-2 py-0.5 rounded-full border ${badgeColor} font-bold uppercase tracking-wider">${catLabel}</span>
                    <span class="text-[10px] text-slate-400 font-mono font-bold">${linesLabel}</span>
                </div>
                <p class="text-xs text-slate-300 leading-relaxed text-left">${escapeHtml(item.message)}</p>
                ${suggestionHtml}
            `;
            
            // Hover events to highlight editor gutter line range
            card.addEventListener('mouseenter', () => {
                highlightEditorGutterRange(item.startLine, item.endLine);
            });
            card.addEventListener('mouseleave', () => {
                clearEditorGutterHighlight();
            });

            listContainer.appendChild(card);
        });

        // Attach apply button listeners
        listContainer.querySelectorAll('.btn-apply-critique-suggestion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                applyCritiqueSuggestion(idx);
            });
        });
    }

    function highlightEditorGutterRange(startLine, endLine) {
        const gutter = document.getElementById('lyrics-gutter');
        if (!gutter) return;
        
        const lines = gutter.querySelectorAll('.lyrics-gutter-line');
        for (let i = 1; i <= lines.length; i++) {
            if (i >= startLine && i <= endLine) {
                lines[i - 1]?.classList.add('active-highlight');
            } else {
                lines[i - 1]?.classList.remove('active-highlight');
            }
        }
    }

    function clearEditorGutterHighlight() {
        const gutter = document.getElementById('lyrics-gutter');
        if (!gutter) return;
        
        const highlight = window.lyricStudioState.highlight;
        const lines = gutter.querySelectorAll('.lyrics-gutter-line');
        
        for (let i = 1; i <= lines.length; i++) {
            const isActive = highlight && i >= highlight.startLine && i <= highlight.endLine;
            if (isActive) {
                lines[i - 1]?.classList.add('active-highlight');
            } else {
                lines[i - 1]?.classList.remove('active-highlight');
            }
        }
    }

    function applyCritiqueSuggestion(idx) {
        if (!activeCritiqueData || !activeCritiqueData.annotations || !activeCritiqueData.annotations[idx]) return;
        const item = activeCritiqueData.annotations[idx];
        if (!item.suggestion) return;
        
        const lyricsTextarea = document.getElementById('generated-lyrics');
        if (!lyricsTextarea) return;
        
        const edit = {
            target: 'range',
            start: item.startLine,
            end: item.endLine,
            content: item.suggestion
        };
        
        applyLyricsEdit(edit);
        
        // Remove this card from active data and re-render
        activeCritiqueData.annotations.splice(idx, 1);
        renderCritiqueDashboard(activeCritiqueData);
    }

    function applySettingsUpdate(settings) {
        if (!settings) return;
        
        let updatedAny = false;
        
        for (const [key, val] of Object.entries(settings)) {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') {
                    const boolVal = (val === true || val === 'true');
                    if (el.checked !== boolVal) {
                        el.checked = boolVal;
                        updatedAny = true;
                        triggerSettingFlash(el);
                    }
                } else {
                    const strVal = String(val);
                    if (el.value !== strVal) {
                        el.value = strVal;
                        updatedAny = true;
                        triggerSettingFlash(el);
                        
                        // If it's a slider, update the value text display
                        if (key === 'music-lm-cfg') {
                            const valText = document.getElementById('lm-cfg-val');
                            if (valText) valText.textContent = parseFloat(strVal).toFixed(1);
                        }
                    }
                }
            }
        }
        
        if (updatedAny) {
            saveMusicStudioSettings();
            showBannerNotification("Assistant updated generation settings autonomously.", "success");
            
            // If the model changed, we might need to recheck service status (e.g. downloads)
            if (settings['music-model']) {
                checkMusicServiceStatus();
            }
        }
    }

    function triggerSettingFlash(element) {
        if (!element) return;
        element.classList.remove('setting-glow-flash');
        void element.offsetWidth; // Force reflow to restart animation
        element.classList.add('setting-glow-flash');
        setTimeout(() => {
            element.classList.remove('setting-glow-flash');
        }, 2000);
    }

    function appendChatMessage(sender, text, role = 'agent') {
        const chatHistory = document.getElementById('studio-chat-history');
        if (!chatHistory) return;

        const bubble = document.createElement('div');
        if (role === 'user') {
            bubble.className = 'chat-bubble-user p-3.5 text-xs text-slate-200 leading-relaxed max-w-[90%] self-end ml-auto';
            bubble.innerHTML = `<p class="font-bold text-indigo-400 mb-1">You:</p><div>${escapeHtml(text)}</div>`;
        } else {
            bubble.className = 'chat-bubble-agent p-3.5 text-xs text-slate-200 leading-relaxed max-w-[90%]';
            bubble.innerHTML = `<p class="font-bold text-fuchsia-400 mb-1">${sender}:</p><div class="agent-message-body">${text}</div>`;
        }
        chatHistory.appendChild(bubble);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return bubble;
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function parseMarkdown(text) {
        if (window.marked && window.marked.parse) {
            return window.marked.parse(text, { breaks: true });
        }
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>')
                   .replace(/\n/g, '<br>');
    }

    function parseChatResponse(rawText) {
        const startTag = '<chat_response>';
        const endTag = '</chat_response>';
        const startIndex = rawText.toLowerCase().indexOf(startTag);
        let chatText = "";
        
        if (startIndex !== -1) {
            const contentStart = startIndex + startTag.length;
            const endIndex = rawText.toLowerCase().indexOf(endTag, contentStart);
            if (endIndex !== -1) {
                chatText = rawText.substring(contentStart, endIndex).trim();
            } else {
                chatText = rawText.substring(contentStart).trim();
            }
        } else if (!rawText.includes('<chat_response>') && !rawText.includes('<edit_lyrics>') && !rawText.includes('<critique_data>') && !rawText.includes('<update_settings>')) {
            chatText = rawText.trim();
        }
        
        // Clean up any other XML tags that might leak in during streaming
        chatText = chatText.replace(/<critique_data>[\s\S]*/i, '')
                           .replace(/<update_settings>[\s\S]*/i, '')
                           .replace(/<edit_lyrics[^>]*>[\s\S]*/i, '');
                           
        return chatText.trim();
    }

    function parseEditLyrics(rawText) {
        const match = rawText.match(/<edit_lyrics([^>]*)>([\s\S]*?)<\/edit_lyrics>/i);
        if (match) {
            const attributesStr = match[1];
            const content = match[2].trim();
            
            const targetMatch = attributesStr.match(/target=["']([^"']+)["']/i);
            const target = targetMatch ? targetMatch[1].toLowerCase() : 'all';
            
            const startMatch = attributesStr.match(/start=["'](\d+)["']/i);
            const start = startMatch ? parseInt(startMatch[1]) : 1;
            
            const endMatch = attributesStr.match(/end=["'](\d+)["']/i);
            const end = endMatch ? parseInt(endMatch[1]) : 1;
            
            return { target, start, end, content };
        }
        return null;
    }

    function applyLyricsEdit(edit) {
        const textarea = document.getElementById('generated-lyrics');
        if (!textarea) return;

        const currentText = textarea.value;
        pushLyricHistory(currentText);

        let newText = currentText;

        if (edit.target === 'all') {
            newText = edit.content;
            showBannerNotification("Full lyrics updated by Assistant.", "success");
            flashArea();
        } else if (edit.target === 'selection' && window.lyricStudioState.highlight) {
            const highlight = window.lyricStudioState.highlight;
            newText = currentText.substring(0, highlight.startChar) + 
                      edit.content + 
                      currentText.substring(highlight.endChar);
            showBannerNotification("Highlighted section updated.", "success");
            
            const replacementLinesCount = edit.content.split('\n').length;
            flashLines(highlight.startLine, highlight.startLine + replacementLinesCount - 1);
        } else if (edit.target === 'range') {
            const lines = currentText.split('\n');
            const startIdx = Math.max(1, edit.start) - 1;
            const endIdx = Math.min(lines.length, edit.end) - 1;
            
            const replacementLines = edit.content.split('\n');
            lines.splice(startIdx, (endIdx - startIdx + 1), ...replacementLines);
            newText = lines.join('\n');
            
            showBannerNotification(`Lines ${edit.start}-${edit.end} updated.`, "success");
            flashLines(edit.start, edit.start + replacementLines.length - 1);
        } else {
            if (edit.target === 'selection') {
                showBannerNotification("No text highlight active. Overwriting full lyrics instead.", "warning");
            }
            newText = edit.content;
            flashArea();
        }

        textarea.value = newText;
        window.lyricStudioState.currentText = newText;
        
        window.lyricStudioState.highlight = null;
        updateLyricsGutter();
        const contextBadge = document.getElementById('selection-context-badge');
        if (contextBadge) {
            contextBadge.classList.add('hidden');
            contextBadge.classList.remove('flex');
        }

        saveMusicStudioSettings();
    }

    function flashArea() {
        const wrapper = document.querySelector('.lyrics-editor-wrapper');
        if (wrapper) {
            wrapper.classList.add('line-glow-flash');
            setTimeout(() => wrapper.classList.remove('line-glow-flash'), 1500);
        }
    }

    function flashLines(startLine, endLine) {
        const gutter = document.getElementById('lyrics-gutter');
        if (!gutter) return;
        
        const lines = gutter.querySelectorAll('.lyrics-gutter-line');
        for (let i = startLine - 1; i < endLine; i++) {
            if (lines[i]) {
                lines[i].classList.add('line-glow-flash');
                setTimeout((targetLine) => {
                    if (targetLine) targetLine.classList.remove('line-glow-flash');
                }, 1500, lines[i]);
            }
        }
    }

    async function handleSendChatMessage() {
        if (isChatResponding) return;

        const chatInput = document.getElementById('studio-chat-input');
        const sendBtn = document.getElementById('btn-send-chat');
        if (!chatInput || !chatInput.value.trim()) return;

        const userText = chatInput.value.trim();
        chatInput.value = '';
        
        appendChatMessage("You", userText, "user");
        
        studioConversationHistory.push({ role: "user", content: userText });
        
        isChatResponding = true;
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>';
        }

        const subjectSelector = document.getElementById('subject-selector');
        let subjectName = '';
        if (subjectSelector) {
            if (subjectSelector.value === 'custom') {
                const customSubjectVal = document.getElementById('custom-subject-input')?.value.trim();
                subjectName = customSubjectVal || 'a custom academic study subject';
            } else {
                subjectName = subjectSelector.options[subjectSelector.selectedIndex]?.text || 'Study Topic';
            }
        } else {
            subjectName = 'Study Topic';
        }

        const lyricsTextarea = document.getElementById('generated-lyrics');
        const currentLyrics = lyricsTextarea ? lyricsTextarea.value : '';

        let selectionContext = 'No text highlighted in the workspace.';
        const highlight = window.lyricStudioState.highlight;
        const hasSelection = highlight !== null;
        if (hasSelection) {
            selectionContext = `The user has highlighted the following lines (${highlight.startLine} to ${highlight.endLine}) in their workspace:\n"""\n${highlight.text}\n"""\nThe user wants your response and any editing actions to target this highlighted section.`;
        }

        const bubble = appendChatMessage("Gnosys AI", "", "agent");
        const bubbleBody = bubble.querySelector('.agent-message-body');
        bubbleBody.innerHTML = `<div class="flex items-center space-x-1.5"><div class="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></div><div class="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div></div>`;

        const wantsCritique = isCritiqueMode || /critique|review|score|evaluate|analyse|analyze/i.test(userText);

        let systemPrompt = `You are a creative, expert educational songwriter and music producer for Gnosys AI.
Your objective is to help the student write, refine, and structure catchy, mnemonically dense, and rhythmically aligned study lyrics for their target subject.

The target subject is: "${subjectName}".

CURRENT LYRICS WORKSPACE CONTENT:
"""
${currentLyrics}
"""

${selectionContext}

INSTRUCTIONS FOR CONVERSATION AND EDITING:
1. Always engage in a back-and-forth friendly conversation. Explain what changes you are suggesting.
2. Place all conversational and explanatory responses inside <chat_response>...</chat_response> tags.
3. If you want to modify, replace, or insert lyrics:
   - To replace the highlighted selection, use:
     <edit_lyrics target="selection">NEW LYRICS HERE</edit_lyrics>
   - To replace a specific range of lines, use:
     <edit_lyrics target="range" start="START_LINE" end="END_LINE">NEW LYRICS HERE</edit_lyrics>
   - To overwrite or initialize the entire song lyrics, use:
     <edit_lyrics target="all">ENTIRE LYRICS CONTENT HERE</edit_lyrics>
4. Keep the lyrics easy to read, rhyming, and packed with actual educational keywords, facts, and definitions.
5. In your chat responses, you can also suggest changes and invite the user to highlight sections for refinement.
6. You can autonomously update generation settings to match the musical style, rhythm, or user requests (e.g. changing the style from lofi to synthwave, adjusting BPM, or enabling/disabling vocals), by outputting an <update_settings> tag containing a JSON object mapping setting field keys to their new values. The keys you can update are:
   - "music-prompt" (e.g. "chill lofi hiphop beat, study, piano")
   - "music-bpm" (e.g. "80", "100", "120")
   - "music-vocals" (e.g. "on", "off")
   - "music-steps" (e.g. "8", "20", "50")
   - "music-key" (e.g. "C Major", "A Minor", etc.)
   - "music-signature" (e.g. "4", "3", "6")
   Ensure the JSON inside the tag is strictly valid.
`;

        if (wantsCritique) {
            systemPrompt += `
CRITIQUE & REVIEW INSTRUCTIONS:
The user wants to review and critique the current lyrics.
You MUST analyze the lyrics across four dimensions and return a scorecard and specific line annotations.
Place this data in a <critique_data>...</critique_data> tag containing a JSON object in this format:
{
  "scores": {
    "mnemonic": 85, // Mnemonic Density (0-100)
    "rhythm": 70,    // Rhythm & Flow (0-100)
    "accuracy": 90,  // Scientific Accuracy (0-100)
    "rhyme": 80      // Rhyme & Catchiness (0-100)
  },
  "annotations": [
    {
      "startLine": 5,
      "endLine": 6,
      "category": "rhythm", // "rhythm", "mnemonic", "accuracy", "rhyme"
      "message": "Line 6 is metrically heavy. Suggest shortening to balance syllables.",
      "suggestion": "Physiology is how it works, the chemistry!"
    }
  ]
}
Note: Place constructive critique explanations inside the <chat_response> tag, walking the user through 1 or 2 key critique points step-by-step. Do not output <edit_lyrics> unless the user explicitly requested you to edit the document directly.
`;
        }

        systemPrompt += `
EXAMPLE OUTPUT FORMATS:
1. Normal Chat Response:
<chat_response>I've made the chorus catchier by adding some rhythm terms! Let me update that section for you now.</chat_response>
<edit_lyrics target="range" start="5" end="8">
[Chorus]
Anatomy is study of the form we see,
Physiology is how it works, the chemistry!
From cells to tissues, organs working day and night,
Keep the body balanced in the homeostatic light!
</edit_lyrics>

2. Setting Update:
<chat_response>Sure, I'll switch the style to lofi beats and adjust the BPM to 80 for a more relaxed study vibe.</chat_response>
<update_settings>
{
  "music-prompt": "lofi study beats, soft chill ambient synth, relaxing piano",
  "music-bpm": "80"
}
</update_settings>

3. Critique Mode Response:
<chat_response>I've analyzed your lyrics and found some areas to refine. Specifically, line 6 has too many syllables, and we could increase mnemonic density on line 12. Take a look at the annotations on your Critique panel.</chat_response>
<critique_data>
{
  "scores": {
    "mnemonic": 75,
    "rhythm": 60,
    "accuracy": 95,
    "rhyme": 80
  },
  "annotations": [
    {
      "startLine": 6,
      "endLine": 6,
      "category": "rhythm",
      "message": "Line 6 breaks the syllable count of the meter.",
      "suggestion": "Keep the body balanced in the homeostatic light!"
    }
  ]
}
</critique_data>
`;

        const userPrompt = userText;

        try {
            if (window.GnosysLLM) {
                let responseText = '';
                
                await window.GnosysLLM.generateResponse(systemPrompt, userPrompt, {
                    stream: true,
                    history: studioConversationHistory.slice(0, -1),
                    onToken: (token, fullText) => {
                        responseText = fullText;
                        
                        const chatText = parseChatResponse(fullText);
                        if (chatText) {
                            bubbleBody.innerHTML = parseMarkdown(chatText);
                        } else {
                            if (fullText.includes('<edit_lyrics')) {
                                bubbleBody.innerHTML = `<span class="text-slate-400 italic"><i class="fa-solid fa-pen-nib mr-1.5 animate-pulse"></i> Writing new lyric edits directly to workspace...</span>`;
                            } else if (fullText.includes('<critique_data>')) {
                                bubbleBody.innerHTML = `<span class="text-slate-400 italic"><i class="fa-solid fa-wand-magic-sparkles mr-1.5 animate-pulse"></i> Generating lyric scorecard analysis...</span>`;
                            }
                        }
                        const chatHistory = document.getElementById('studio-chat-history');
                        if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
                    }
                });

                studioConversationHistory.push({ role: "assistant", content: responseText });

                const edit = parseEditLyrics(responseText);
                if (edit) {
                    applyLyricsEdit(edit);
                }

                const critiqueData = parseCritiqueData(responseText);
                if (critiqueData) {
                    renderCritiqueDashboard(critiqueData);
                    if (isCritiqueMode === false && wantsCritique) {
                        toggleAssistantMode('critique');
                    }
                }

                const settings = parseUpdateSettings(responseText);
                if (settings) {
                    applySettingsUpdate(settings);
                }
            } else {
                bubbleBody.innerHTML = "Gnosys LLM Engine is currently loading or unavailable on this device tab.";
            }
        } catch (err) {
            bubbleBody.innerHTML = `Error generating response: ${err.message}`;
        } finally {
            isChatResponding = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
            }
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
            if (val !== 'custom') {
                selectPlaylist.value = val;
            }
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
        if (statusTextVal !== 'Running' && statusTextVal !== 'Lazy Ready') {
            if (statusTextVal.startsWith('Starting') || statusTextVal === 'Loading Weights') {
                pendingGeneration = true;
                btn.disabled = true;
                progressContainer.classList.remove('hidden');
                fill.style.width = '10%';
                percent.textContent = '10%';
                statusText.textContent = 'Queued: Waiting for ACE-Step API Server weights to finish loading...';
                showBannerNotification('Generation queued. It will run automatically once the server is ready.', 'info');
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
        
        fill.style.width = '5%';
        percent.textContent = '5%';
        
        if (statusTextVal === 'Lazy Ready') {
            statusText.textContent = 'Mounting Neural Weights (takes 1-2 mins on first run)...';
            // Force status badge update to show loading status
            const badge = document.getElementById('comfy-status-badge');
            if (badge) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider badge-pulse-amber';
                badge.textContent = 'Loading Weights';
            }
            // Allow UI to draw status update
            await new Promise(resolve => setTimeout(resolve, 800));
        } else {
            statusText.textContent = 'Optimizing VRAM & unloading idle AI models...';
        }

        if (window.GnosysLLM && typeof window.GnosysLLM.unload === 'function') {
            try {
                await window.GnosysLLM.unload();
            } catch (unloadErr) {
                console.warn('[Music Studio] VRAM optimization warning:', unloadErr);
            }
        }

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
        const stepsElement = document.getElementById('music-steps');
        const stepsVal = stepsElement ? stepsElement.value : (modelVal.includes('turbo') ? '8' : '50');
        const vocalsVal = document.getElementById('music-vocals').value;
        const lyricsVal = document.getElementById('generated-lyrics').value || "";

        // Collect new advanced parameters
        const thinkingVal = document.getElementById('music-thinking').checked;
        const formatVal = document.getElementById('music-format').checked;
        const keyVal = document.getElementById('music-key').value;
        const sigVal = document.getElementById('music-signature').value;
        const seedInputVal = document.getElementById('music-seed').value.trim();
        const lmCfgVal = parseFloat(document.getElementById('music-lm-cfg').value);
        const guidanceScaleElement = document.getElementById('music-guidance-scale');
        const guidanceScaleVal = guidanceScaleElement ? parseFloat(guidanceScaleElement.value) : (modelVal.includes('turbo') ? 1.0 : 7.0);
        const vocalLangElement = document.getElementById('music-vocal-lang');
        const vocalLangVal = vocalLangElement ? vocalLangElement.value : 'unknown';

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
                time_signature: sigVal || null,
                vocal_language: vocalLangVal || 'unknown'
            },
            inference_steps: parseInt(stepsVal),
            thinking: thinkingVal,
            use_format: formatVal,
            lm_cfg_scale: lmCfgVal,
            guidance_scale: guidanceScaleVal,
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
