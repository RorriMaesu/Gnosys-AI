(function() {
    let comfyPath = localStorage.getItem('gnosys_comfy_path') || 'D:\\ComfyUI';
    const clientId = Math.random().toString(36).substring(2, 15);
    let ws = null;
    let installPollInterval = null;

    document.addEventListener('DOMContentLoaded', () => {
        initUI();
        checkMusicServiceStatus();
    });

    function initUI() {
        document.getElementById('current-comfy-path').textContent = comfyPath;
        document.getElementById('input-comfy-path').value = comfyPath;
        document.getElementById('install-dir-input').value = comfyPath;

        // Path modal controls
        document.getElementById('btn-configure-path').addEventListener('click', () => {
            document.getElementById('path-modal').classList.remove('hidden');
            document.getElementById('path-modal').classList.add('flex');
        });
        document.getElementById('btn-close-path-modal').addEventListener('click', () => {
            document.getElementById('path-modal').classList.add('hidden');
            document.getElementById('path-modal').classList.remove('flex');
        });
        document.getElementById('btn-save-path').addEventListener('click', () => {
            const newPath = document.getElementById('input-comfy-path').value.trim();
            if (newPath) {
                comfyPath = newPath;
                localStorage.setItem('gnosys_comfy_path', comfyPath);
                document.getElementById('current-comfy-path').textContent = comfyPath;
                document.getElementById('install-dir-input').value = comfyPath;
                document.getElementById('path-modal').classList.add('hidden');
                document.getElementById('path-modal').classList.remove('flex');
                checkMusicServiceStatus();
            }
        });

        // Launch service click
        document.getElementById('btn-launch-service').addEventListener('click', async () => {
            try {
                const res = await fetch('/api/music/launch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comfy_path: comfyPath })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    showBannerNotification('Starting ComfyUI background service...', 'success');
                    pollComfyStartup();
                } else {
                    showBannerNotification('Failed to launch: ' + data.message, 'error');
                }
            } catch (err) {
                showBannerNotification('Error launching ComfyUI service: ' + err.message, 'error');
            }
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
                const res = await fetch('/api/music/install', {
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
    }

    async function checkMusicServiceStatus() {
        const badge = document.getElementById('comfy-status-badge');
        const icon = document.getElementById('comfy-status-icon');
        const launchBtn = document.getElementById('btn-launch-service');
        const installBtn = document.getElementById('btn-install-wizard');

        try {
            const res = await fetch('/api/music/status', {
                headers: { 'X-ComfyUI-Path': comfyPath }
            });
            if (!res.ok) throw new Error();
            const data = await res.json();

            if (data.comfy_running) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase font-extrabold tracking-wider';
                badge.textContent = 'Running';
                icon.innerHTML = '<i class="fa-solid fa-circle-check text-teal-400"></i>';
                launchBtn.classList.add('hidden');
                installBtn.classList.add('hidden');
                
                // Fetch models dynamically from local API server
                fetchModelsList();
            } else if (data.comfy_installed) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-extrabold tracking-wider';
                badge.textContent = 'Offline';
                icon.innerHTML = '<i class="fa-solid fa-server text-amber-400"></i>';
                launchBtn.classList.remove('hidden');
                installBtn.classList.add('hidden');
            } else {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 uppercase font-extrabold tracking-wider';
                badge.textContent = 'Not Found';
                icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>';
                launchBtn.classList.add('hidden');
                installBtn.classList.remove('hidden');
            }
        } catch (err) {
            badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-white/5 uppercase font-extrabold tracking-wider';
            badge.textContent = 'Unknown';
            icon.innerHTML = '<i class="fa-solid fa-server text-slate-400"></i>';
            launchBtn.classList.add('hidden');
            installBtn.classList.remove('hidden');
        }
    }

    async function fetchModelsList() {
        const select = document.getElementById('music-model');
        try {
            const res = await fetch('http://localhost:8002/v1/models', { signal: AbortSignal.timeout(2000) });
            if (res.ok) {
                const data = await res.json();
                if (data && data.data && data.data.length > 0) {
                    select.innerHTML = '';
                    data.data.forEach(model => {
                        const opt = document.createElement('option');
                        opt.value = model.id;
                        opt.textContent = `${model.id} (${model.name || 'ACE-Step'})`;
                        select.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.log('Failed to fetch models list, using static options:', e);
        }
    }

    function pollComfyStartup() {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch('http://localhost:8002/health', { signal: AbortSignal.timeout(1000) });
                if (res.ok) {
                    clearInterval(interval);
                    showBannerNotification('ACE-Step API Server connected successfully!', 'success');
                    checkMusicServiceStatus();
                }
            } catch (e) {
                if (attempts >= 20) {
                    clearInterval(interval);
                    showBannerNotification('ACE-Step API Server launch timed out. Please check if it is running.', 'error');
                }
            }
        }, 2000);
    }

    function startInstallPolling() {
        const stepText = document.getElementById('install-step-text');
        const percentText = document.getElementById('install-percent');
        const fill = document.getElementById('install-progress-bar-fill');

        if (installPollInterval) clearInterval(installPollInterval);
        
        installPollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/music/install-status');
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

        let subjectName = '';
        if (subjectSelector === 'custom') {
            subjectName = customSubjectVal || 'a custom academic study subject';
        } else {
            subjectName = document.getElementById('subject-selector').options[document.getElementById('subject-selector').selectedIndex].text;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Brainstorming lyric lines...';
        generatedLyricsTextarea.value = '';

        const systemPrompt = `You are a creative, expert educational songwriter for Gnosys AI.
Your objective is to brainstorm catchy, mnemonically dense, and rhythmically aligned study lyrics to help a student master a specific field of study.
The user wants to generate song lyrics about: "${subjectName}".
Keep the lines rhyming, easy to read/sing, and packed with actual educational keywords, facts, and definitions.
Separate verses and chorus clearly using [Verse 1], [Chorus], etc.`;

        const userPrompt = lyricsPromptVal || `Generate educational study lyrics for a song about ${subjectName}.`;

        try {
            if (window.GnosysLLM) {
                await window.GnosysLLM.generateResponse(systemPrompt, userPrompt, {
                    stream: true,
                    onToken: (token, fullText) => {
                        generatedLyricsTextarea.value = fullText;
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
        }
    }

    function loadAudioToPlayer(url) {
        const container = document.getElementById('player-container');
        const audio = document.getElementById('audio-player');
        const downloadBtn = document.getElementById('btn-download-audio');
        const prompt = document.getElementById('music-prompt').value;
        const bpm = document.getElementById('music-bpm').value;

        audio.src = url;
        downloadBtn.href = url;
        document.getElementById('player-track-info').textContent = `${bpm} BPM • ${prompt}`;
        
        container.classList.remove('hidden');
        document.getElementById('generation-progress-container').classList.add('hidden');
        
        showBannerNotification('Track successfully loaded!', 'success');
    }

    async function generateStudyTrack() {
        const btn = document.getElementById('btn-generate-track');
        const progressContainer = document.getElementById('generation-progress-container');
        const statusText = document.getElementById('gen-status-text');
        const fill = document.getElementById('gen-progress-bar-fill');
        const percent = document.getElementById('gen-percent');

        // Check if server is online
        const isOnline = document.getElementById('comfy-status-badge').textContent === 'Running';
        if (!isOnline) {
            showBannerNotification('Local ACE-Step API Server is offline. Please launch the service first.', 'error');
            return;
        }

        btn.disabled = true;
        progressContainer.classList.remove('hidden');
        statusText.textContent = 'Generating study music... (Running inference)';
        fill.style.width = '20%';
        percent.textContent = '20%';

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
            const res = await fetch('/api/music/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            fill.style.width = '70%';
            percent.textContent = '70%';

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
            statusText.textContent = 'Generation failed: ' + err.message;
            showBannerNotification('Generation failed.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    function showBannerNotification(msg, variant = 'success') {
        if (window.GnosysLLM && typeof window.GnosysLLM.showTransientToast === 'function') {
            window.GnosysLLM.showTransientToast(msg, variant);
        } else {
            alert(msg);
        }
    }
})();
