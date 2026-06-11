/* Gnosys-AI Ollama Auto-Launcher & Connection Orchestrator */

(function () {
    const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
    const LITERT_SETUP_STATUS_EVENT = 'gnosys-litert-setup-status';
    let launchModal = null;
    let pollInterval = null;
    let launcherApiStatus = 'unknown';

    function normalizeUrlBase(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    }

    function getConfiguredLauncherApiBase() {
        return normalizeUrlBase(
            localStorage.getItem('gnosys_launcher_api_base') ||
            localStorage.getItem('gnosys_server_origin') ||
            ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'http://127.0.0.1:8020')
        );
    }

    function getLauncherApiBase() {
        if (launcherApiStatus === 'unavailable') {
            return null;
        }

        const configuredBase = getConfiguredLauncherApiBase();
        if (!configuredBase) {
            launcherApiStatus = 'unavailable';
            return null;
        }

        return configuredBase;
    }

    function markLauncherApiAvailable() {
        launcherApiStatus = 'available';
    }

    function markLauncherApiUnavailable() {
        launcherApiStatus = 'unavailable';
    }

    function shouldUseLauncherApi() {
        const launcherApiBase = getLauncherApiBase();
        return Boolean(launcherApiBase);
    }

    function handleLauncherApiFailure(status) {
        if (status === 404 || status === 0) {
            markLauncherApiUnavailable();
            return;
        }

        if (typeof status === 'number') {
            console.warn('[Launcher] Sidecar API unavailable:', status);
        }
    }

    // Premium styling injection for the launcher UI
    function injectStyles() {
        if (document.getElementById('gnosys-launcher-styles')) return;

        const style = document.createElement('style');
        style.id = 'gnosys-launcher-styles';
        style.textContent = `
            .gnosys-launcher-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 17, 26, 0.7);
                backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            .gnosys-launcher-card {
                background: #1e2230;
                border: 1px solid #363d57;
                border-radius: 24px;
                padding: 32px;
                max-width: 420px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                color: #e2e8f0;
                transform: scale(0.9);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .gnosys-launcher-overlay.active {
                opacity: 1;
            }
            .gnosys-launcher-overlay.active .gnosys-launcher-card {
                transform: scale(1);
            }
            .gnosys-loader-ring {
                position: relative;
                width: 80px;
                height: 80px;
                margin: 0 auto 20px;
            }
            .gnosys-loader-ring div {
                box-sizing: border-box;
                display: block;
                position: absolute;
                width: 64px;
                height: 64px;
                margin: 8px;
                border: 6px solid #f59e0b;
                border-radius: 50%;
                animation: gnosys-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
                border-color: #f59e0b transparent transparent transparent;
            }
            .gnosys-loader-ring div:nth-child(1) { animation-delay: -0.45s; }
            .gnosys-loader-ring div:nth-child(2) { animation-delay: -0.3s; }
            .gnosys-loader-ring div:nth-child(3) { animation-delay: -0.15s; }
            @keyframes gnosys-ring {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .gnosys-glow-beaker {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 24px;
                color: #10b981;
                animation: gnosys-pulse 2s ease-in-out infinite;
            }
            @keyframes gnosys-pulse {
                0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(0.95); }
                50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); text-shadow: 0 0 10px #10b981; }
            }
            .gnosys-step-list {
                margin: 20px 0;
                text-align: left;
                background: #13151f;
                padding: 16px;
                border-radius: 16px;
                border: 1px solid #232738;
            }
            .gnosys-step {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 13px;
                margin-bottom: 8px;
                color: #94a3b8;
            }
            .gnosys-step:last-child { margin-bottom: 0; }
            .gnosys-step.active { color: #f59e0b; font-weight: bold; }
            .gnosys-step.done { color: #10b981; }
            .gnosys-step.failed { color: #ef4444; }
            .gnosys-step-icon {
                width: 16px;
                height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }
            .gnosys-btn-primary {
                width: 100%;
                padding: 12px;
                border-radius: 14px;
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: #fff;
                border: none;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
                transition: transform 0.2s, opacity 0.2s;
            }
            .gnosys-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(245, 158, 11, 0.3);
            }
            .gnosys-btn-primary:active {
                transform: translateY(1px);
            }
            .gnosys-btn-secondary {
                width: 100%;
                padding: 12px;
                border-radius: 14px;
                background: #2b3044;
                color: #94a3b8;
                border: 1px solid #3d435e;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: background-color 0.2s;
                margin-top: 10px;
            }
            .gnosys-btn-secondary:hover {
                background-color: #333950;
                color: #cbd5e1;
            }
        `;
        document.head.appendChild(style);
    }

    async function checkOllamaTags(url) {
        try {
            const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) });
            return res.ok;
        } catch (_err) {
            return false;
        }
    }

    async function checkModelLoaded(url, modelName) {
        if (!modelName) return true;
        try {
            const res = await fetch(`${url}/api/ps`, { signal: AbortSignal.timeout(1500) });
            if (!res.ok) return false;
            const data = await res.json();
            if (!Array.isArray(data?.models)) return false;
            
            const target = modelName.toLowerCase();
            return data.models.some(m => {
                const name = (m.name || '').toLowerCase();
                const model = (m.model || '').toLowerCase();
                return name === target || model === target || name.startsWith(target) || target.startsWith(name);
            });
        } catch (_err) {
            return false;
        }
    }

    async function preloadModel(url, modelName, signal) {
        try {
            const res = await fetch(`${url}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName }),
                signal
            });
            return res.ok;
        } catch (_err) {
            return false;
        }
    }

    async function checkModelInstalled(url, modelName) {
        if (!modelName) return true;
        try {
            const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) });
            if (!res.ok) return false;
            const data = await res.json();
            if (!Array.isArray(data?.models)) return false;
            
            const target = modelName.toLowerCase();
            return data.models.some(m => {
                const name = (m.name || '').toLowerCase();
                if (name === target) return true;
                if (!target.includes(':') && name === `${target}:latest`) return true;
                if (!name.includes(':') && target === `${name}:latest`) return true;
                return false;
            });
        } catch (_err) {
            return false;
        }
    }

    async function pullModel(url, modelName, onProgress, signal) {
        const res = await fetch(`${url}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, stream: true }),
            signal
        });
        if (!res.ok) {
            throw new Error(`Ollama API returned HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const data = JSON.parse(line);
                    let percent = 0;
                    if (data.total && data.completed) {
                        percent = (data.completed / data.total) * 100;
                    }
                    onProgress({
                        status: data.status,
                        percent: percent
                    });
                    if (data.status === 'success') {
                        return true;
                    }
                } catch (e) {
                    console.warn('[Launcher] Parse error in pull stream line:', e);
                }
            }
        }
        if (buffer.trim()) {
            try {
                const data = JSON.parse(buffer);
                if (data.status === 'success') return true;
            } catch (e) {}
        }
        return true;
    }

    function showDownloadRequiredUI(card, url, modelName, controller, resolve, reject) {
        card.innerHTML = `
            <div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-2xl mx-auto mb-4">
                <i class="fa-solid fa-download animate-bounce"></i>
            </div>
            <h3 class="text-lg font-extrabold text-white mb-2">Download Required</h3>
            <p class="text-xs text-slate-400 mb-5 leading-relaxed">
                The model <strong class="text-white">${modelName}</strong> is not installed on your system. Pull it from the Ollama library to start?
            </p>
            <button id="gnosys-download-btn" class="gnosys-btn-primary mb-2">Download Model</button>
            <button id="gnosys-download-cancel-btn" class="gnosys-btn-secondary">Cancel</button>
        `;

        document.getElementById('gnosys-download-btn').addEventListener('click', () => {
            showDownloadProgressUI(card, url, modelName, controller, resolve, reject);
        });

        document.getElementById('gnosys-download-cancel-btn').addEventListener('click', () => {
            controller.abort();
            window.closeOllamaLauncherUI();
            reject(new Error('Download cancelled by user.'));
        });
    }

    function showDownloadProgressUI(card, url, modelName, controller, resolve, reject) {
        card.innerHTML = `
            <div class="gnosys-loader-ring">
                <div></div><div></div><div></div><div></div>
                <i class="fa-solid fa-cloud-arrow-down gnosys-glow-beaker"></i>
            </div>
            <h3 class="text-lg font-extrabold text-white mb-1">Downloading Model</h3>
            <p class="text-xs text-slate-400 mb-4 leading-relaxed">Pulling <strong class="text-white">${modelName}</strong> from Ollama...</p>
            
            <div class="w-full bg-slate-800 rounded-full h-2.5 mb-2 overflow-hidden border border-slate-700">
                <div id="gnosys-download-progress-bar" class="bg-amber-500 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
            <div class="flex justify-between items-center text-[11px] text-slate-400 mb-5">
                <span id="gnosys-download-status">Initializing...</span>
                <span id="gnosys-download-percent">0%</span>
            </div>
            
            <button id="gnosys-download-cancel-btn" class="gnosys-btn-secondary">Cancel</button>
        `;

        const progressBar = document.getElementById('gnosys-download-progress-bar');
        const statusText = document.getElementById('gnosys-download-status');
        const percentText = document.getElementById('gnosys-download-percent');

        document.getElementById('gnosys-download-cancel-btn').addEventListener('click', () => {
            controller.abort();
            window.closeOllamaLauncherUI();
            reject(new Error('Download cancelled by user.'));
        });

        pullModel(url, modelName, (progress) => {
            if (progress.status) {
                statusText.textContent = progress.status;
            }
            if (progress.percent !== undefined) {
                const rounded = Math.round(progress.percent);
                progressBar.style.width = `${rounded}%`;
                percentText.textContent = `${rounded}%`;
            }
        }, controller.signal)
        .then(async (success) => {
            if (success) {
                statusText.textContent = 'Loading into VRAM...';
                progressBar.style.width = '100%';
                percentText.textContent = '100%';
                
                const preloadSuccess = await preloadModel(url, modelName, controller.signal);
                if (preloadSuccess) {
                    if (modelName) {
                        window.gnosysActiveModelsCache[modelName] = Date.now();
                    }
                    statusText.textContent = 'Ready!';
                    setTimeout(() => {
                        window.closeOllamaLauncherUI();
                        resolve(true);
                    }, 800);
                } else {
                    setTimeout(() => {
                        window.closeOllamaLauncherUI();
                        resolve(true);
                    }, 1000);
                }
            } else {
                showDownloadErrorUI(card, 'Download failed or response was invalid.', url, modelName, controller, resolve, reject);
            }
        })
        .catch(err => {
            if (err.name === 'AbortError') return;
            showDownloadErrorUI(card, err.message || 'Error occurred during download.', url, modelName, controller, resolve, reject);
        });
    }

    function showDownloadErrorUI(card, errMsg, url, modelName, controller, resolve, reject) {
        card.innerHTML = `
            <div class="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center text-2xl mx-auto mb-4">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 class="text-lg font-extrabold text-white mb-2">Download Failed</h3>
            <p class="text-xs text-slate-400 mb-5 leading-relaxed">
                We encountered an error while pulling <strong class="text-white">${modelName}</strong>:
            </p>
            <div class="bg-black/40 text-left font-mono text-[11px] p-3 rounded-xl border border-slate-700/60 mb-5 text-red-400 select-all cursor-pointer">
                ${errMsg}
            </div>
            <button id="gnosys-download-retry-btn" class="gnosys-btn-primary mb-2">Retry Download</button>
            <button id="gnosys-download-fail-cancel-btn" class="gnosys-btn-secondary">Cancel</button>
        `;

        document.getElementById('gnosys-download-retry-btn').addEventListener('click', () => {
            const newController = new AbortController();
            showDownloadProgressUI(card, url, modelName, newController, resolve, reject);
        });

        document.getElementById('gnosys-download-fail-cancel-btn').addEventListener('click', () => {
            controller.abort();
            window.closeOllamaLauncherUI();
            reject(new Error('Download failed: ' + errMsg));
        });
    }


    async function triggerOSProtocolLaunch() {
        console.log('[Launcher] Triggering gnosys-ollama:// OS protocol handler...');
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = 'gnosys-ollama://launch';
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 1000);
    }

    async function triggerLocalServerLaunch() {
        console.log('[Launcher] Contacting server sidecar for automatic Ollama start...');
        if (!shouldUseLauncherApi()) {
            return false;
        }
        const launcherApiBase = getLauncherApiBase();
        try {
            const launchUrl = `${launcherApiBase}/api/launch-ollama`;
            const response = await fetch(launchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'launch' }),
                signal: AbortSignal.timeout(3000)
            });
            if (response.ok) {
                markLauncherApiAvailable();
                const data = await response.json();
                return data.status === 'success';
            }
            handleLauncherApiFailure(response.status);
        } catch (err) {
            markLauncherApiUnavailable();
            console.warn('[Launcher] Local server launch request failed:', err);
        }
        return false;
    }

    function createLoaderUI(onCancel) {
        injectStyles();
        
        launchModal = document.createElement('div');
        launchModal.className = 'gnosys-launcher-overlay';
        launchModal.innerHTML = `
            <div class="gnosys-launcher-card">
                <div class="gnosys-loader-ring">
                    <div></div><div></div><div></div><div></div>
                    <i class="fa-solid fa-flask-vial gnosys-glow-beaker"></i>
                </div>
                <h3 class="text-lg font-extrabold text-white mb-1">Activating AI Engine</h3>
                <p class="text-xs text-slate-400 mb-4 leading-relaxed">Starting your local Ollama connection to process tutor intelligence...</p>
                
                <div class="gnosys-step-list">
                    <div id="step-connect" class="gnosys-step active">
                        <span class="gnosys-step-icon" id="step-connect-icon"><i class="fa-solid fa-circle-notch fa-spin"></i></span>
                        Checking connection...
                    </div>
                    <div id="step-sidecar" class="gnosys-step">
                        <span class="gnosys-step-icon" id="step-sidecar-icon"><i class="fa-regular fa-circle"></i></span>
                        Triggering local launch helper...
                    </div>
                    <div id="step-protocol" class="gnosys-step">
                        <span class="gnosys-step-icon" id="step-protocol-icon"><i class="fa-regular fa-circle"></i></span>
                        Executing URL scheme launch...
                    </div>
                    <div id="step-waiting" class="gnosys-step">
                        <span class="gnosys-step-icon" id="step-waiting-icon"><i class="fa-regular fa-circle"></i></span>
                        Polling background instance... (Attempt 0/15)
                    </div>
                </div>
                
                <button id="gnosys-cancel-btn" class="gnosys-btn-secondary">Cancel</button>
            </div>
        `;
        document.body.appendChild(launchModal);
        
        // Force reflow for fade animation
        launchModal.getBoundingClientRect();
        launchModal.classList.add('active');

        document.getElementById('gnosys-cancel-btn').addEventListener('click', () => {
            if (onCancel) onCancel();
            window.closeOllamaLauncherUI();
        });
    }

    window.closeOllamaLauncherUI = function() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (launchModal) {
            launchModal.classList.remove('active');
            const modalCopy = launchModal;
            setTimeout(() => {
                if (modalCopy && modalCopy.parentNode) {
                    modalCopy.remove();
                }
            }, 400);
            launchModal = null;
        }
    };

    function updateStepUI(stepId, state, customText = null) {
        const step = document.getElementById(`step-${stepId}`);
        const icon = document.getElementById(`step-${stepId}-icon`);
        if (!step || !icon) return;

        step.className = `gnosys-step ${state}`;
        if (customText) {
            step.childNodes[2].textContent = ` ${customText}`;
        }

        if (state === 'done') {
            icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        } else if (state === 'active') {
            icon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        } else if (state === 'failed') {
            icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        } else {
            icon.innerHTML = '<i class="fa-regular fa-circle"></i>';
        }
    }

    function showTroubleshootingUI(onRetry, onCancel) {
        if (!launchModal) return;
        const card = launchModal.querySelector('.gnosys-launcher-card');
        if (!card) return;

        card.innerHTML = `
            <div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-2xl mx-auto mb-4 animate-bounce">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 class="text-lg font-extrabold text-white mb-2">Startup Required</h3>
            <p class="text-xs text-slate-400 mb-5 leading-relaxed">
                We couldn't reach Ollama automatically. Please open the **Ollama** app on your taskbar, or launch your system shell and run:
            </p>
            <div class="bg-black/40 text-left font-mono text-[11px] p-3 rounded-xl border border-slate-700/60 mb-5 text-amber-400 select-all cursor-pointer">
                ollama serve
            </div>
            <button id="gnosys-retry-btn" class="gnosys-btn-primary mb-2">I have started it, Retry</button>
            <button id="gnosys-fail-cancel-btn" class="gnosys-btn-secondary">Cancel</button>
        `;

        document.getElementById('gnosys-retry-btn').addEventListener('click', () => {
            card.remove();
            if (onRetry) onRetry();
        });

        document.getElementById('gnosys-fail-cancel-btn').addEventListener('click', () => {
            if (onCancel) onCancel();
            window.closeOllamaLauncherUI();
        });
    }

    // Main entry function
    window.ensureOllamaActive = function (customEndpoint = null, modelName = null) {
        const url = customEndpoint || OLLAMA_DEFAULT_URL;
        
        return new Promise(async (resolve, reject) => {
            // Check cache to avoid redundant connection/model checks during active chats
            if (!window.gnosysActiveModelsCache) {
                window.gnosysActiveModelsCache = {};
            }
            if (modelName) {
                const cachedTime = window.gnosysActiveModelsCache[modelName];
                const CACHE_DURATION = 4 * 60 * 1000; // 4 minutes
                if (cachedTime && (Date.now() - cachedTime < CACHE_DURATION)) {
                    resolve(true);
                    return;
                }
            }

            // 1. Rapid initial online check
            const online = await checkOllamaTags(url);
            if (online) {
                const installed = await checkModelInstalled(url, modelName);
                if (installed) {
                    const loaded = await checkModelLoaded(url, modelName);
                    if (loaded) {
                        if (modelName) {
                            window.gnosysActiveModelsCache[modelName] = Date.now();
                        }
                        resolve(true);
                        return;
                    }
                }
            }

            // 2. Setup loader UI
            let isCancelled = false;
            const controller = new AbortController();
            createLoaderUI(() => {
                isCancelled = true;
                controller.abort();
                reject(new Error('Connection check cancelled by user.'));
            });

            // Run state-machine sequences
            const executeLaunchFlow = async () => {
                if (isCancelled) return;

                const isOnline = await checkOllamaTags(url);
                if (isOnline) {
                    const isInstalled = await checkModelInstalled(url, modelName);
                    if (!isInstalled) {
                        const card = launchModal.querySelector('.gnosys-launcher-card');
                        if (card) {
                            showDownloadRequiredUI(card, url, modelName, controller, resolve, reject);
                        } else {
                            reject(new Error('Launcher UI card not found.'));
                        }
                        return;
                    }

                    // Ollama is online, and model is downloaded. Let's preload it.
                    document.getElementById('step-connect').style.display = 'none';
                    document.getElementById('step-sidecar').style.display = 'none';
                    document.getElementById('step-protocol').style.display = 'none';
                    
                    updateStepUI('waiting', 'active', `Loading model '${modelName}' into VRAM...`);
                    const preloadSuccess = await preloadModel(url, modelName, controller.signal);
                    if (isCancelled) return;
                    
                    if (preloadSuccess) {
                        if (modelName) {
                            window.gnosysActiveModelsCache[modelName] = Date.now();
                        }
                        updateStepUI('waiting', 'done', `Model '${modelName}' loaded!`);
                        setTimeout(() => {
                            window.closeOllamaLauncherUI();
                            resolve(true);
                        }, 800);
                    } else {
                        updateStepUI('waiting', 'failed', `Failed to load model '${modelName}'`);
                        setTimeout(() => {
                            window.closeOllamaLauncherUI();
                            resolve(true); // Resolve anyway to avoid hard-locking
                        }, 1500);
                    }
                    return;
                }

                // Step A: Check Connection (just confirmed offline)
                updateStepUI('connect', 'failed', 'Connection offline');

                // Step B: Trigger server-side sidecar
                updateStepUI('sidecar', 'active');
                const sidecarSuccess = await triggerLocalServerLaunch();
                if (isCancelled) return;
                
                if (sidecarSuccess) {
                    updateStepUI('sidecar', 'done', 'Launch API requested');
                } else {
                    updateStepUI('sidecar', 'failed', 'No launch sidecar active');
                }

                // Step C: Trigger client protocol scheme
                updateStepUI('protocol', 'active');
                await triggerOSProtocolLaunch();
                if (isCancelled) return;
                updateStepUI('protocol', 'done', 'URL scheme executed');

                // Step D: Start polling
                updateStepUI('waiting', 'active');
                let attempt = 0;
                const maxAttempts = 15;

                pollInterval = setInterval(async () => {
                    if (isCancelled) {
                        clearInterval(pollInterval);
                        return;
                    }

                    attempt++;
                    updateStepUI('waiting', 'active', `Polling background instance... (Attempt ${attempt}/${maxAttempts})`);

                    const isOnlinePoll = await checkOllamaTags(url);
                    if (isOnlinePoll) {
                        clearInterval(pollInterval);
                        
                        const isInstalled = await checkModelInstalled(url, modelName);
                        if (!isInstalled) {
                            const card = launchModal.querySelector('.gnosys-launcher-card');
                            if (card) {
                                showDownloadRequiredUI(card, url, modelName, controller, resolve, reject);
                            } else {
                                reject(new Error('Launcher UI card not found.'));
                            }
                            return;
                        }

                        if (modelName) {
                            const loaded = await checkModelLoaded(url, modelName);
                            if (loaded) {
                                window.gnosysActiveModelsCache[modelName] = Date.now();
                                updateStepUI('waiting', 'done', 'Connected and model loaded!');
                                setTimeout(() => {
                                    window.closeOllamaLauncherUI();
                                    resolve(true);
                                }, 500);
                            } else {
                                // Transition to preloading
                                document.getElementById('step-connect').style.display = 'none';
                                document.getElementById('step-sidecar').style.display = 'none';
                                document.getElementById('step-protocol').style.display = 'none';
                                
                                updateStepUI('waiting', 'active', `Loading model '${modelName}' into VRAM...`);
                                const preloadSuccess = await preloadModel(url, modelName, controller.signal);
                                if (isCancelled) return;
                                if (preloadSuccess) {
                                    window.gnosysActiveModelsCache[modelName] = Date.now();
                                    updateStepUI('waiting', 'done', `Model '${modelName}' loaded!`);
                                    setTimeout(() => {
                                        window.closeOllamaLauncherUI();
                                        resolve(true);
                                    }, 800);
                                } else {
                                    updateStepUI('waiting', 'failed', `Failed to load model '${modelName}'`);
                                    setTimeout(() => {
                                        window.closeOllamaLauncherUI();
                                        resolve(true);
                                    }, 1500);
                                }
                            }
                        } else {
                            updateStepUI('waiting', 'done', 'Connected!');
                            setTimeout(() => {
                                window.closeOllamaLauncherUI();
                                resolve(true);
                            }, 500);
                        }
                        return;
                    }

                    if (attempt >= maxAttempts) {
                        clearInterval(pollInterval);
                        updateStepUI('waiting', 'failed', 'Connection timeout');
                        setTimeout(() => {
                            showTroubleshootingUI(
                                () => {
                                    // Retry trigger
                                    resolve(window.ensureOllamaActive(url, modelName));
                                },
                                () => {
                                    // Cancel trigger
                                    reject(new Error('Failed to connect to Ollama after manual start.'));
                                }
                            );
                        }, 800);
                    }
                }, 1500);
            };

            // Delay flow slightly for transition rendering
            setTimeout(executeLaunchFlow, 200);
        });
    };

    const RECOMMENDED_MODELS = [
        { value: 'gemma4:e4b', label: 'Gemma 4 (e4b) - Default MTP', size_gb: 9.6 },
        { value: 'llama3.2', label: 'Llama 3.2 (3B) - Fast CPU Inference', size_gb: 2.0 },
        { value: 'qwen2.5', label: 'Qwen 2.5 (7B) - High Quality Coding/Logic', size_gb: 4.7 },
        { value: 'llama3', label: 'Llama 3 (8B) - Balanced', size_gb: 4.7 },
        { value: 'mistral', label: 'Mistral (7B) - General Purpose', size_gb: 4.1 },
        { value: 'phi3', label: 'Phi 3 (3.8B) - High Reasoning', size_gb: 2.2 }
    ];

    window.populateModelSelector = async function (selectEl, currentModel, cleanEndpoint, options = {}) {
        if (!selectEl) return false;

        const setActionStatus = (state, message) => {
            if (typeof options.onStatusChange === 'function') {
                options.onStatusChange({ state, message });
            }
        };
        
        selectEl.innerHTML = '';
        const tempOpt = document.createElement('option');
        tempOpt.value = currentModel;
        tempOpt.textContent = currentModel;
        tempOpt.selected = true;
        selectEl.appendChild(tempOpt);

        let installedModels = [];
        let ollamaOnline = false;
        try {
            const res = await fetch(`${cleanEndpoint}/api/tags`, { signal: AbortSignal.timeout(2000) });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data?.models)) {
                    installedModels = data.models.map(m => ({
                        name: m.name,
                        size: m.size
                    }));
                    ollamaOnline = true;
                }
            }
        } catch (e) {
            console.warn('[Launcher] Failed to fetch Ollama tags:', e);
        }

        // Fetch hardware info from the optional local launcher sidecar.
        let hwData = null;
        if (shouldUseLauncherApi()) {
            const launcherApiBase = getLauncherApiBase();
            try {
                const res = await fetch(`${launcherApiBase}/api/hardware-info`, { signal: AbortSignal.timeout(2000) });
                if (res.ok) {
                    markLauncherApiAvailable();
                    hwData = await res.json();
                } else {
                    handleLauncherApiFailure(res.status);
                }
                if (!res.ok && res.status !== 404) {
                    console.warn('[Launcher] Hardware info unavailable:', res.status, res.statusText);
                }
            } catch (e) {
                markLauncherApiUnavailable();
                console.warn('[Launcher] Failed to fetch hardware info:', e);
            }
        }

        selectEl.innerHTML = '';

        const recGroup = document.createElement('optgroup');
        recGroup.label = 'Recommended Models';

        const getInstalledInfo = (val) => {
            const target = val.toLowerCase();
            return installedModels.find(m => {
                const n = m.name.toLowerCase();
                if (n === target) return true;
                if (!target.includes(':') && n === `${target}:latest`) return true;
                if (!n.includes(':') && target === `${n}:latest`) return true;
                return false;
            });
        };
        const checkInstalled = (val) => !!getInstalledInfo(val);

        RECOMMENDED_MODELS.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value;
            
            const installedInfo = getInstalledInfo(m.value);
            let sizeText = `${m.size_gb} GB`;
            if (installedInfo && installedInfo.size) {
                sizeText = `${(installedInfo.size / (1024**3)).toFixed(1)} GB`;
            }
            
            // Format labels with hardware suggestions if available
            let statusText = '';
            if (hwData && hwData.classification) {
                const cap = hwData.classification[m.value];
                if (cap === 'recommended') {
                    statusText = '✓ Recommended';
                } else if (cap === 'supported') {
                    statusText = '⚠️ CPU Offload';
                } else if (cap === 'restricted') {
                    statusText = '🚫 Blocked (Low Memory)';
                    opt.disabled = true;
                }
            } else {
                statusText = installedInfo ? 'Installed' : 'Needs Download';
            }

            opt.textContent = `${m.label} (${sizeText}) (${statusText})`;
            opt.dataset.modelKind = 'ollama';
            opt.dataset.installed = installedInfo ? 'true' : 'false';
            opt.dataset.modelLabel = m.label;
            opt.dataset.modelSize = sizeText;
            if (m.value === currentModel) opt.selected = true;
            recGroup.appendChild(opt);
        });
        selectEl.appendChild(recGroup);

        const otherInstalled = installedModels.filter(m => {
            return !RECOMMENDED_MODELS.some(rec => {
                const target = rec.value.toLowerCase();
                const n = m.name.toLowerCase();
                return n === target || 
                       (!target.includes(':') && n === `${target}:latest`) || 
                       (!n.includes(':') && target === `${n}:latest`);
            });
        });

        if (otherInstalled.length > 0) {
            const otherGroup = document.createElement('optgroup');
            otherGroup.label = 'Other Installed Models';
            otherInstalled.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                const sizeText = m.size ? ` (${(m.size / (1024**3)).toFixed(1)} GB)` : '';
                opt.textContent = `${m.name}${sizeText}`;
                opt.dataset.modelKind = 'ollama';
                opt.dataset.installed = 'true';
                opt.dataset.modelLabel = m.name;
                opt.dataset.modelSize = sizeText.trim() || 'Installed';
                if (m.name === currentModel) opt.selected = true;
                otherGroup.appendChild(opt);
            });
            selectEl.appendChild(otherGroup);
        }

        // Add Browser-Native LiteRT Models
        const litertGroup = document.createElement('optgroup');
        litertGroup.label = 'Browser-Native (WebGPU Accelerated, No Setup)';
        
        const LITERT_TIERS = [
            { value: 'smollm-135m-ultra', label: 'SmolLM2 Ultra-Light (135M)', size: '250MB' },
            { value: 'gemma-4-e2b', label: 'Gemma 4 Efficient (2.5B)', size: '2.1GB' },
            { value: 'gemma-4-e4b', label: 'Gemma 4 Pro (4.5B)', size: '3.2GB' }
        ];

        LITERT_TIERS.forEach(t => {
            const opt = document.createElement('option');
            opt.value = `litert:${t.value}`;
            opt.textContent = `${t.label} (~${t.size})`;
            opt.dataset.modelKind = 'litert';
            opt.dataset.installed = 'false';
            opt.dataset.modelLabel = t.label;
            opt.dataset.modelSize = t.size;
            if (`litert:${t.value}` === currentModel) {
                opt.selected = true;
            }
            litertGroup.appendChild(opt);
        });
        selectEl.appendChild(litertGroup);

        const isCurrentInstalledOrRec = RECOMMENDED_MODELS.some(m => m.value === currentModel) || 
                                        checkInstalled(currentModel) || 
                                        currentModel.startsWith('litert:');
        if (!isCurrentInstalledOrRec && currentModel && currentModel !== '__custom__' && currentModel !== 'gemma4:e4b') {
            const unlistedGroup = document.createElement('optgroup');
            unlistedGroup.label = 'Currently Active Model';
            const opt = document.createElement('option');
            opt.value = currentModel;
            opt.textContent = `${currentModel} (unlisted)`;
            opt.dataset.modelKind = 'ollama';
            opt.dataset.installed = checkInstalled(currentModel) ? 'true' : 'false';
            opt.dataset.modelLabel = currentModel;
            opt.selected = true;
            unlistedGroup.appendChild(opt);
            selectEl.appendChild(unlistedGroup);
        }


        const divider = document.createElement('option');
        divider.disabled = true;
        divider.textContent = '────────────────────';
        selectEl.appendChild(divider);

        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = 'Custom Model (Write-in)...';
        selectEl.appendChild(customOpt);

        // Inject diagnostic view
        if (hwData && hwData.hardware) {
            let diagEl = selectEl.parentNode.querySelector('.gnosys-hardware-specs');
            if (!diagEl) {
                diagEl = document.createElement('div');
                diagEl.className = 'gnosys-hardware-specs text-[11px] mt-2 leading-relaxed text-slate-500 dark:text-slate-400';
                selectEl.parentNode.insertBefore(diagEl, selectEl.nextSibling);
            }
            
            let gpuText = 'No dedicated GPU detected (CPU mode)';
            if (hwData.hardware.gpus && hwData.hardware.gpus.length > 0) {
                gpuText = hwData.hardware.gpus.map(g => `${g.name} (${Math.round(g.vram_mb/1024)}GB VRAM)`).join(', ');
            } else if (hwData.hardware.is_mac_silicon) {
                gpuText = 'Apple Silicon Unified Memory';
            }
            
            // Build the card UI
            diagEl.innerHTML = `
                <div style="font-family: inherit; margin-top: 8px; padding: 12px; border-radius: 12px; background: rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.05); font-size: 11px;">
                    <div style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-microchip text-slate-400"></i>
                        <span><strong>GPU:</strong> ${gpuText}</span>
                    </div>
                    <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-memory text-slate-400"></i>
                        <span><strong>RAM:</strong> ${hwData.hardware.system_ram_gb} GB</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                        <span style="color: #f59e0b;"><strong>Recommended:</strong> ${hwData.recommended_model}</span>
                        <a href="#" id="gnosys-auto-configure-btn" style="margin-left: auto; text-decoration: underline; color: #10b981; font-weight: bold; cursor: pointer;">Auto-Configure</a>
                    </div>
                </div>
            `;

            const autoConfBtn = diagEl.querySelector('#gnosys-auto-configure-btn');
            if (autoConfBtn) {
                autoConfBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (selectEl.value !== hwData.recommended_model) {
                        selectEl.value = hwData.recommended_model;
                        selectEl.dispatchEvent(new Event('change'));
                    }
                });
            }
        }

        const handleSelectChange = async () => {
            const val = selectEl.value;
            if (!val) return;

            if (val === '__custom__') {
                const writeIn = prompt('Enter the custom Ollama model tag (e.g. deepseek-coder:6.7b):');
                if (writeIn && writeIn.trim()) {
                    const cleanedModel = writeIn.trim();
                    let customGrp = selectEl.querySelector('optgroup[label="Custom Write-in"]');
                    if (!customGrp) {
                        customGrp = document.createElement('optgroup');
                        customGrp.label = 'Custom Write-in';
                        selectEl.insertBefore(customGrp, divider);
                    }
                    customGrp.innerHTML = '';
                    const opt = document.createElement('option');
                    opt.value = cleanedModel;
                    opt.textContent = `${cleanedModel} (Custom)`;
                    opt.dataset.modelKind = 'ollama';
                    opt.dataset.installed = checkInstalled(cleanedModel) ? 'true' : 'false';
                    opt.dataset.modelLabel = cleanedModel;
                    opt.selected = true;
                    customGrp.appendChild(opt);
                    
                    selectEl.dispatchEvent(new Event('change'));
                } else {
                    selectEl.value = currentModel;
                }
                return;
            }

            const selectedOption = selectEl.options[selectEl.selectedIndex];
            const isLiteRt = val.startsWith('litert:') || selectedOption?.dataset?.modelKind === 'litert';
            const isInstalled = selectedOption?.dataset?.installed === 'true' || checkInstalled(val);
            const modelLabel = selectedOption?.dataset?.modelLabel || val;

            selectEl.disabled = true;
            try {
                if (isLiteRt) {
                    const modelId = val.substring(7);
                    localStorage.setItem('gnosys_llm_route_mode', 'mobile-ondevice');
                    localStorage.setItem('gnosys_ondevice_selected_model', modelId);
                    localStorage.setItem('gnosys_active_llm', val);
                    localStorage.setItem('chemistry_llm', val);
                    if (options.moduleKey) {
                        localStorage.setItem(options.moduleKey, val);
                    }

                    setActionStatus('working', `Opening Smart LLM Setup for ${modelLabel}...`);
                    await window.GnosysLLM?.init?.(true);
                    if (typeof window.GnosysLLM?.showMobileChoiceModal === 'function') {
                        window.GnosysLLM.showMobileChoiceModal();
                        setActionStatus('info', 'Smart LLM Setup opened. Choose where to save your LiteRT model file.');
                    } else {
                        setActionStatus('error', 'Unable to open Smart LLM Setup.');
                    }
                    return;
                }

                if (!isInstalled) {
                    setActionStatus('working', `Downloading ${modelLabel} via Ollama...`);
                    await window.ensureOllamaActive(cleanEndpoint, val);
                    setActionStatus('success', `${modelLabel} download complete. Model is ready.`);
                } else {
                    setActionStatus('working', `Switching to ${modelLabel}...`);
                }

                localStorage.setItem('gnosys_llm_route_mode', 'desktop-ollama');
                localStorage.setItem('gnosys_active_llm', val);
                localStorage.setItem('chemistry_llm', val);
                if (options.moduleKey) {
                    localStorage.setItem(options.moduleKey, val);
                }
                await window.GnosysLLM?.init?.(true);
                if (isInstalled) {
                    setActionStatus('success', `${modelLabel} is now active.`);
                }
            } catch (err) {
                console.error('[Launcher] Model selection action failed:', err);
                setActionStatus('error', err?.message || 'Failed to apply model selection.');
            } finally {
                selectEl.disabled = false;
            }
        };
        selectEl.removeEventListener('change', selectEl._gnosysCustomHandler);
        selectEl._gnosysCustomHandler = handleSelectChange;
        selectEl.addEventListener('change', handleSelectChange);

        return ollamaOnline;
    };

    window.getGnosysModel = function(moduleKey = null) {
        const routeMode = localStorage.getItem('gnosys_llm_route_mode');
        if (routeMode === 'mobile-ondevice') {
            const modelId = localStorage.getItem('gnosys_ondevice_selected_model') || 'gemma-4-e2b';
            return `litert:${modelId}`;
        }
        const shared = localStorage.getItem('gnosys_active_llm');
        if (shared) return shared;
        if (moduleKey) {
            const legacy = localStorage.getItem(moduleKey);
            if (legacy) return legacy;
        }
        return 'gemma4:e4b';
    };

    window.getActiveModel = function(moduleKey = null, fallbackModel = 'gemma4:e4b') {
        const routeMode = localStorage.getItem('gnosys_llm_route_mode');
        if (routeMode === 'mobile-ondevice') {
            return localStorage.getItem('gnosys_ondevice_selected_model') || 'gemma-4-e2b';
        }
        const shared = localStorage.getItem('gnosys_active_llm');
        if (shared && shared.trim()) return shared.trim();
        if (moduleKey) {
            const legacy = localStorage.getItem(moduleKey);
            if (legacy && legacy.trim()) return legacy.trim();
        }
        return fallbackModel;
    };

    window.formatModelLabel = function(modelTag) {
        const raw = String(modelTag || '').trim();
        if (!raw) return 'Local Model';
        if (raw.startsWith('litert:')) {
            const id = raw.substring(7);
            if (id === 'smollm-135m-ultra') return 'SmolLM2 135M';
            if (id === 'gemma-4-e2b') return 'Gemma 4 2.5B';
            if (id === 'gemma-4-e4b') return 'Gemma 4 4.5B';
            return id;
        }
        return raw.replace(/:latest$/i, '');
    };

    window.getActiveModelLabel = function(moduleKey = null, fallbackModel = 'gemma4:e4b') {
        return window.formatModelLabel(window.getActiveModel(moduleKey, fallbackModel));
    };

    window.openChemistrySettingsModal = function () {
        if (document.getElementById('chemistry-settings-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'chemistry-settings-overlay';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-8 transform scale-95 transition-transform duration-300" style="color: #1e293b;">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-sliders text-xl text-amber-500"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-extrabold text-gray-850 dark:text-slate-100">Chemistry Settings</h3>
                        <p class="text-sm text-gray-500 dark:text-slate-400 font-medium mt-0.5">Configure your AI Tutor & study preferences</p>
                    </div>
                </div>

                <!-- Model selection -->
                <div class="py-3 px-1 border-b border-gray-100 dark:border-slate-800 mb-5">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <p class="text-sm font-bold text-gray-700 dark:text-slate-200">AI Tutor Model</p>
                            <p class="text-xs text-gray-400 mt-0.5">Select a locally running LLM model</p>
                        </div>
                    </div>
                    <select id="chem-settings-model-select" class="w-full bg-gray-50 dark:bg-slate-850 border border-gray-250 dark:border-slate-700 text-gray-750 dark:text-slate-200 font-medium text-xs rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block px-3 py-2 cursor-pointer">
                        <option value="">Loading available models...</option>
                    </select>
                    <p id="chem-settings-model-offline-msg" class="hidden text-[10px] text-amber-500 mt-1.5 leading-snug">
                        <i class="fa-solid fa-circle-exclamation mr-1"></i> Ollama offline. Showing cached model only.
                    </p>
                    <p id="chem-settings-model-action-status" class="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
                        Ready to switch models or start download.
                    </p>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        LiteRT selections open Smart LLM Setup so you can choose where to save model files.
                    </p>
                </div>

                <!-- Explore mode toggle -->
                <div class="flex items-center justify-between py-3 px-1 border-b border-gray-100 dark:border-slate-800 mb-5">
                    <div>
                        <p class="text-sm font-bold text-gray-700 dark:text-slate-200">Explore Mode</p>
                        <p class="text-xs text-gray-400 mt-0.5">Bypass requirements to view all lessons</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="chem-settings-bypass-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                </div>

                <!-- Dark Mode toggle -->
                <div class="flex items-center justify-between py-3 px-1 border-b border-gray-100 dark:border-slate-800 mb-5">
                    <div>
                        <p class="text-sm font-bold text-gray-700 dark:text-slate-200">Dark Mode</p>
                        <p class="text-xs text-gray-400 mt-0.5">Switch between light and dark themes</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="chem-settings-theme-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                </div>

                <!-- Budget Phone Optimizations toggle -->
                <div class="flex items-center justify-between py-3 px-1 border-b border-gray-100 dark:border-slate-800 mb-5">
                    <div>
                        <p class="text-sm font-bold text-gray-700 dark:text-slate-200">Budget Phone Optimizations</p>
                        <p class="text-xs text-gray-400 mt-0.5">Aggressive memory clean-up for 4GB RAM devices</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="chem-settings-lowram-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                </div>

                <!-- Reset Progress action -->
                <div class="py-3 px-1 mb-6">
                    <button id="chem-settings-reset-btn" class="w-full flex items-center gap-4 p-4 rounded-2xl border border-rose-200 hover:bg-rose-50 dark:border-rose-950/20 dark:hover:bg-rose-950/10 transition-colors text-left group">
                        <i class="fa-solid fa-trash text-rose-500 text-xl shrink-0"></i>
                        <div>
                            <p class="font-bold text-gray-805 dark:text-slate-200 group-hover:text-rose-700 dark:group-hover:text-rose-400">Reset Chemistry Progress</p>
                            <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Erase all scores, streak achievements & coursework metrics</p>
                        </div>
                    </button>
                </div>

                <!-- Local app data purge action -->
                <div class="py-3 px-1 mb-6">
                    <button id="chem-settings-purge-btn" class="w-full flex items-center gap-4 p-4 rounded-2xl border border-orange-200 hover:bg-orange-50 dark:border-orange-950/20 dark:hover:bg-orange-950/10 transition-colors text-left group">
                        <i class="fa-solid fa-broom text-orange-500 text-xl shrink-0"></i>
                        <div>
                            <p class="font-bold text-gray-805 dark:text-slate-200 group-hover:text-orange-700 dark:group-hover:text-orange-400">Reset Local App Data</p>
                            <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Delete the on-device LiteRT model, cached download state, and local storage flags</p>
                        </div>
                    </button>
                </div>

                <button id="chem-settings-cancel" class="w-full py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:border-slate-800 border border-gray-200 transition-colors">Close</button>
            </div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.classList.add('opacity-100');
            overlay.firstElementChild.classList.remove('scale-95');
        }, 10);

        const selectEl = overlay.querySelector('#chem-settings-model-select');
        const bypassToggle = overlay.querySelector('#chem-settings-bypass-toggle');
        const themeToggle = overlay.querySelector('#chem-settings-theme-toggle');
        const lowramToggle = overlay.querySelector('#chem-settings-lowram-toggle');
        const resetBtn = overlay.querySelector('#chem-settings-reset-btn');
        const purgeBtn = overlay.querySelector('#chem-settings-purge-btn');
        const cancelBtn = overlay.querySelector('#chem-settings-cancel');
        const offlineMsg = overlay.querySelector('#chem-settings-model-offline-msg');
        const actionStatusEl = overlay.querySelector('#chem-settings-model-action-status');

        const setModelActionStatus = ({ state = 'idle', message = '' } = {}) => {
            if (!actionStatusEl) return;
            actionStatusEl.textContent = message || 'Ready to switch models or start download.';

            actionStatusEl.classList.remove('text-slate-500', 'dark:text-slate-400', 'text-amber-600', 'dark:text-amber-300', 'text-emerald-600', 'dark:text-emerald-300', 'text-rose-600', 'dark:text-rose-300');
            if (state === 'working') {
                actionStatusEl.classList.add('text-amber-600', 'dark:text-amber-300');
            } else if (state === 'success' || state === 'info') {
                actionStatusEl.classList.add('text-emerald-600', 'dark:text-emerald-300');
            } else if (state === 'error') {
                actionStatusEl.classList.add('text-rose-600', 'dark:text-rose-300');
            } else {
                actionStatusEl.classList.add('text-slate-500', 'dark:text-slate-400');
            }
        };

        const handleLiteRtSetupStatus = (event) => {
            const detail = event?.detail;
            if (!detail || typeof detail.message !== 'string') return;
            setModelActionStatus(detail);
        };

        window.addEventListener(LITERT_SETUP_STATUS_EVENT, handleLiteRtSetupStatus);

        const currentModel = window.getGnosysModel('chemistry_llm');
        const isBypass = localStorage.getItem('chemistry_curriculum_bypass') === 'true';
        bypassToggle.checked = isBypass;
        themeToggle.checked = document.documentElement.classList.contains('dark');
        if (lowramToggle) {
            lowramToggle.checked = localStorage.getItem('gnosys_lowram_optimizations') === 'true';
        }

        const endpoint = localStorage.getItem("chemistry_ollama_endpoint") || "http://localhost:11434";
        const cleanEndpoint = endpoint.replace('/api/chat', '').replace('/api/generate', '');
        
        window.populateModelSelector(selectEl, currentModel, cleanEndpoint, {
            onStatusChange: setModelActionStatus,
        }).then(online => {
            if (!online && offlineMsg) {
                offlineMsg.classList.remove('hidden');
            }
        });

        bypassToggle.addEventListener('change', () => {
            const enabled = bypassToggle.checked;
            localStorage.setItem('chemistry_curriculum_bypass', String(enabled));
            window.dispatchEvent(new CustomEvent('curriculumBypassChanged', { detail: { enabled } }));
        });

        themeToggle.addEventListener('change', () => {
            const isDark = themeToggle.checked;
            document.documentElement.classList.toggle('dark', isDark);
            localStorage.setItem('chemistry_darkmode', String(isDark));
            window.dispatchEvent(new CustomEvent('chemistry-theme-changed', { detail: { isDark } }));
        });

        if (lowramToggle) {
            lowramToggle.addEventListener('change', () => {
                const enabled = lowramToggle.checked;
                localStorage.setItem('gnosys_lowram_optimizations', String(enabled));
                console.log(`[Chemistry Settings] Budget Phone Optimizations toggled: ${enabled ? 'ENABLED' : 'DISABLED'}`);
            });
        }

        const closeModal = () => {
            window.removeEventListener(LITERT_SETUP_STATUS_EVENT, handleLiteRtSetupStatus);
            overlay.classList.remove('opacity-100');
            overlay.firstElementChild.classList.add('scale-95');
            setTimeout(() => overlay.remove(), 300);
        };

        resetBtn.addEventListener('click', () => {
            if (typeof window.confirmAndResetChemistryProgress === 'function') {
                closeModal();
                window.confirmAndResetChemistryProgress();
            } else {
                alert('Progress reset logic is unavailable on this page.');
            }
        });

        if (purgeBtn) {
            purgeBtn.addEventListener('click', async () => {
                const ok = window.confirm('This will delete the on-device LiteRT model and all local download state. Continue?');
                if (!ok) return;

                purgeBtn.setAttribute('disabled', 'true');
                purgeBtn.classList.add('opacity-70', 'cursor-wait');

                try {
                    await window.GnosysLLM?.purgeModelStorage?.();
                    closeModal();
                } catch (err) {
                    console.error('[Chemistry Settings] Local app data purge failed:', err);
                    alert('Reset failed. Please try again.');
                    purgeBtn.removeAttribute('disabled');
                    purgeBtn.classList.remove('opacity-70', 'cursor-wait');
                }
            });
        }

        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    };

})();
