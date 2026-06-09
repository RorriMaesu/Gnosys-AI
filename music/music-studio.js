(function() {
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://127.0.0.1:8020';
    let comfyPath = localStorage.getItem('gnosys_comfy_path') || 'D:\\ComfyUI';
    let vramProfile = localStorage.getItem('gnosys_music_vram_profile') || 'high';
    const clientId = Math.random().toString(36).substring(2, 15);
    let ws = null;
    let installPollInterval = null;

    let explorerCurrentPath = comfyPath;

    document.addEventListener('DOMContentLoaded', () => {
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

    function initUI() {
        document.getElementById('current-comfy-path').textContent = comfyPath;
        
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
        document.getElementById('btn-launch-service').addEventListener('click', async () => {
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
                const originalText = launchAssistantBtn.innerHTML;
                launchAssistantBtn.disabled = true;
                launchAssistantBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Launching...';

                const onboardingCard = document.getElementById('backend-onboarding-card');
                const titleEl = onboardingCard ? onboardingCard.querySelector('h2') : null;
                const descEl = onboardingCard ? onboardingCard.querySelector('p') : null;

                if (titleEl) titleEl.textContent = 'Starting Local Assistant Server...';
                if (descEl) descEl.innerHTML = 'Connecting to custom protocol <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">gnosys-assistant://</code>... Attempting connection (1/15)';

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

                // Poll for status to verify if it launched
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
                            launchAssistantBtn.disabled = false;
                            launchAssistantBtn.innerHTML = originalText;
                            if (titleEl) titleEl.textContent = 'Local Assistant Server is Offline';
                            checkMusicServiceStatus();
                        }
                    } catch (e) {}
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        launchAssistantBtn.disabled = false;
                        launchAssistantBtn.innerHTML = originalText;
                        if (titleEl) titleEl.textContent = 'Local Assistant Server is Offline';
                        if (descEl) descEl.innerHTML = 'Because this application is hosted statically, browsers cannot launch local programs automatically. Please open your installation folder and run <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">run_backend.bat</code> (Windows) or <code class="font-mono text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded">run_backend.sh</code> (Mac/Linux) to start the local helper.';
                        
                        // Automatically pop up the setup wizard guide modal
                        const setupModal = document.getElementById('assistant-setup-modal');
                        if (setupModal) {
                            setupModal.classList.remove('hidden');
                            setupModal.classList.add('flex');
                        }
                        showBannerNotification('Connection attempt timed out. Opening assistant setup guide...', 'warning');
                    }
                }, 1500);
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
    }

    async function checkMusicServiceStatus() {
        const badge = document.getElementById('comfy-status-badge');
        const icon = document.getElementById('comfy-status-icon');
        const launchBtn = document.getElementById('btn-launch-service');
        const installBtn = document.getElementById('btn-install-wizard');

        try {
            const res = await fetch(`${API_BASE}/api/music/status`, {
                headers: { 'X-ComfyUI-Path': comfyPath }
            });
            if (!res.ok) throw new Error();
            const data = await res.json();

            // Hide onboarding warning if port 8020 responds
            const onboardingCard = document.getElementById('backend-onboarding-card');
            if (onboardingCard) onboardingCard.classList.add('hidden');

            // Render diagnostic indicators if path exists
            const diagBox = document.getElementById('comfy-diagnostics-box');
            if (diagBox) {
                diagBox.innerHTML = '';
                if (data.diagnostics) {
                    const makeBadge = (label, status, url) => {
                        const baseClass = "text-[9px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 shrink-0 transition-all text-decoration-none";
                        const themeClass = status 
                            ? "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20 cursor-pointer" 
                            : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 cursor-pointer animate-pulse";
                        const iconHtml = status 
                            ? '<i class="fa-solid fa-circle-check"></i>' 
                            : '<i class="fa-solid fa-download"></i>';
                        const tooltip = status ? 'Installed and verified.' : 'Missing. Click to download from Hugging Face.';
                        return `<a href="${url}" target="_blank" class="${baseClass} ${themeClass}" title="${tooltip}">${iconHtml}${label}</a>`;
                    };
                    diagBox.innerHTML += makeBadge("XL SFT", data.diagnostics.xl_sft, "https://huggingface.co/ACE-Step/acestep-v15-xl-sft");
                    diagBox.innerHTML += makeBadge("XL Base", data.diagnostics.xl_base, "https://huggingface.co/ACE-Step/acestep-v15-xl-base");
                    diagBox.innerHTML += makeBadge("XL Turbo", data.diagnostics.xl_turbo, "https://huggingface.co/ACE-Step/acestep-v15-xl-turbo");
                    diagBox.innerHTML += makeBadge("Vocoder", data.diagnostics.vocoder, "https://huggingface.co/Comfy-Org/ACE-Step_ComfyUI_repackaged/tree/main");
                    diagBox.innerHTML += makeBadge("DCAE Encoder", data.diagnostics.dcae, "https://huggingface.co/Comfy-Org/ACE-Step_ComfyUI_repackaged/tree/main");
                    diagBox.innerHTML += makeBadge("UMT5 Text", data.diagnostics.umt5, "https://huggingface.co/Comfy-Org/ACE-Step_ComfyUI_repackaged/tree/main");
                }
            }

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

            // Show onboarding warning if connection failed
            const onboardingCard = document.getElementById('backend-onboarding-card');
            if (onboardingCard) onboardingCard.classList.remove('hidden');
        }
    }

    async function fetchModelsList() {
        const select = document.getElementById('music-model');
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
                    if (launchBtn) {
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<i class="fa-solid fa-rocket mr-1.5"></i> Launch Service';
                    }
                    showBannerNotification('ACE-Step API Server connected successfully!', 'success');
                    checkMusicServiceStatus();
                }
            } catch (e) {
                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (launchBtn) {
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<i class="fa-solid fa-rocket mr-1.5"></i> Launch Service';
                    }
                    showBannerNotification('ACE-Step API Server launch timed out. Please check if it is running.', 'error');
                    checkMusicServiceStatus();
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
        const statusTextVal = document.getElementById('comfy-status-badge').textContent.trim();
        if (statusTextVal !== 'Running') {
            if (statusTextVal.startsWith('Starting')) {
                showBannerNotification('ACE-Step API Server is still loading model weights in the background. Please wait for the service to finish starting up.', 'info');
            } else if (statusTextVal === 'Not Found') {
                showBannerNotification('ACE-Step service not found. Please run the install wizard to set it up.', 'error');
            } else {
                showBannerNotification('Local ACE-Step API Server is offline. Please launch the service first.', 'error');
            }
            return;
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

    function showBannerNotification(msg, variant = 'success') {
        if (window.GnosysLLM && typeof window.GnosysLLM.showTransientToast === 'function') {
            window.GnosysLLM.showTransientToast(msg, variant);
        } else {
            alert(msg);
        }
    }
})();
