(function () {
    const OLLAMA_BASE_URL = 'http://localhost:11434';
    const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;

    const MODEL_CACHE_NAME = 'gnosys-litert-model-cache-v1';

    const MODEL_TIERS = {
        'smollm-135m-ultra': {
            id: 'smollm-135m-ultra',
            name: 'SmolLM2 Ultra-Light (135M)',
            shortName: 'Ultra-Light',
            description: 'Ultra-lightweight 135M parameter model. Under 250MB size, runs flawlessly on 4GB RAM devices without crashing.',
            url: 'https://huggingface.co/litert-community/SmolLM2-135M-Instruct/resolve/main/SmolLM2_135M_Instruct.litertlm',
            filename: 'SmolLM2_135M_Instruct.litertlm',
            cacheVersion: 'smollm-135m-instruct-2026-05-31-r1',
            expectedSize: 135000000,
            ramRecommendation: '4GB RAM / Budget Devices',
            tokensLimit: 1024
        },
        'gemma-4-e2b': {
            id: 'gemma-4-e2b',
            name: 'Gemma 4 Efficient (2.5B)',
            shortName: 'Efficient',
            description: 'Highly optimized for budget and standard mobile devices. Rapid response speeds and ultra-light memory footprint.',
            url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm',
            filename: 'gemma-4-E2B-it-web.litertlm',
            cacheVersion: 'gemma-4-E2B-it-web-2026-05-30-r2',
            expectedSize: 2150000000,
            ramRecommendation: '4GB - 6GB+ RAM',
            tokensLimit: 1024
        },
        'gemma-4-e4b': {
            id: 'gemma-4-e4b',
            name: 'Gemma 4 Pro (4.5B)',
            shortName: 'Pro',
            description: 'Richer Socratic dialogue, advanced coding, and robust logic. Requires higher memory and processing power.',
            url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm',
            filename: 'gemma-4-E4B-it-web.litertlm',
            cacheVersion: 'gemma-4-E4B-it-web-2026-05-30-r2',
            expectedSize: 3190000000,
            ramRecommendation: '8GB+ RAM',
            tokensLimit: 2048
        }
    };

    let isDownloadInitializing = false;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let selectedLocalFile = null;

    function estimateTokens(text) {
        if (!text) return 0;
        // Conservative estimation: 1 token is around 3.5 characters in English
        return Math.ceil(text.length / 3.5);
    }

    const STORAGE_KEYS = {
        routeMode: 'gnosys_llm_route_mode',
        cloudApiKey: 'gnosys_cloud_api_key',
        onDeviceReady: 'gnosys_ondevice_model_ready',
        onDeviceDownloadInProgress: 'gnosys_ondevice_model_download_in_progress',
        onDeviceModelCacheVersion: 'gnosys_ondevice_model_cache_version',
        onDeviceModelFileVersion: 'gnosys_ondevice_model_file_version',
        onDeviceExpectedSize: 'gnosys_ondevice_model_expected_size',
        onDeviceSelectedModel: 'gnosys_ondevice_selected_model',
        onDeviceStorageMode: 'gnosys_ondevice_storage_mode',
        onDeviceLocalFileMetadata: 'gnosys_ondevice_local_file_metadata',
        lowRamOptimizations: 'gnosys_lowram_optimizations',
    };

    function openStorageDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('gnosys_model_store', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveFileHandle(key, handle) {
        const db = await openStorageDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            const store = tx.objectStore('handles');
            const request = store.put(handle, key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function getFileHandle(key) {
        try {
            const db = await openStorageDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readonly');
                const store = tx.objectStore('handles');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.warn('[GnosysLLM] IndexedDB read failed:', err);
            return null;
        }
    }

    async function removeFileHandle(key) {
        try {
            const db = await openStorageDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readwrite');
                const store = tx.objectStore('handles');
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.warn('[GnosysLLM] IndexedDB delete failed:', err);
        }
    }

    function getActiveModelConfig() {
        const ramGb = navigator.deviceMemory;
        const defaultModel = (ramGb && ramGb <= 4) ? 'smollm-135m-ultra' : 'gemma-4-e2b';
        const selectedId = localStorage.getItem(STORAGE_KEYS.onDeviceSelectedModel) || defaultModel;
        return MODEL_TIERS[selectedId] || MODEL_TIERS[defaultModel] || MODEL_TIERS['gemma-4-e2b'];
    }

    async function getClientHardwareInfo() {
        let ramGb = navigator.deviceMemory || 8.0;
        const cores = navigator.hardwareConcurrency || 4;
        let gpuName = 'Unknown/Generic GPU';
        let gpuVendor = 'unknown';
        let webGpuAvailable = Boolean(navigator.gpu);
        let vramGb = 0;

        // Try Python server first if we are on desktop
        if (!isMobileDevice) {
            try {
                const res = await fetch('/api/hardware-info', { signal: AbortSignal.timeout(1500) });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && data.hardware) {
                        ramGb = data.hardware.system_ram_gb || ramGb;
                        if (data.hardware.gpus && data.hardware.gpus.length > 0) {
                            const gpu = data.hardware.gpus[0];
                            gpuName = gpu.name;
                            gpuVendor = gpu.vendor;
                            vramGb = gpu.vram_mb / 1024;
                        } else if (data.hardware.max_vram_mb) {
                            vramGb = data.hardware.max_vram_mb / 1024;
                        }
                        
                        return {
                            ramGb,
                            cores,
                            gpuName,
                            gpuVendor,
                            vramGb: Math.round(vramGb),
                            hasGamingGpu: gpuVendor === 'nvidia' || gpuVendor === 'amd' || data.hardware.is_mac_silicon,
                            webGpuAvailable
                        };
                    }
                }
            } catch (e) {
                console.warn('[GnosysLLM] Failed to fetch server hardware info:', e);
            }
        }

        if (webGpuAvailable) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    let info = null;
                    if (typeof adapter.requestAdapterInfo === 'function') {
                        info = await adapter.requestAdapterInfo();
                    } else if (adapter.info) {
                        info = adapter.info;
                    }
                    if (info) {
                        gpuName = info.description || info.device || gpuName;
                        gpuVendor = (info.vendor || '').toLowerCase();
                    }
                }
            } catch (e) {
                console.warn('[GnosysLLM] WebGPU hardware query failed:', e);
            }
        }

        if (gpuName === 'Unknown/Generic GPU') {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
                        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
                        gpuName = renderer || gpuName;
                        const vLower = vendor.toLowerCase();
                        if (vLower.includes('nvidia')) gpuVendor = 'nvidia';
                        else if (vLower.includes('amd') || vLower.includes('radeon')) gpuVendor = 'amd';
                        else if (vLower.includes('intel')) gpuVendor = 'intel';
                        else if (vLower.includes('apple')) gpuVendor = 'apple';
                    }
                }
            } catch (e) {
                console.warn('[GnosysLLM] WebGL hardware query failed:', e);
            }
        }

        const gpuNameLower = gpuName.toLowerCase();
        if (gpuVendor === 'unknown') {
            if (gpuNameLower.includes('nvidia')) gpuVendor = 'nvidia';
            else if (gpuNameLower.includes('amd') || gpuNameLower.includes('radeon')) gpuVendor = 'amd';
            else if (gpuNameLower.includes('intel')) gpuVendor = 'intel';
            else if (gpuNameLower.includes('apple')) gpuVendor = 'apple';
        }

        let hasGamingGpu = false;
        if (gpuVendor === 'nvidia') {
            hasGamingGpu = true;
        } else if (gpuVendor === 'amd') {
            if (!gpuNameLower.includes('integrated') && !gpuNameLower.includes('graphics') && !gpuNameLower.includes('apu')) {
                hasGamingGpu = true;
            }
        } else if (gpuVendor === 'apple') {
            if (gpuNameLower.includes('m1') || gpuNameLower.includes('m2') || gpuNameLower.includes('m3') || gpuNameLower.includes('m4') || gpuNameLower.includes('apple m')) {
                hasGamingGpu = true;
            }
        }

        return {
            ramGb,
            cores,
            gpuName,
            gpuVendor,
            vramGb,
            hasGamingGpu,
            webGpuAvailable
        };
    }


    const state = {
        initialized: false,
        initPromise: null,
        provider: null,
        providerName: 'uninitialized',
        lastProbeOk: false,
        isWebGpuSupported: Boolean(navigator.gpu),
        isOpfsSupported: Boolean(navigator.storage?.getDirectory),
        mobileChoicePending: false,
        modalEl: null,
        smartSetupOpenQueued: false,
        badgeIntervalId: null,
    };

    const LITERT_SETUP_STATUS_EVENT = 'gnosys-litert-setup-status';

    function emitLiteRtSetupStatus(detail) {
        window.dispatchEvent(new CustomEvent(LITERT_SETUP_STATUS_EVENT, { detail }));
    }

    function showTransientToast(message, variant = 'success') {
        const text = String(message || '').trim();
        if (!text) return;

        const existingToast = document.getElementById('gnosys-litert-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.id = 'gnosys-litert-toast';
        toast.textContent = text;
        toast.style.cssText = [
            'position:fixed',
            'right:16px',
            'bottom:16px',
            'z-index:100001',
            'max-width:min(360px,calc(100vw - 32px))',
            'padding:12px 14px',
            'border-radius:14px',
            'font-size:0.82rem',
            'font-weight:800',
            'line-height:1.3',
            'box-shadow:0 18px 36px rgba(0,0,0,0.28)',
            'backdrop-filter:blur(8px)',
            'opacity:0',
            'transform:translateY(10px)',
            'transition:opacity .2s ease, transform .2s ease',
            'pointer-events:none',
            variant === 'success'
                ? 'background:rgba(6,95,70,0.96);color:#ecfdf5;border:1px solid rgba(16,185,129,0.35);'
                : variant === 'error'
                    ? 'background:rgba(127,29,29,0.96);color:#fee2e2;border:1px solid rgba(248,113,113,0.35);'
                    : 'background:rgba(15,23,42,0.96);color:#e2e8f0;border:1px solid rgba(148,163,184,0.3);'
        ].join(';');

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        window.setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            window.setTimeout(() => toast.remove(), 220);
        }, 2800);
    }

    function queueSmartSetupModal(options = {}) {
        const force = Boolean(options.force);
        if (state.smartSetupOpenQueued) return;
        if (isMobileDevice) return;
        if (localStorage.getItem(STORAGE_KEYS.routeMode) === 'no-ai') return;

        state.smartSetupOpenQueued = true;
        queueMicrotask(() => {
            state.smartSetupOpenQueued = false;
            if (localStorage.getItem(STORAGE_KEYS.routeMode) === 'no-ai') return;
            if (document.getElementById('gnosys-desktop-ollama-modal')) return;
            if (!force && state.providerName === 'desktop-ollama') return;
            showMobileChoiceModal();
        });
    }

    const routerApi = {
        init,
        getStatus,
        generateResponse,
        showMobileChoiceModal,
        showDesktopConnectionInfoModal,
        setCloudApiKey,
        getCloudApiKey,
        refreshStatusBadges,
        getProviderBadgeInfo,
        getTutorStatusDisplay,
        purgeModelStorage,
        getActiveDesktopModel,
        getPrettyModelName,
        getClientHardwareInfo,
    };

    window.GnosysLLM = routerApi;

    window.addEventListener('storage', (event) => {
        if (event.key === 'gnosys_active_llm') {
            refreshStatusBadges();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch(() => {});
        });
    } else {
        init().catch(() => {});
    }

    async function init() {
        if (isDownloadInitializing) {
            throw new Error('On-device download is already initializing.');
        }

        if (state.initialized) return getStatus();
        if (state.initPromise) return state.initPromise;

        state.initPromise = (async () => {
            await invalidateStaleOnDeviceCache();

            const ollamaOk = await probeOllamaTags();
            state.lastProbeOk = ollamaOk;

            let routeMode = localStorage.getItem(STORAGE_KEYS.routeMode) || '';
            let onDeviceReady = localStorage.getItem(STORAGE_KEYS.onDeviceReady) === 'true';
            let downloadInProgress = localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true';
            let storageMode = localStorage.getItem(STORAGE_KEYS.onDeviceStorageMode) || 'localfile';

            let isReady = false;
            let hasPartialModel = false;

            if (state.isWebGpuSupported) {
                if (storageMode === 'localfile') {
                    const activeConfig = getActiveModelConfig();
                    const hasFsaHandle = ('showSaveFilePicker' in window || 'showOpenFilePicker' in window) && Boolean(await getFileHandle(activeConfig.id));
                    const hasSavedMetadata = Boolean(localStorage.getItem(STORAGE_KEYS.onDeviceLocalFileMetadata));
                    isReady = onDeviceReady && (hasFsaHandle || Boolean(selectedLocalFile) || hasSavedMetadata);
                    hasPartialModel = !isReady && (hasFsaHandle || hasSavedMetadata);
                } else {
                    let onDeviceFile = await getOpfsModelFile();
                    const expectedSize = Number(localStorage.getItem(STORAGE_KEYS.onDeviceExpectedSize) || 0);
                    hasPartialModel = Boolean(onDeviceFile) && !onDeviceReady;
                    const hasCorruptInstalledModel = Boolean(onDeviceReady && onDeviceFile && expectedSize > 0 && onDeviceFile.size !== expectedSize);

                    if (hasCorruptInstalledModel || (onDeviceReady && !onDeviceFile)) {
                        await purgeModelStorage({ suppressModal: true });
                        routeMode = localStorage.getItem(STORAGE_KEYS.routeMode) || '';
                        onDeviceReady = false;
                        downloadInProgress = false;
                        onDeviceFile = null;
                    }
                    isReady = onDeviceReady && Boolean(onDeviceFile);
                }
            }

            if (routeMode === 'mobile-ondevice' && state.isWebGpuSupported) {
                if (isReady) {
                    state.provider = createLiteRtProvider();
                    setProvider('mobile-litert');
                    state.mobileChoicePending = false;
                } else {
                    state.provider = null;
                    state.mobileChoicePending = true;
                    setProvider('mobile-choice-required');
                    queueMicrotask(() => showMobileChoiceModal());
                }
            } else if (ollamaOk && routeMode !== 'no-ai') {
                state.provider = createOllamaProvider();
                setProvider('desktop-ollama');
                state.mobileChoicePending = false;
            } else {
                if (routeMode === 'no-ai') {
                    state.provider = createNoAiProvider();
                    setProvider('no-ai');
                    state.mobileChoicePending = false;
                } else if (!isMobileDevice) {
                    state.provider = createNoAiProvider();
                    setProvider('no-ai');
                    state.mobileChoicePending = false;
                    queueMicrotask(() => showDesktopOllamaLaunchModal());
                } else {
                    state.provider = null;
                    state.mobileChoicePending = true;
                    const providerName = !state.isWebGpuSupported
                        ? 'mobile-webgpu-unsupported'
                        : 'mobile-choice-required';
                    setProvider(providerName);
                    if (state.isWebGpuSupported) {
                        queueMicrotask(() => showMobileChoiceModal());
                    }
                }
            }

            startBadgeRefreshLoop();
            state.initialized = true;
            return getStatus();
        })();

        return state.initPromise;
    }

    function getStatus() {
        return {
            initialized: state.initialized,
            provider: state.providerName,
            lastProbeOk: state.lastProbeOk,
            webGpuSupported: state.isWebGpuSupported,
            opfsSupported: state.isOpfsSupported,
            mobileChoicePending: state.mobileChoicePending,
        };
    }

    function setProvider(providerName) {
        state.providerName = providerName;
        refreshStatusBadges();
        window.dispatchEvent(new CustomEvent('gnosys-llm-provider-changed', { detail: getStatus() }));
    }

    async function generateResponse(systemPrompt, userPrompt, options = {}) {
        await init();

        if (!state.provider) {
            if (state.isWebGpuSupported) {
                showMobileChoiceModal();
                throw new Error('Model provider not selected yet. Choose a mobile mode to continue.');
            }
            throw new Error('No local LLM provider available. This browser does not support WebGPU.');
        }

        return state.provider.generateResponse(systemPrompt, userPrompt, options);
    }

    async function probeOllamaTags() {
        try {
            const res = await fetch(OLLAMA_TAGS_URL, {
                method: 'GET',
                signal: AbortSignal.timeout(1000),
            });
            return res.ok;
        } catch (_err) {
            return false;
        }
    }

    async function invalidateStaleOnDeviceCache() {
        if (state.provider && typeof state.provider.close === 'function') {
            await state.provider.close();
            state.provider = null;
        }

        const activeConfig = getActiveModelConfig();
        const existingVersion = localStorage.getItem(STORAGE_KEYS.onDeviceModelCacheVersion);
        const existingModelId = localStorage.getItem(STORAGE_KEYS.onDeviceSelectedModel);

        if (existingVersion === activeConfig.cacheVersion && existingModelId === activeConfig.id) {
            return;
        }

        try {
            const cache = await caches.open(MODEL_CACHE_NAME);
            const keys = await cache.keys();
            for (const r of keys) {
                await cache.delete(r);
            }
        } catch (_err) {
            // Ignore cache deletion failures and continue with cold setup.
        }

        try {
            for (const tierId in MODEL_TIERS) {
                await removeOpfsModelEntry(MODEL_TIERS[tierId].filename);
            }
        } catch (_err) {
            // Ignore OPFS cleanup failures and continue with cold setup.
        }

        localStorage.removeItem(STORAGE_KEYS.onDeviceReady);
        localStorage.setItem(STORAGE_KEYS.onDeviceModelCacheVersion, activeConfig.cacheVersion);
        localStorage.setItem(STORAGE_KEYS.onDeviceSelectedModel, activeConfig.id);
        localStorage.removeItem(STORAGE_KEYS.onDeviceModelFileVersion);
        localStorage.removeItem(STORAGE_KEYS.onDeviceExpectedSize);
    }

    function setCloudApiKey(key) {
        if (!key) {
            localStorage.removeItem(STORAGE_KEYS.cloudApiKey);
            return;
        }
        localStorage.setItem(STORAGE_KEYS.cloudApiKey, key);
    }

    function getCloudApiKey() {
        return localStorage.getItem(STORAGE_KEYS.cloudApiKey) || '';
    }

    function createOllamaProvider() {
        function resolveModel(moduleKey) {
            if (typeof window.getActiveModel === 'function') {
                const active = window.getActiveModel(moduleKey || 'gnosys_active_llm');
                if (active) return active;
            }
            if (typeof window.getGnosysModel === 'function') {
                const model = window.getGnosysModel(moduleKey || 'gnosys_active_llm');
                if (model) return model;
            }
            return (
                localStorage.getItem('gnosys_active_llm') ||
                localStorage.getItem(moduleKey || '') ||
                'gemma4:e4b'
            );
        }

        return {
            async generateResponse(systemPrompt, userPrompt, options = {}) {
                const moduleKey = options.moduleKey || 'gnosys_active_llm';
                const model = options.model || resolveModel(moduleKey);
                const stream = Boolean(options.stream);
                const history = Array.isArray(options.history) ? options.history : [];

                const messages = [];
                if (systemPrompt) {
                    messages.push({ role: 'system', content: String(systemPrompt) });
                }
                for (const entry of history) {
                    if (!entry || typeof entry.content !== 'string' || typeof entry.role !== 'string') continue;
                    messages.push({ role: entry.role, content: entry.content });
                }
                messages.push({ role: 'user', content: String(userPrompt || '') });

                const requestOptions = {};
                if (String(model).toLowerCase().includes('gemma4')) {
                    requestOptions.draft_num_predict = 4;
                }

                const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages,
                        stream,
                        options: requestOptions,
                    }),
                });

                if (!response.ok) {
                    let detail = '';
                    try {
                        detail = await response.text();
                    } catch (_err) {
                        detail = '';
                    }
                    throw new Error(`Ollama request failed: ${response.status}${detail ? ` ${detail}` : ''}`);
                }

                if (!stream) {
                    const payload = await response.json();
                    const text = payload?.message?.content || payload?.response || '';
                    return { provider: 'desktop-ollama', model, text: String(text) };
                }

                if (!response.body) {
                    throw new Error('Ollama stream did not return a readable body.');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let lineBuffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    lineBuffer += decoder.decode(value, { stream: true });
                    const lines = lineBuffer.split('\n');
                    lineBuffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        let data;
                        try {
                            data = JSON.parse(line);
                        } catch (_err) {
                            continue;
                        }

                        const token = typeof data?.message?.content === 'string' ? data.message.content : '';
                        if (!token) continue;
                        fullText += token;
                        if (typeof options.onToken === 'function') {
                            options.onToken(token, fullText);
                        }
                    }
                }

                return { provider: 'desktop-ollama', model, text: fullText };
            },
        };
    }

    function createNoAiProvider() {
        return {
            async generateResponse(systemPrompt, userPrompt, options = {}) {
                const text = "AI Tutor is currently disabled on this device. Click the '● AI Disabled' status badge in the top header at any time to enable and download local Gemma 4 AI!";
                if (options.stream && typeof options.onToken === 'function') {
                    const tokens = text.split(' ');
                    let full = '';
                    for (const token of tokens) {
                        const word = token + ' ';
                        full += word;
                        options.onToken(word, full);
                        await new Promise(r => setTimeout(r, 45));
                    }
                }
                return {
                    provider: 'no-ai',
                    model: 'none',
                    text: text
                };
            }
        };
    }

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
        const swPath = `${baseHref}sw.js`;
        try {
            const reg = await navigator.serviceWorker.register(swPath, { scope: baseHref });
            console.log('[GnosysLLM] Service Worker registered with scope:', reg.scope);
            
            // Wait for service worker to become active and control the page
            if (navigator.serviceWorker.controller) {
                return;
            }
            
            await new Promise((resolve) => {
                const handler = () => {
                    if (navigator.serviceWorker.controller) {
                        navigator.serviceWorker.removeEventListener('controllerchange', handler);
                        resolve();
                    }
                };
                navigator.serviceWorker.addEventListener('controllerchange', handler);
                // Set a timeout fallback of 1000ms
                setTimeout(resolve, 1000);
            });
        } catch (err) {
            console.warn('[GnosysLLM] Service Worker registration failed:', err);
        }
    }

    function createLiteRtProvider() {
        const providerState = {
            engine: null,
            modelObjectUrl: null,
            tempBlobUrl: null,
            litertModule: null,
            activeConversation: null,
            activeSystemPrompt: null,
            activeHistory: [],
            idleTimerId: null,
            visibilityListenerAttached: false,
        };

        return {
            async close() {
                if (providerState.idleTimerId) {
                    clearTimeout(providerState.idleTimerId);
                    providerState.idleTimerId = null;
                }
                if (providerState.engine) {
                    try {
                        await providerState.engine.delete();
                        console.log('[GnosysLLM] Explicitly deleted LiteRT WebGPU engine instance.');
                    } catch (e) {
                        console.warn('[GnosysLLM] Failed to delete LiteRT engine:', e);
                    }
                    providerState.engine = null;
                }
                if (providerState.tempBlobUrl) {
                    try {
                        URL.revokeObjectURL(providerState.tempBlobUrl);
                        console.log('[GnosysLLM] Revoked temporary blob URL.');
                    } catch (e) {
                        console.warn('[GnosysLLM] Failed to revoke blob URL:', e);
                    }
                    providerState.tempBlobUrl = null;
                }
                providerState.modelObjectUrl = null;
                providerState.activeConversation = null;
                providerState.activeHistory = [];
            },

            resetInactivityTimer() {
                if (providerState.idleTimerId) {
                    clearTimeout(providerState.idleTimerId);
                    providerState.idleTimerId = null;
                }

                const isLowRam = localStorage.getItem(STORAGE_KEYS.lowRamOptimizations) === 'true' || (navigator.deviceMemory && navigator.deviceMemory <= 4);
                if (!isLowRam || !providerState.engine) return;

                // 3 minutes of inactivity triggers eager de-allocation
                providerState.idleTimerId = setTimeout(async () => {
                    console.log('[GnosysLLM] Active session idle for 3 minutes. Eagerly de-allocating WebGPU resources to save RAM.');
                    await this.close();
                }, 180000);
            },

            setupMemoryWatchdog() {
                if (providerState.visibilityListenerAttached) return;

                document.addEventListener('visibilitychange', async () => {
                    const isLowRam = localStorage.getItem(STORAGE_KEYS.lowRamOptimizations) === 'true' || (navigator.deviceMemory && navigator.deviceMemory <= 4);
                    if (!isLowRam || !providerState.engine) return;

                    if (document.visibilityState === 'hidden') {
                        console.log('[GnosysLLM] Tab hidden. Eagerly closing WebGPU engine to prevent background browser tab OOM crashes.');
                        await this.close();
                    }
                });

                providerState.visibilityListenerAttached = true;
            },

            async ensureReady(progressCallback) {
                if (!providerState.litertModule) {
                    providerState.litertModule = await import('https://cdn.jsdelivr.net/npm/@litert-lm/core/+esm');
                }

                // Register and coordinate PWA Service Worker control
                await registerServiceWorker();

                let justDownloaded = false;
                if (!providerState.modelObjectUrl) {
                    providerState.modelObjectUrl = await getOrDownloadModelObjectUrl(progressCallback);
                    justDownloaded = true;
                }

                if (!providerState.engine) {
                    if (justDownloaded) {
                        if (typeof progressCallback === 'function') {
                            progressCallback({ loaded: 100, total: 100, percent: 100, stage: 'finalizing' });
                        }
                        await new Promise((resolve) => setTimeout(resolve, 1500));

                        if (typeof progressCallback === 'function') {
                            progressCallback({ loaded: 100, total: 100, percent: 100, stage: 'cooling' });
                        }
                        state.downloadSession = null;
                        await new Promise((resolve) => setTimeout(resolve, 1500));
                    }

                    if (typeof progressCallback === 'function') {
                        progressCallback({ loaded: 100, total: 100, percent: 100, stage: 'compiling' });
                    }
                    const { Engine, Backend } = providerState.litertModule;
                    
                    const activeConfig = getActiveModelConfig();
                    const storageMode = localStorage.getItem(STORAGE_KEYS.onDeviceStorageMode) || 'localfile';
                    
                    const supportsFsa = 'showSaveFilePicker' in window || 'showOpenFilePicker' in window;
                    let modelUrl;
                    const isUltraLight = activeConfig.id === 'smollm-135m-ultra';

                    if (isUltraLight) {
                        // Pass the direct ReadableStream to satisfy 'model instanceof ReadableStream' and completely bypass fetch()
                        modelUrl = providerState.modelObjectUrl.stream();
                        console.log(`[GnosysLLM] Configured direct ReadableStream for Ultra-Light model "${activeConfig.name}":`, modelUrl);
                    } else if (storageMode === 'localfile') {
                        if (supportsFsa) {
                            // High-performance streaming mode via Service Worker interception
                            const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
                            modelUrl = `${window.location.origin}${baseHref}models/local-${activeConfig.id}.litertlm`;
                            console.log('[GnosysLLM] Configured high-performance local FSA stream URL:', modelUrl);
                        } else {
                            // Fallback for iOS/Safari where FSA is unsupported
                            modelUrl = URL.createObjectURL(providerState.modelObjectUrl);
                            providerState.tempBlobUrl = modelUrl;
                            console.log('[GnosysLLM] Created iOS fallback local file Blob URL:', modelUrl);
                        }
                    } else if (storageMode === 'opfs') {
                        // Define a virtual local URL matching base scope. The PWA Service Worker will intercept
                        // fetches to /models/* and stream them directly from OPFS in chunked Streaming Mode.
                        const baseHref = window.location.pathname.startsWith('/Gnosys-AI') ? '/Gnosys-AI/' : '/';
                        modelUrl = `${window.location.origin}${baseHref}models/${activeConfig.filename}`;
                    } else {
                        // Fallback Blob URL creation
                        modelUrl = URL.createObjectURL(providerState.modelObjectUrl);
                        providerState.tempBlobUrl = modelUrl;
                        console.log(`[GnosysLLM] Created fallback Blob URL for model "${activeConfig.name}":`, modelUrl);
                    }
                    
                    const isLowRam = localStorage.getItem(STORAGE_KEYS.lowRamOptimizations) === 'true' || (navigator.deviceMemory && navigator.deviceMemory <= 4);
                    let limit = activeConfig.tokensLimit;
                    if (isMobileDevice) {
                        if (activeConfig.id === 'smollm-135m-ultra') {
                            // Ultra-light model consumes minimal memory, safe to use 1024 token limit even on low-RAM devices
                            limit = Math.min(limit, 1024);
                        } else if (isLowRam) {
                            // Larger models (like Gemma) restrict context under low-RAM to prevent OOM crashes, but give 768 tokens minimum budget
                            limit = Math.min(limit, 768);
                        } else {
                            limit = Math.min(limit, 1024); // Balance standard mobile memory to 1024
                        }
                    }
                    const finalLimit = isMobileDevice ? limit : limit * 2;
                    console.log(`[GnosysLLM] Initializing LiteRT Engine. Model: ${activeConfig.name}, Storage: ${storageMode}, KV Context Limit: ${finalLimit} tokens (Low-RAM mode: ${isLowRam ? 'ACTIVE' : 'INACTIVE'}).`);

                    const engineSettings = {
                        model: modelUrl,
                        backend: Backend ? Backend.GPU_ARTISAN : undefined,
                        mainExecutorSettings: {
                            maxNumTokens: finalLimit,
                        },
                    };
                    try {
                        providerState.engine = await Engine.create(engineSettings);
                    } catch (gpuErr) {
                        console.warn('[GnosysLLM] WebGPU engine creation failed. Retrying with CPU backend...', gpuErr);
                        if (Backend && Backend.CPU) {
                            engineSettings.backend = Backend.CPU;
                            if (isUltraLight && providerState.modelObjectUrl) {
                                // Recreate stream since the first attempt locked/consumed it
                                engineSettings.model = providerState.modelObjectUrl.stream();
                            }
                            providerState.engine = await Engine.create(engineSettings);
                            console.log('[GnosysLLM] Fallback to CPU backend succeeded.');
                        } else {
                            throw gpuErr;
                        }
                    }
                    this.setupMemoryWatchdog();
                    this.resetInactivityTimer();
                    localStorage.setItem(STORAGE_KEYS.onDeviceReady, 'true');
                    localStorage.setItem(STORAGE_KEYS.onDeviceModelCacheVersion, activeConfig.cacheVersion);
                }
            },

            async generateResponse(systemPrompt, userPrompt, options = {}) {
                await this.ensureReady(options.onDownloadProgress);
                this.resetInactivityTimer();
                const history = Array.isArray(options.history) ? options.history : [];

                // 1. Calculate active token limits and budgets
                const activeConfig = getActiveModelConfig();
                const isLowRam = localStorage.getItem(STORAGE_KEYS.lowRamOptimizations) === 'true' || (navigator.deviceMemory && navigator.deviceMemory <= 4);
                let limit = activeConfig.tokensLimit;
                if (isMobileDevice) {
                    if (activeConfig.id === 'smollm-135m-ultra') {
                        limit = Math.min(limit, 1024);
                    } else if (isLowRam) {
                        limit = Math.min(limit, 768);
                    } else {
                        limit = Math.min(limit, 1024);
                    }
                }
                const finalLimit = isMobileDevice ? limit : limit * 2;

                const systemTokens = estimateTokens(systemPrompt);
                const availableBudget = Math.max(150, finalLimit - systemTokens - 256); // Reserve at least 256 tokens for model generation

                let trimmedHistory = [...history];
                let wasTrimmed = false;

                while (trimmedHistory.length > 0) {
                    const historyText = trimmedHistory.map(h => h.content).join(' ');
                    const totalEstimated = estimateTokens(historyText) + estimateTokens(userPrompt);
                    if (totalEstimated <= availableBudget) {
                        break;
                    }
                    wasTrimmed = true;
                    // Remove first two items if they represent a full turn (user + assistant) to maintain alternation
                    if (trimmedHistory[0].role === 'user') {
                        trimmedHistory.shift();
                        if (trimmedHistory.length > 0 && trimmedHistory[0].role === 'assistant') {
                            trimmedHistory.shift();
                        }
                    } else {
                        trimmedHistory.shift();
                    }
                }

                if (wasTrimmed) {
                    console.log(`[GnosysLLM] Context limit window safety: pruned history to fit token budget (${trimmedHistory.length} messages remaining out of ${history.length}).`);
                }

                let conversation = null;
                let reuseConversation = false;
                let newHistoryItemsToPlay = [];

                // Re-use is only safe if history was not pruned/trimmed (otherwise we need a fresh conversation session to drop pruned turns)
                if (!wasTrimmed && providerState.activeConversation && providerState.activeSystemPrompt === systemPrompt) {
                    const cachedLen = providerState.activeHistory.length;
                    if (trimmedHistory.length >= cachedLen) {
                        let prefixMatch = true;
                        for (let i = 0; i < cachedLen; i++) {
                            if (trimmedHistory[i].role !== providerState.activeHistory[i].role ||
                                trimmedHistory[i].content !== providerState.activeHistory[i].content) {
                                prefixMatch = false;
                                break;
                            }
                        }
                        if (prefixMatch) {
                            reuseConversation = true;
                            newHistoryItemsToPlay = trimmedHistory.slice(cachedLen);
                        }
                    }
                }

                if (reuseConversation) {
                    conversation = providerState.activeConversation;
                    for (const item of newHistoryItemsToPlay) {
                        if (!item || typeof item.role !== 'string' || typeof item.content !== 'string') continue;
                        await conversation.sendMessage({ role: item.role, content: item.content });
                        providerState.activeHistory.push({ role: item.role, content: item.content });
                    }
                } else {
                    let prefaceMessages = [];
                    if (systemPrompt) {
                        prefaceMessages.push({ role: 'system', content: String(systemPrompt) });
                    }
                    for (const item of trimmedHistory) {
                        if (!item || typeof item.role !== 'string' || typeof item.content !== 'string') continue;
                        prefaceMessages.push({ role: item.role, content: item.content });
                    }

                    conversation = await providerState.engine.createConversation({
                        preface: {
                            messages: prefaceMessages,
                        },
                    });
                    providerState.activeConversation = conversation;
                    providerState.activeSystemPrompt = systemPrompt;
                    providerState.activeHistory = [...trimmedHistory];
                    prefaceMessages = null;
                }

                const stream = Boolean(options.stream);
                if (!stream) {
                    const response = await conversation.sendMessage({ role: 'user', content: String(userPrompt || '') });
                    const textPart = Array.isArray(response?.content)
                        ? response.content.find((p) => p.type === 'text' && typeof p.text === 'string')
                        : null;
                    const text = textPart ? textPart.text : '';

                    providerState.activeHistory.push({ role: 'user', content: String(userPrompt || '') });
                    providerState.activeHistory.push({ role: 'assistant', content: text });

                    this.resetInactivityTimer();
                    return {
                        provider: 'mobile-litert',
                        model: activeConfig.filename,
                        text,
                    };
                }

                let text = '';
                try {
                    const streamSource = conversation.sendMessageStreaming({ role: 'user', content: String(userPrompt || '') });
                    for await (let chunk of streamSource) {
                        if (chunk && Array.isArray(chunk.content)) {
                            for (let item of chunk.content) {
                                if (item && item.type === 'text' && typeof item.text === 'string') {
                                    text += item.text;
                                    if (typeof options.onToken === 'function') {
                                        options.onToken(item.text, text);
                                    }
                                    item = null;
                                }
                            }
                        }
                        chunk = null;
                    }
                } finally {
                    if (options && typeof options === 'object') {
                        options.onToken = null;
                    }
                }

                providerState.activeHistory.push({ role: 'user', content: String(userPrompt || '') });
                providerState.activeHistory.push({ role: 'assistant', content: text });

                this.resetInactivityTimer();
                return {
                    provider: 'mobile-litert',
                    model: activeConfig.filename,
                    text,
                };
            },
        };
    }

    async function checkQuotaAndRequestPersistence(requiredBytes) {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const persisted = await navigator.storage.persist();
                console.log(`[GnosysLLM] Storage persistence status: ${persisted ? 'PERSISTED' : 'BEST-EFFORT'}`);
            } catch (err) {
                console.warn('[GnosysLLM] Failed to request storage persistence:', err);
            }
        }

        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const available = estimate.quota - estimate.usage;
                console.log(`[GnosysLLM] Storage Estimate - Quota: ${(estimate.quota / 1e9).toFixed(2)} GB, Usage: ${(estimate.usage / 1e9).toFixed(2)} GB, Available: ${(available / 1e9).toFixed(2)} GB`);
                
                if (available < requiredBytes) {
                    throw new Error(`Insufficient storage. Gnosys requires ~${(requiredBytes / 1e9).toFixed(2)} GB, but only ${(available / 1e9).toFixed(2)} GB is available. Please clear space in your browser settings or device storage.`);
                }
            } catch (err) {
                if (err.message && err.message.includes('Insufficient storage')) {
                    throw err;
                }
                console.warn('[GnosysLLM] Failed to estimate storage quota:', err);
            }
        }
    }

    async function getOrDownloadModelObjectUrl(progressCallback) {
        const activeConfig = getActiveModelConfig();
        const storageMode = localStorage.getItem(STORAGE_KEYS.onDeviceStorageMode) || 'localfile';

        if (storageMode === 'localfile') {
            if ('showSaveFilePicker' in window || 'showOpenFilePicker' in window) {
                const handle = await getFileHandle(activeConfig.id);
                if (handle) {
                    const options = { mode: 'read' };
                    if ((await handle.queryPermission(options)) === 'granted') {
                        const file = await handle.getFile();
                        if (typeof progressCallback === 'function') {
                            progressCallback({ loaded: file.size, total: file.size, percent: 100, stage: 'ready' });
                        }
                        return file;
                    } else {
                        if (typeof progressCallback === 'function') {
                            progressCallback({ loaded: 0, total: 100, percent: 0, stage: 'requesting_permission' });
                        }
                        try {
                            if ((await handle.requestPermission(options)) === 'granted') {
                                const file = await handle.getFile();
                                if (typeof progressCallback === 'function') {
                                    progressCallback({ loaded: file.size, total: file.size, percent: 100, stage: 'ready' });
                                }
                                return file;
                            }
                        } catch (err) {
                            console.warn('[GnosysLLM] Permission request denied or failed:', err);
                        }
                    }
                }
            }

            if (selectedLocalFile) {
                if (typeof progressCallback === 'function') {
                    progressCallback({ loaded: selectedLocalFile.size, total: selectedLocalFile.size, percent: 100, stage: 'ready' });
                }
                return selectedLocalFile;
            }

            throw new Error('Local model file not loaded. Tap on the status badge to select a model file.');
        }

        if (!state.isOpfsSupported) {
            throw new Error('On-device model storage requires OPFS support in this browser.');
        }

        const partialSize = await getOpfsFileSize(activeConfig.filename);

        // Run pre-flight persistent storage and quota check
        const EXPECTED_MODEL_SIZE = activeConfig.expectedSize;
        const neededBytes = Math.max(0, EXPECTED_MODEL_SIZE - partialSize);
        await checkQuotaAndRequestPersistence(neededBytes);

        const existingFile = await getCachedModelFile();
        if (existingFile) {
            if (typeof progressCallback === 'function') {
                progressCallback({ loaded: existingFile.size, total: existingFile.size, percent: 100, stage: 'cached' });
            }
            return existingFile;
        }

        const requestHeaders = {};
        if (partialSize > 0) {
            requestHeaders.Range = `bytes=${partialSize}-`;
        }

        const downloadSession = {
            abortController: new AbortController(),
            reader: null,
            writable: null,
        };

        isDownloadInitializing = true;
        state.downloadSession = downloadSession;

        try {
            const res = await fetch(activeConfig.url, {
                method: 'GET',
                headers: requestHeaders,
                signal: downloadSession.abortController.signal,
            });
            if (!res.ok || !res.body) {
                throw new Error('Failed to download mobile model file.');
            }

            const responseTotal = getExpectedDownloadSize(res, partialSize);
            const appendExisting = res.status === 206 && partialSize > 0;
            const initialLoaded = appendExisting ? partialSize : 0;

            if (!appendExisting && partialSize > 0) {
                try {
                    await removeOpfsModelEntry(activeConfig.filename);
                } catch (_e) {
                    console.warn('[GnosysLLM] Failed to remove stale OPFS entry:', _e);
                }
            }

            if (typeof progressCallback === 'function' && initialLoaded > 0) {
                const initialPercent = responseTotal > 0 ? Math.min(100, Math.round((initialLoaded / responseTotal) * 100)) : 0;
                progressCallback({ loaded: initialLoaded, total: responseTotal, percent: initialPercent, stage: 'resuming' });
            }

            await writeStreamToOpfsFile(res.body, activeConfig.filename, progressCallback, {
                total: responseTotal,
                loaded: initialLoaded,
                appendExisting,
                session: downloadSession,
            });

            if (isMobileDevice) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            // OPFS Post-Flight Sync Check: Poll up to 3 times with 100ms delay to verify presence and size
            let file = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    file = await getOpfsModelFile(activeConfig.filename);
                    if (file && (responseTotal <= 0 || file.size === responseTotal)) {
                        break;
                    }
                } catch (e) {
                    console.warn(`[GnosysLLM] OPFS verification attempt ${attempt} failed:`, e);
                }
                if (attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }

            if (!file) {
                throw new Error('Mobile model download completed but local file was not available.');
            }

            if (responseTotal > 0 && file.size !== responseTotal) {
                await purgeModelStorage({ suppressModal: true });
                throw new Error('Mobile model download size mismatch; local storage was purged.');
            }

            localStorage.setItem(STORAGE_KEYS.onDeviceModelFileVersion, activeConfig.cacheVersion);
            localStorage.setItem(STORAGE_KEYS.onDeviceExpectedSize, String(file.size));
            if (typeof progressCallback === 'function') {
                progressCallback({ loaded: file.size, total: file.size, percent: 100, stage: 'ready' });
            }
            return file;
        } catch (err) {
            if (err?.name !== 'AbortError') {
                await purgeModelStorage({ suppressModal: true });
            }
            if (err?.name === 'QuotaExceededError' || (err?.message && err.message.toLowerCase().includes('quota'))) {
                const quotaErr = new Error('The Operation failed because it would cause the application to exceed its storage quota. Please free up space in your browser settings or device storage.');
                quotaErr.name = 'QuotaExceededError';
                throw quotaErr;
            }
            throw err;
        } finally {
            state.downloadSession = null;
            isDownloadInitializing = false;
        }
    }

    async function getOpfsRoot() {
        if (!navigator.storage?.getDirectory) {
            throw new Error('OPFS is unavailable in this browser.');
        }
        return navigator.storage.getDirectory();
    }

    async function getCachedModelFile() {
        const activeConfig = getActiveModelConfig();
        if (localStorage.getItem(STORAGE_KEYS.onDeviceModelFileVersion) !== activeConfig.cacheVersion) {
            return null;
        }

        return getOpfsModelFile(activeConfig.filename);
    }

    async function purgeModelStorage(options = {}) {
        const suppressModal = Boolean(options.suppressModal);
        const session = state.downloadSession;
        state.downloadSession = null;

        if (state.provider && typeof state.provider.close === 'function') {
            await state.provider.close();
        }

        if (session?.abortController && !session.abortController.signal.aborted) {
            try {
                session.abortController.abort();
            } catch (_err) {
                // ignore abort failures
            }
        }

        if (session?.reader) {
            try {
                await session.reader.cancel();
            } catch (_err) {
                // ignore reader cancel failures
            }
        }

        if (session?.writable) {
            try {
                await session.writable.abort();
            } catch (_err) {
                // ignore writable abort failures
            }
        }

        try {
            for (const tierId in MODEL_TIERS) {
                await removeOpfsModelEntry(MODEL_TIERS[tierId].filename);
            }
        } catch (_err) {
            // ignore OPFS cleanup failures during purge
        }

        localStorage.removeItem(STORAGE_KEYS.onDeviceReady);
        localStorage.removeItem(STORAGE_KEYS.onDeviceDownloadInProgress);
        localStorage.removeItem(STORAGE_KEYS.onDeviceModelCacheVersion);
        localStorage.removeItem(STORAGE_KEYS.onDeviceModelFileVersion);
        localStorage.removeItem(STORAGE_KEYS.onDeviceExpectedSize);
        localStorage.removeItem(STORAGE_KEYS.routeMode);

        state.provider = null;
        state.initialized = false;
        state.initPromise = null;
        state.mobileChoicePending = !suppressModal && state.isWebGpuSupported;
        setProvider(state.isWebGpuSupported ? 'mobile-choice-required' : 'mobile-webgpu-unsupported');

        return getStatus();
    }

    async function removeOpfsModelEntry(filename) {
        const activeConfig = getActiveModelConfig();
        const fileToUse = filename || activeConfig.filename;
        const root = await getOpfsRoot();
        try {
            await root.removeEntry(fileToUse, { recursive: false });
        } catch (_err) {
            // ignore missing file cleanup failures
        }
    }

    async function getOpfsFileSize(filename) {
        try {
            const activeConfig = getActiveModelConfig();
            const fileToUse = filename || activeConfig.filename;
            const root = await getOpfsRoot();
            const handle = await root.getFileHandle(fileToUse, { create: false });
            const file = await handle.getFile();
            return file.size;
        } catch (_err) {
            return 0;
        }
    }

    async function getOpfsModelFile(filename) {
        try {
            const activeConfig = getActiveModelConfig();
            const fileToUse = filename || activeConfig.filename;
            const root = await getOpfsRoot();
            const handle = await root.getFileHandle(fileToUse, { create: false });
            return await handle.getFile();
        } catch (_err) {
            return null;
        }
    }

    function getExpectedDownloadSize(response, partialSize) {
        const contentRange = response.headers.get('content-range') || '';
        const rangeMatch = contentRange.match(/\/([0-9]+)\s*$/);
        if (response.status === 206 && rangeMatch) {
            return Number(rangeMatch[1]) || 0;
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        return partialSize > 0 ? partialSize + contentLength : contentLength;
    }

    async function writeStreamToOpfsFile(stream, filename, progressCallback, options = {}) {
        const total = Number(options.total || 0);
        const initialLoaded = Number(options.loaded || 0);
        const appendExisting = Boolean(options.appendExisting);
        const session = options.session || null;

        const root = await getOpfsRoot();
        const handle = await root.getFileHandle(filename, { create: true });
        const writable = await handle.createWritable({ keepExistingData: appendExisting });
        const reader = stream.getReader();
        if (session) {
            session.reader = reader;
            session.writable = writable;
        }
        let loaded = initialLoaded;

        if (appendExisting && loaded > 0) {
            await writable.seek(loaded);
        }

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value || !value.byteLength) continue;

                loaded += value.byteLength;
                await writable.write(value);

                if (typeof progressCallback === 'function') {
                    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                    progressCallback({ loaded, total, percent, stage: 'downloading' });
                }
            }

            await writable.close();
        } catch (err) {
            try {
                await writable.abort();
            } catch (_abortErr) {
                // ignore abort failures
            }
            throw err;
        } finally {
            if (session) {
                session.reader = null;
                session.writable = null;
            }
        }
    }

    async function writeStreamToFileHandle(stream, fileHandle, progressCallback, options = {}) {
        const total = Number(options.total || 0);
        const initialLoaded = Number(options.loaded || 0);
        const session = options.session || null;

        const writable = await fileHandle.createWritable();
        const reader = stream.getReader();
        if (session) {
            session.reader = reader;
            session.writable = writable;
        }
        let loaded = initialLoaded;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value || !value.byteLength) continue;

                loaded += value.byteLength;
                await writable.write(value);

                if (typeof progressCallback === 'function') {
                    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                    progressCallback({ loaded, total, percent, stage: 'downloading' });
                }
            }

            await writable.close();
        } catch (err) {
            try {
                await writable.abort();
            } catch (_abortErr) {
                // ignore abort failures
            }
            throw err;
        } finally {
            if (session) {
                session.reader = null;
                session.writable = null;
            }
        }
    }

    function getActiveDesktopModel() {
        if (typeof window.getActiveModel === 'function') {
            const active = window.getActiveModel('gnosys_active_llm');
            if (active) return active;
        }
        if (typeof window.getGnosysModel === 'function') {
            const model = window.getGnosysModel('gnosys_active_llm');
            if (model) return model;
        }
        return localStorage.getItem('gnosys_active_llm') || 'gemma4:e4b';
    }

    function getPrettyModelName(rawModel) {
        if (!rawModel) return 'Gemma 4';
        let clean = rawModel.split('/').pop().split(':')[0];
        if (clean === 'gemma4' || clean.startsWith('gemma-4')) return 'Gemma 4';
        if (clean.includes('gemma')) return 'Gemma';
        if (clean.includes('llama3.2') || clean.includes('llama-3.2')) return 'Llama 3.2';
        if (clean.includes('llama3') || clean.includes('llama-3')) return 'Llama 3';
        if (clean.includes('qwen2.5') || clean.includes('qwen-2.5')) return 'Qwen 2.5';
        if (clean.includes('phi3') || clean.includes('phi-3')) return 'Phi 3';
        if (clean.includes('mistral')) return 'Mistral';
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    function getProviderBadgeInfo(status = getStatus()) {
        if (!status || !status.provider) {
            return isMobileDevice 
                ? { text: '● Mobile Setup Required', className: 'gnosys-status--setup' }
                : { text: '● Ollama Offline (Tap to Launch)', className: 'gnosys-status--setup' };
        }

        if (status.provider === 'no-ai') {
            return isMobileDevice
                ? { text: '● AI Disabled (Tap to Enable)', className: 'gnosys-status--setup' }
                : { text: '● AI Offline (Tap to Launch)', className: 'gnosys-status--setup' };
        }

        if (status.provider === 'desktop-ollama') {
            const activeModel = getActiveDesktopModel();
            const prettyName = getPrettyModelName(activeModel);
            return { text: `● PC Ollama: ${prettyName}`, className: 'gnosys-status--desktop' };
        }

        if (status.provider === 'mobile-litert') {
            const activeConfig = getActiveModelConfig();
            return { text: `● Running Locally (${activeConfig.shortName})`, className: 'gnosys-status--mobile' };
        }

        return isMobileDevice 
            ? { text: '● Mobile Setup Required', className: 'gnosys-status--setup' }
            : { text: '● Ollama Offline (Tap to Launch)', className: 'gnosys-status--setup' };
    }

    function getTutorStatusDisplay(status = getStatus()) {
        if (status?.provider === 'desktop-ollama') {
            const activeModel = getActiveDesktopModel();
            const prettyName = getPrettyModelName(activeModel);
            return {
                connected: true,
                text: `Connected to PC (Ollama: ${prettyName})`,
                dotClass: 'inline-block w-2 h-2 rounded-full bg-green-500',
            };
        }

        if (status?.provider === 'no-ai') {
            return {
                connected: false,
                text: isMobileDevice ? 'AI Disabled (Tap to Enable)' : 'AI Offline (Tap to Launch)',
                dotClass: 'inline-block w-2 h-2 rounded-full bg-amber-500',
            };
        }

        if (status?.provider === 'mobile-litert') {
            const activeConfig = getActiveModelConfig();
            return {
                connected: true,
                text: `Running Locally (${activeConfig.shortName})`,
                dotClass: 'inline-block w-2 h-2 rounded-full bg-violet-500',
            };
        }

        return {
            connected: false,
            text: isMobileDevice ? 'Mobile Setup Required' : 'Ollama Offline (Tap to Launch)',
            dotClass: 'inline-block w-2 h-2 rounded-full bg-amber-500',
        };
    }

    function ensureBadgeStyles() {
        if (document.getElementById('gnosys-llm-badge-style')) return;
        const style = document.createElement('style');
        style.id = 'gnosys-llm-badge-style';
        style.textContent = `
            [data-llm-provider-badge] {
                display:inline-flex;
                align-items:center;
                gap:6px;
                font-size:11px;
                font-weight:700;
                border-radius:999px;
                padding:4px 10px;
                border:1px solid transparent;
                white-space:nowrap;
                cursor:pointer;
                transition:all 0.2s ease-in-out;
            }
            [data-llm-provider-badge]:hover {
                transform:scale(1.04);
                opacity:0.95;
            }
            [data-llm-provider-badge].gnosys-status--desktop {
                color:#22c55e;
                background:rgba(34,197,94,0.12);
                border-color:rgba(34,197,94,0.35);
            }
            [data-llm-provider-badge].gnosys-status--mobile {
                color:#8b5cf6;
                background:rgba(139,92,246,0.13);
                border-color:rgba(139,92,246,0.35);
            }
            [data-llm-provider-badge].gnosys-status--setup {
                color:#f59e0b;
                background:rgba(245,158,11,0.13);
                border-color:rgba(245,158,11,0.35);
            }
            .gnosys-seg-btn {
                background: transparent;
                border: none;
                border-radius: 9px;
                padding: 6px 12px;
                font-size: 0.72rem;
                font-weight: 700;
                color: #94a3b8;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
            }
            .gnosys-seg-btn.active {
                background: #1e293b;
                color: #f8fafc;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            #gnosys-llm-mobile-choice-card {
                max-width:560px;
                width:100%;
                max-height:calc(100vh - 32px);
                overflow-y:auto;
                background:#0f172a;
                border:1px solid #334155;
                border-radius:22px;
                padding:16px;
                color:#e2e8f0;
                box-shadow:0 20px 60px rgba(0,0,0,0.45);
                display:flex;
                flex-direction:column;
                gap:12px;
                box-sizing:border-box;
            }
            @media (min-width: 640px) {
                #gnosys-llm-mobile-choice-card {
                    padding:24px;
                    gap:16px;
                }
            }
            #gnosys-llm-mobile-choice-card::-webkit-scrollbar {
                width:6px;
            }
            #gnosys-llm-mobile-choice-card::-webkit-scrollbar-track {
                background:transparent;
            }
            #gnosys-llm-mobile-choice-card::-webkit-scrollbar-thumb {
                background:rgba(148,163,184,0.2);
                border-radius:9999px;
            }
            #gnosys-llm-mobile-choice-card::-webkit-scrollbar-thumb:hover {
                background:rgba(148,163,184,0.4);
            }
            .gnosys-profile-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                margin-top: 12px;
                margin-bottom: 12px;
            }
            .gnosys-profile-card {
                border: 1px solid #334155;
                background: rgba(15, 23, 42, 0.4);
                border-radius: 12px;
                padding: 10px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 82px;
            }
            .gnosys-profile-card.active {
                border-color: #14b8a6;
                background: rgba(20, 184, 166, 0.08);
                box-shadow: 0 0 12px rgba(20, 184, 166, 0.15);
            }
            .gnosys-profile-card-title {
                font-size: 0.74rem;
                font-weight: 800;
                color: #f8fafc;
                line-height: 1.2;
            }
            .gnosys-profile-card-badge {
                font-size: 0.58rem;
                font-weight: 800;
                background: #475569;
                color: #f8fafc;
                padding: 1px 4px;
                border-radius: 4px;
                margin-top: 4px;
                align-self: center;
                white-space: nowrap;
            }
            .gnosys-profile-card.active .gnosys-profile-card-badge {
                background: #14b8a6;
                color: #0f172a;
            }
            .gnosys-profile-card-desc {
                font-size: 0.62rem;
                color: #64748b;
                margin-top: 4px;
                line-height: 1.25;
            }
            .gnosys-profile-card.active .gnosys-profile-card-desc {
                color: #94a3b8;
            }
        `;
        document.head.appendChild(style);
    }

    function refreshStatusBadges() {
        ensureBadgeStyles();
        const badgeInfo = getProviderBadgeInfo(getStatus());
        const badges = document.querySelectorAll('[data-llm-provider-badge]');
        for (const badge of badges) {
            badge.textContent = badgeInfo.text;
            badge.classList.remove('gnosys-status--desktop', 'gnosys-status--mobile', 'gnosys-status--setup');
            badge.classList.add(badgeInfo.className);

            if (!badge.dataset.listenerAttached) {
                badge.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!isMobileDevice) {
                        const status = getStatus();
                        if (status.provider === 'desktop-ollama') {
                            if (typeof window.openChemistrySettingsModal === 'function') {
                                window.openChemistrySettingsModal();
                            } else {
                                showDesktopConnectionInfoModal();
                            }
                        } else {
                            showDesktopOllamaLaunchModal();
                        }
                    } else {
                        showMobileChoiceModal();
                    }
                });
                badge.dataset.listenerAttached = 'true';
            }
        }
    }

    function startBadgeRefreshLoop() {
        refreshStatusBadges();
        if (state.badgeIntervalId) return;
        state.badgeIntervalId = window.setInterval(() => {
            refreshStatusBadges();
        }, 2500);
    }

    async function showDesktopOllamaLaunchModal() {
        if (document.getElementById('gnosys-desktop-ollama-modal')) return;

        const hw = await getClientHardwareInfo();

        const overlay = document.createElement('div');
        overlay.id = 'gnosys-desktop-ollama-modal';
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:100000',
            'background:rgba(2,6,23,0.72)',
            'backdrop-filter:blur(10px)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:16px',
        ].join(';');

        let warningBannerHtml = '';
        if (!hw.hasGamingGpu) {
            warningBannerHtml = `
                <div style="margin-bottom:16px;padding:10px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:12px;font-size:0.78rem;color:#fca5a5;text-align:left;line-height:1.4;">
                    <strong>⚠️ No Dedicated Gaming GPU Detected:</strong><br>
                    Ollama will run desktop models on your CPU, which will be extremely slow. We recommend running our WebGPU-accelerated models directly in your browser.
                </div>
            `;
        }

        let browserBtnHtml = '';
        if (hw.webGpuAvailable) {
            browserBtnHtml = `
                <button id="gnosys-desktop-launch-browser" style="border:1px solid #7c3aed;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#f5f3ff;font-size:0.85rem;font-weight:800;padding:12px 20px;border-radius:12px;cursor:pointer;transition:all 0.2s;flex:1;">
                    Run Locally in Browser
                </button>
            `;
        }

        let gpuDisplayStr = hw.gpuName.replace(/ANGLE \([^,]+, |, Direct3D.*$/g, '');
        if (hw.vramGb) {
            gpuDisplayStr += ` (${hw.vramGb}GB VRAM)`;
        }

        overlay.innerHTML = `
            <div style="max-width:480px;width:100%;background:#0f172a;border:1px solid #334155;border-radius:22px;padding:24px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;position:relative;">
                <button id="gnosys-desktop-launch-close" style="position:absolute;top:14px;right:14px;border:none;background:transparent;color:#94a3b8;font-size:1.1rem;cursor:pointer;padding:4px 8px;line-height:1;" aria-label="Close">✕</button>
                <div style="font-size:3rem;margin-bottom:12px;display:inline-block;animation:float 3s ease-in-out infinite;">🤖</div>
                <h3 style="margin:0 0 4px 0;font-size:1.2rem;font-weight:800;color:#f8fafc;">Local AI Connection Offline</h3>
                
                <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:12px;background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:10px;display:inline-flex;gap:12px;border:1px solid rgba(255,255,255,0.05);align-items:center;">
                    <span><strong>GPU:</strong> ${gpuDisplayStr}</span>
                    <span>|</span>
                    <span><strong>RAM:</strong> ~${Math.round(hw.ramGb)} GB</span>
                </div>


                ${warningBannerHtml}

                <p style="margin:0 0 20px 0;color:#94a3b8;font-size:0.88rem;line-height:1.5;">
                    Gnosys-AI could not reach Ollama at <span style="font-family:monospace;color:#14b8a6;">localhost:11434</span>.<br>
                    Would you like to start the Ollama application, or run models inside the browser sandbox?
                </p>
                
                <div id="gnosys-desktop-launch-status" style="display:none;font-size:0.8rem;color:#f59e0b;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);padding:10px;border-radius:10px;margin-bottom:16px;line-height:1.4;">
                    Searching and initiating Ollama launch...
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;gap:10px;width:100%;">
                        <button id="gnosys-desktop-launch-yes" style="border:1px solid #0f766e;background:linear-gradient(135deg,#0d9488,#0f766e);color:#ecfeff;font-size:0.85rem;font-weight:800;padding:12px 20px;border-radius:12px;cursor:pointer;transition:all 0.2s;flex:1;">
                            Launch Ollama App
                        </button>
                        ${browserBtnHtml}
                    </div>
                    <button id="gnosys-desktop-launch-cancel" style="border:1px solid #334155;background:#1e293b;color:#f8fafc;font-size:0.85rem;font-weight:800;padding:10px 20px;border-radius:12px;cursor:pointer;transition:all 0.2s;width:100%;">
                        Not Now (Disable local AI)
                    </button>
                </div>
                
                <div style="margin-top:16px;font-size:0.75rem;color:#64748b;">
                    Need Ollama? Download it free at <a href="https://ollama.com" target="_blank" style="color:#14b8a6;text-decoration:none;font-weight:700;">ollama.com</a>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('#gnosys-desktop-launch-close');
        const yesBtn = overlay.querySelector('#gnosys-desktop-launch-yes');
        const browserBtn = overlay.querySelector('#gnosys-desktop-launch-browser');
        const cancelBtn = overlay.querySelector('#gnosys-desktop-launch-cancel');
        const statusEl = overlay.querySelector('#gnosys-desktop-launch-status');
        let isLaunchingOllama = false;

        function closeHardwareModalAndOpenSmartSetup() {
            if (isLaunchingOllama) {
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.style.color = '#f59e0b';
                    statusEl.textContent = 'Ollama launch is in progress. Please wait for the connection check to finish.';
                }
                return;
            }
            overlay.remove();
            queueSmartSetupModal();
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', closeHardwareModalAndOpenSmartSetup);
        }

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeHardwareModalAndOpenSmartSetup();
            }
        });

        if (browserBtn) {
            browserBtn.addEventListener('click', () => {
                localStorage.setItem(STORAGE_KEYS.routeMode, 'mobile-ondevice');
                closeHardwareModalAndOpenSmartSetup();
                init();
            });
        }

        yesBtn.addEventListener('click', async () => {
            isLaunchingOllama = true;
            yesBtn.setAttribute('disabled', 'true');
            yesBtn.style.opacity = '0.5';
            yesBtn.textContent = 'Launching...';
            if (statusEl) statusEl.style.display = 'block';

            let apiSuccess = false;
            try {
                const response = await fetch('/api/launch-ollama', { method: 'POST' });
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        apiSuccess = true;
                        if (statusEl) statusEl.textContent = 'Ollama launcher triggered via local server. Waiting for connection...';
                    }
                }
            } catch (err) {
                console.warn('[GnosysLLM] Python server /api/launch-ollama call failed:', err);
            }

            if (!apiSuccess) {
                if (statusEl) statusEl.textContent = 'Local server unreachable. Invoking registered gnosys-ollama:// protocol...';
                try {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = 'gnosys-ollama://';
                    document.body.appendChild(iframe);
                    setTimeout(() => iframe.remove(), 1000);
                } catch (err) {
                    console.warn('[GnosysLLM] Custom protocol invocation failed:', err);
                }
            }

            let attempts = 0;
            const maxAttempts = 30;
            const pollInterval = window.setInterval(async () => {
                attempts++;
                const isUp = await probeOllamaTags();
                if (isUp) {
                    clearInterval(pollInterval);
                    if (statusEl) statusEl.style.color = '#22c55e';
                    if (statusEl) statusEl.textContent = '✓ Connected to Ollama successfully!';
                    setTimeout(() => {
                        overlay.remove();
                        queueSmartSetupModal({ force: true });
                        state.provider = createOllamaProvider();
                        setProvider('desktop-ollama');
                        state.mobileChoicePending = false;
                    }, 1000);
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    isLaunchingOllama = false;
                    yesBtn.removeAttribute('disabled');
                    yesBtn.style.opacity = '1';
                    yesBtn.textContent = 'Retry Launch';
                    if (statusEl) {
                        statusEl.style.color = '#ef4444';
                        statusEl.textContent = '✗ Ollama failed to start automatically. Please open the Ollama app manually.';
                    }
                } else {
                    if (statusEl) statusEl.textContent = `Waiting for Ollama to initialize... (attempt ${attempts}/30)`;
                }
            }, 1000);
        });

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            state.provider = createNoAiProvider();
            setProvider('no-ai');
            localStorage.setItem(STORAGE_KEYS.routeMode, 'no-ai');
        });
    }

    function showDesktopConnectionInfoModal() {
        if (document.getElementById('gnosys-desktop-connection-modal')) return;

        const activeModel = getActiveDesktopModel();
        const prettyName = getPrettyModelName(activeModel);

        const overlay = document.createElement('div');
        overlay.id = 'gnosys-desktop-connection-modal';
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:100000',
            'background:rgba(2,6,23,0.72)',
            'backdrop-filter:blur(10px)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:16px',
        ].join(';');

        overlay.innerHTML = `
            <div style="max-width:460px;width:100%;background:#0f172a;border:1px solid #334155;border-radius:22px;padding:24px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;position:relative;">
                <button id="gnosys-connection-modal-close" style="position:absolute;top:16px;right:16px;border:none;background:transparent;color:#94a3b8;font-size:1.1rem;cursor:pointer;transition:color 0.2s;" onmouseover="this.style.color='#f8fafc'" onmouseout="this.style.color='#94a3b8'">✕</button>
                <div style="font-size:3rem;margin-bottom:12px;display:inline-block;">💻</div>
                <h3 style="margin:0 0 10px 0;font-size:1.2rem;font-weight:800;color:#f8fafc;">Local AI Connection Info</h3>
                <p style="margin:0 0 20px 0;color:#94a3b8;font-size:0.88rem;line-height:1.5;">
                    Gnosys-AI is currently connected to your local desktop Ollama service.
                </p>
                
                <div style="background:rgba(30,41,59,0.5);border:1px solid #334155;border-radius:14px;padding:16px;margin-bottom:20px;text-align:left;">
                    <div style="margin-bottom:10px;">
                        <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;display:block;">Status</span>
                        <span style="font-size:0.88rem;font-weight:700;color:#22c55e;display:flex;align-items:center;gap:6px;">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span> Connected & Ready
                        </span>
                    </div>
                    <div style="margin-bottom:10px;">
                        <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;display:block;">Active Model</span>
                        <span style="font-size:0.88rem;font-weight:700;color:#14b8a6;">${prettyName} <span style="font-weight:normal;color:#64748b;font-size:0.75rem;">(${activeModel})</span></span>
                    </div>
                    <div>
                        <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;display:block;">Ollama Endpoint</span>
                        <span style="font-size:0.88rem;font-family:monospace;color:#f8fafc;">http://localhost:11434</span>
                    </div>
                </div>

                <div style="font-size:0.8rem;color:#94a3b8;line-height:1.4;margin-bottom:20px;text-align:left;background:rgba(20,184,166,0.06);border:1px solid rgba(20,184,166,0.15);padding:12px;border-radius:10px;">
                    💡 <strong>Privacy First:</strong> Model inference and processing are executed entirely on your hardware. No chat history or documents leave your computer.
                </div>

                <button id="gnosys-connection-modal-ok" style="width:100%;border:1px solid #334155;background:#1e293b;color:#f8fafc;font-size:0.85rem;font-weight:800;padding:12px;border-radius:12px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#1e293b'">
                    Done
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('#gnosys-connection-modal-close');
        const okBtn = overlay.querySelector('#gnosys-connection-modal-ok');

        const closeModal = () => overlay.remove();

        closeBtn.addEventListener('click', closeModal);
        okBtn.addEventListener('click', closeModal);
    }

    function showMobileChoiceModal() {
        if (state.modalEl) {
            state.modalEl.style.display = 'flex';
            refreshLocalFileStatus();
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'gnosys-llm-mobile-choice';
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:100000',
            'background:rgba(2,6,23,0.72)',
            'backdrop-filter:blur(10px)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:16px',
        ].join(';');

        const supportsWebGpu = state.isWebGpuSupported;
        const supportsFsa = 'showSaveFilePicker' in window || 'showOpenFilePicker' in window;

        let activeSelection = localStorage.getItem(STORAGE_KEYS.onDeviceSelectedModel) || 'gemma-4-e2b';
        let onDeviceStorageMode = localStorage.getItem(STORAGE_KEYS.onDeviceStorageMode) || 'localfile';
        
        let activeSetupTab = (localStorage.getItem(STORAGE_KEYS.routeMode) === 'desktop-ollama') ? 'ollama' : 'browser';
        let activeOllamaSelection = localStorage.getItem('gnosys_active_llm') || 'gemma4:e4b';
        if (activeOllamaSelection.startsWith('litert:')) {
            activeOllamaSelection = 'gemma4:e4b';
        }

        const ramGb = navigator.deviceMemory;
        const ramText = ramGb ? `Detected RAM: ~${Math.round(ramGb)} GB` : 'RAM: Unspecified';
        const isHighEnd = ramGb && ramGb >= 8;

        if (!localStorage.getItem(STORAGE_KEYS.onDeviceSelectedModel) && ramGb) {
            activeSelection = isHighEnd ? 'gemma-4-e4b' : 'gemma-4-e2b';
            localStorage.setItem(STORAGE_KEYS.onDeviceSelectedModel, activeSelection);
        }

        let downloadAbortController = null;

        function getModalHtml() {
            const activeConfig = getActiveModelConfig();
            const lastUsedMetaStr = localStorage.getItem(STORAGE_KEYS.onDeviceLocalFileMetadata);
            let lastUsedHtml = '';
            if (lastUsedMetaStr) {
                try {
                    const meta = JSON.parse(lastUsedMetaStr);
                    lastUsedHtml = `
                        <div id="gnosys-quick-reselect-card" style="border:1px dashed #8b5cf6;background:rgba(139,92,246,0.06);border-radius:10px;padding:8px;margin-bottom:8px;cursor:pointer;transition:all 0.2s;">
                            <div style="font-size:0.7rem;font-weight:800;color:#c084fc;margin-bottom:2px;">⚡ Quick Reload Detected</div>
                            <div style="font-size:0.68rem;color:#e2e8f0;line-height:1.2;">
                                Last used: <span style="font-family:monospace;color:#f8fafc;">${meta.name}</span> (~${(meta.size / 1e9).toFixed(2)} GB).
                            </div>
                            <div style="font-size:0.65rem;color:#a78bfa;margin-top:3px;">Tap here to quickly re-select this file from your device!</div>
                        </div>
                    `;
                } catch (_) {}
            }

            let segControlHtml = '';
            if (!isMobileDevice) {
                segControlHtml = `
                    <div class="gnosys-segmented-control" style="display:flex;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);padding:3px;border-radius:12px;margin-bottom:12px;width:100%;">
                        <button id="gnosys-toggle-browser" class="gnosys-seg-btn ${activeSetupTab === 'browser' ? 'active' : ''}" style="flex:1;">
                            Run in Browser (LiteRT)
                        </button>
                        <button id="gnosys-toggle-ollama" class="gnosys-seg-btn ${activeSetupTab === 'ollama' ? 'active' : ''}" style="flex:1;">
                            Run via Desktop App (Ollama)
                        </button>
                    </div>
                `;
            }

            let setupBodyHtml = '';
            if (activeSetupTab === 'browser') {
                setupBodyHtml = `
                    ${supportsWebGpu ? `
                        <!-- Option A: Dynamic Profiles Selection Grid -->
                        <div>
                            <div style="font-weight:700;font-size:.8rem;color:#94a3b8;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                                <span>1. Select Setup Profile</span>
                                <span id="gnosys-ram-indicator" style="font-size:0.72rem;font-weight:normal;opacity:0.8;background:rgba(20,184,166,0.15);color:#14b8a6;padding:1px 6px;border-radius:4px;">${ramText}</span>
                            </div>
                            <div class="gnosys-profile-grid">
                                <!-- Card 1: Ultra-Light -->
                                <div id="gnosys-profile-ultra" class="gnosys-profile-card ${activeSelection === 'smollm-135m-ultra' && onDeviceStorageMode === 'localfile' ? 'active' : ''}">
                                    <span class="gnosys-profile-card-title">Ultra-Light (135M)</span>
                                    <span class="gnosys-profile-card-badge">${ramGb && ramGb <= 4 ? '★ Recommended' : 'Ultra-Safe'}</span>
                                    <span class="gnosys-profile-card-desc">Fits under 250MB. Flawless on 4GB phones.</span>
                                </div>
                                
                                <!-- Card 2: Lite & Fast -->
                                <div id="gnosys-profile-lite" class="gnosys-profile-card ${activeSelection === 'gemma-4-e2b' && onDeviceStorageMode === 'localfile' ? 'active' : ''}">
                                    <span class="gnosys-profile-card-title">Lite & Fast (2.5B)</span>
                                    <span class="gnosys-profile-card-badge">${ramGb && ramGb > 4 && ramGb < 8 ? '★ Recommended' : 'Standard'}</span>
                                    <span class="gnosys-profile-card-desc">Balanced speed and memory optimization.</span>
                                </div>
                                
                                <!-- Card 3: Max Brain -->
                                <div id="gnosys-profile-pro" class="gnosys-profile-card ${activeSelection === 'gemma-4-e4b' && onDeviceStorageMode === 'localfile' ? 'active' : ''}">
                                    <span class="gnosys-profile-card-title">Max Brain (4.5B)</span>
                                    <span class="gnosys-profile-card-badge">${isHighEnd ? '★ Recommended' : '8GB+ RAM'}</span>
                                    <span class="gnosys-profile-card-desc">Richer dialogue, coding and deep logic.</span>
                                </div>
                                
                                <!-- Card 4: Zero Config -->
                                <div id="gnosys-profile-opfs" class="gnosys-profile-card ${activeSelection === 'gemma-4-e2b' && onDeviceStorageMode === 'opfs' ? 'active' : ''}">
                                    <span class="gnosys-profile-card-title">Zero Config (2.5B)</span>
                                    <span class="gnosys-profile-card-badge">Auto Sandbox</span>
                                    <span class="gnosys-profile-card-desc">One-click instant browser download.</span>
                                </div>
                            </div>
                        </div>

                        <!-- 2. Dynamic Action Panel based on selected profile -->
                        <div style="background:rgba(30,41,59,0.3);border:1px solid #1e293b;border-radius:14px;padding:12px;">
                            ${onDeviceStorageMode === 'localfile' ? `
                                <!-- SD Card Mode Panel -->
                                ${supportsFsa ? `
                                    <div style="margin-bottom:8px;font-size:0.75rem;line-height:1.3;color:#94a3b8;">
                                        Stream model directly to avoid storage sandbox memory limits. Select a target directory (e.g. an external SD Card) to download and run.
                                    </div>
                                    
                                    <div id="gnosys-fsa-status" style="font-size:0.72rem;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:8px;margin-bottom:10px;color:#94a3b8;">
                                        Checking storage target...
                                    </div>

                                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                                        <button id="gnosys-fsa-savepicker-btn" style="border:1px solid #0f766e;background:linear-gradient(135deg,#0d9488,#0f766e);color:#ecfeff;font-size:0.75rem;font-weight:800;padding:10px;border-radius:10px;cursor:pointer;transition:all 0.2s;">
                                            Select Folder & Stream
                                        </button>
                                        <button id="gnosys-fsa-openpicker-btn" style="border:1px solid #334155;background:#1e293b;color:#f8fafc;font-size:0.75rem;font-weight:800;padding:10px;border-radius:10px;cursor:pointer;transition:all 0.2s;">
                                            Link Existing File
                                        </button>
                                    </div>
                                ` : `
                                    <div style="margin-bottom:8px;font-size:0.75rem;line-height:1.3;color:#94a3b8;">
                                        Web File System APIs are unavailable on this browser. You can download the model natively and pick it from your device:
                                    </div>

                                    ${lastUsedHtml}

                                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                                        <a href="${activeConfig.url}" download="${activeConfig.filename}" style="text-decoration:none;text-align:center;border:1px solid #8b5cf6;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#f8fafc;font-size:0.75rem;font-weight:800;padding:10px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                                            Download File
                                        </a>
                                        <button id="gnosys-manual-input-btn" style="border:1px solid #334155;background:#1e293b;color:#f8fafc;font-size:0.75rem;font-weight:800;padding:10px;border-radius:10px;cursor:pointer;">
                                            Select Loaded File
                                        </button>
                                    </div>
                                    <input type="file" id="gnosys-local-file-input" accept=".litertlm" style="display:none;" />
                                `}
                            ` : `
                                <!-- OPFS Sandbox Panel -->
                                <div style="border:1px solid rgba(127,29,29,0.3);background:rgba(127,29,29,0.15);color:#fecaca;padding:8px 10px;border-radius:8px;font-size:0.72rem;line-height:1.3;margin-bottom:10px;">
                                    ⚠️ OPFS Mode downloads and saves the model inside the browser's hidden sandbox. This is prone to mobile storage quota limits.
                                </div>
                                <button id="gnosys-ondevice-btn" style="border:1px solid #0f766e;background:linear-gradient(135deg,#0d9488,#0f766e);color:#ecfeff;padding:12px;border-radius:10px;cursor:pointer;width:100%;font-weight:800;font-size:0.8rem;text-align:center;">
                                    Download & Setup Sandbox
                                </button>
                            `}

                            <!-- Integrated Progress Bar (shared across profiles) -->
                            <div id="gnosys-ondevice-progress" style="display:none;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:8px;margin-top:8px;">
                                <div id="gnosys-ondevice-progress-text" style="font-size:.72rem;color:#94a3b8;margin-bottom:6px;">Preparing setup...</div>
                                <div style="height:6px;background:#1e293b;border-radius:999px;overflow:hidden;">
                                    <div id="gnosys-ondevice-progress-bar" style="height:6px;width:0%;background:#14b8a6;transition:width .25s"></div>
                                </div>
                                <button id="gnosys-download-cancel-btn" style="border:none;background:transparent;color:#ef4444;font-size:0.7rem;font-weight:700;cursor:pointer;margin-top:6px;padding:0;">Cancel Setup</button>
                            </div>
                        </div>
                    ` : `
                        <div style="border:1px solid #7f1d1d;background:#3f1111;color:#fecaca;padding:12px 14px;border-radius:12px;font-size:.8rem;line-height:1.4">
                            WebGPU is not available on this browser/device, so on-device Gemma mode is unavailable here.
                        </div>
                    `}
                `;
            } else {
                setupBodyHtml = `
                    <div>
                        <div style="font-weight:700;font-size:.8rem;color:#94a3b8;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                            <span>1. Select Desktop Model Profile</span>
                            <span id="gnosys-ram-indicator" style="font-size:0.72rem;font-weight:normal;opacity:0.8;background:rgba(20,184,166,0.15);color:#14b8a6;padding:1px 6px;border-radius:4px;">${ramText}</span>
                        </div>
                        <div class="gnosys-profile-grid">
                            <!-- Card 1: Llama 3.2 3B -->
                            <div id="gnosys-profile-ollama-llama32" class="gnosys-profile-card ${activeOllamaSelection === 'llama3.2' ? 'active' : ''}">
                                <span class="gnosys-profile-card-title">Llama 3.2 (3B)</span>
                                <span class="gnosys-profile-card-badge">Fast & Smart</span>
                                <span class="gnosys-profile-card-desc">Recommended for basic/standard laptops. Low CPU/GPU footprint.</span>
                            </div>
                            
                            <!-- Card 2: Llama 3 8B -->
                            <div id="gnosys-profile-ollama-llama3" class="gnosys-profile-card ${activeOllamaSelection === 'llama3' ? 'active' : ''}">
                                <span class="gnosys-profile-card-title">Llama 3 (8B)</span>
                                <span class="gnosys-profile-card-badge">Classic Balanced</span>
                                <span class="gnosys-profile-card-desc">Standard performance for gaming GPUs (6GB+ VRAM).</span>
                            </div>
                            
                            <!-- Card 3: Qwen 2.5 7B -->
                            <div id="gnosys-profile-ollama-qwen25" class="gnosys-profile-card ${activeOllamaSelection === 'qwen2.5' ? 'active' : ''}">
                                <span class="gnosys-profile-card-title">Qwen 2.5 (7B)</span>
                                <span class="gnosys-profile-card-badge">Coding & Logic</span>
                                <span class="gnosys-profile-card-desc">Highly capable reasoning and code comprehension. Requires 6GB+ VRAM.</span>
                            </div>
                            
                            <!-- Card 4: Gemma 4 Pro 4.5B -->
                            <div id="gnosys-profile-ollama-gemma4" class="gnosys-profile-card ${activeOllamaSelection === 'gemma4:e4b' ? 'active' : ''}">
                                <span class="gnosys-profile-card-title">Gemma 4 Pro (4.5B)</span>
                                <span class="gnosys-profile-card-badge">Pro Reasoning</span>
                                <span class="gnosys-profile-card-desc">Rich Socratic dialogue. Requires premium gaming GPUs (11GB+ VRAM).</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background:rgba(30,41,59,0.3);border:1px solid #1e293b;border-radius:14px;padding:12px;margin-top:10px;text-align:center;">
                        <div style="font-size:0.75rem;line-height:1.3;color:#94a3b8;margin-bottom:10px;">
                            Requires the desktop <a href="https://ollama.com" target="_blank" style="color:#14b8a6;text-decoration:none;font-weight:700;">Ollama application</a> to be running on your system.
                        </div>
                        <button id="gnosys-activate-ollama-btn" style="border:1px solid #0f766e;background:linear-gradient(135deg,#0d9488,#0f766e);color:#ecfeff;padding:12px;border-radius:10px;cursor:pointer;width:100%;font-weight:800;font-size:0.8rem;text-align:center;box-shadow: 0 4px 12px rgba(13,148,136,0.15);transition:all 0.2s;">
                            Select & Activate Profile
                        </button>
                    </div>
                `;
            }

            return `
            <div id="gnosys-llm-mobile-choice-card">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:12px;">
                    <div>
                        <h2 style="margin:0 0 4px 0;font-size:1.1rem;font-weight:800;color:#f8fafc">Smart LLM Setup</h2>
                        <p style="margin:0;color:#94a3b8;font-size:.82rem;line-height:1.3">Select your local AI configuration profile below.</p>
                    </div>
                    <button id="gnosys-llm-modal-close" style="border:none;background:transparent;color:#94a3b8;font-size:1.1rem;cursor:pointer;padding:4px 8px;">✕</button>
                </div>

                ${segControlHtml}

                <div style="margin-top:4px;display:grid;gap:10px;">
                    ${setupBodyHtml}

                    <!-- Sleek Offline Skip Button -->
                    <button id="gnosys-noai-btn" style="border:1px solid #334155;background:transparent;color:#94a3b8;font-size:0.75rem;font-weight:600;padding:10px;border-radius:10px;cursor:pointer;width:100%;text-align:center;transition:all 0.2s ease;margin-top:4px;">
                        Continue Offline (No local AI)
                    </button>
                </div>
            </div>
            `;
        }

        overlay.innerHTML = getModalHtml();
        document.body.appendChild(overlay);
        state.modalEl = overlay;

        // FSA status management
        async function refreshLocalFileStatus() {
            if (!supportsFsa || activeSetupTab !== 'browser') return;
            const statusEl = overlay.querySelector('#gnosys-fsa-status');
            if (!statusEl) return;

            const activeConfig = getActiveModelConfig();
            try {
                const handle = await getFileHandle(activeConfig.id);
                if (handle) {
                    const permission = await handle.queryPermission({ mode: 'read' });
                    statusEl.innerHTML = `
                        <div style="color:#14b8a6;font-weight:800;margin-bottom:2px;">✓ Target Storage Configured</div>
                        File: <span style="font-family:monospace;color:#f8fafc;">${handle.name}</span><br>
                        Permission Status: <span style="font-weight:bold;color:${permission === 'granted' ? '#22c55e' : '#f59e0b'};">${permission.toUpperCase()}</span>
                    `;
                } else {
                    statusEl.innerHTML = `
                        <div style="color:#ef4444;font-weight:800;margin-bottom:2px;">✗ Target Storage Not Configured</div>
                        No local file handle has been linked yet.
                    `;
                }
            } catch (err) {
                statusEl.textContent = 'Error checking local storage target.';
            }
        }

        // Run status check
        refreshLocalFileStatus();

        // Wire listeners
        function setupEventListeners() {
            const closeBtn = overlay.querySelector('#gnosys-llm-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true') {
                        alert('Download is currently in progress. Please wait for completion.');
                        return;
                    }
                    overlay.style.display = 'none';
                    state.modalEl = null;
                    overlay.remove();
                });
            }

            // Tab control toggle events
            const toggleBrowser = overlay.querySelector('#gnosys-toggle-browser');
            const toggleOllama = overlay.querySelector('#gnosys-toggle-ollama');
            
            function reRenderModal() {
                const card = document.getElementById('gnosys-llm-mobile-choice-card');
                if (card) {
                    const temp = document.createElement('div');
                    temp.innerHTML = getModalHtml();
                    card.replaceWith(temp.firstElementChild);
                    setupEventListeners();
                    refreshLocalFileStatus();
                }
            }

            if (toggleBrowser) {
                toggleBrowser.addEventListener('click', () => {
                    if (activeSetupTab === 'browser') return;
                    activeSetupTab = 'browser';
                    reRenderModal();
                });
            }
            if (toggleOllama) {
                toggleOllama.addEventListener('click', () => {
                    if (activeSetupTab === 'ollama') return;
                    activeSetupTab = 'ollama';
                    reRenderModal();
                });
            }

            // Tab-specific elements
            if (activeSetupTab === 'browser') {
                const profileUltra = overlay.querySelector('#gnosys-profile-ultra');
                const profileLite = overlay.querySelector('#gnosys-profile-lite');
                const profilePro = overlay.querySelector('#gnosys-profile-pro');
                const profileOpfs = overlay.querySelector('#gnosys-profile-opfs');

                function updateProfile(model, storageMode) {
                    activeSelection = model;
                    onDeviceStorageMode = storageMode;
                    localStorage.setItem(STORAGE_KEYS.onDeviceSelectedModel, model);
                    localStorage.setItem(STORAGE_KEYS.onDeviceStorageMode, storageMode);
                    reRenderModal();
                }

                if (profileUltra) {
                    profileUltra.addEventListener('click', () => {
                        if (localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true') return;
                        updateProfile('smollm-135m-ultra', 'localfile');
                    });
                }
                if (profileLite) {
                    profileLite.addEventListener('click', () => {
                        if (localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true') return;
                        updateProfile('gemma-4-e2b', 'localfile');
                    });
                }
                if (profilePro) {
                    profilePro.addEventListener('click', () => {
                        if (localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true') return;
                        updateProfile('gemma-4-e4b', 'localfile');
                    });
                }
                if (profileOpfs) {
                    profileOpfs.addEventListener('click', () => {
                        if (localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true') return;
                        updateProfile('gemma-4-e2b', 'opfs');
                    });
                }

                const fsaSaveBtn = overlay.querySelector('#gnosys-fsa-savepicker-btn');
                const fsaOpenBtn = overlay.querySelector('#gnosys-fsa-openpicker-btn');
                const progressWrap = overlay.querySelector('#gnosys-ondevice-progress');
                const progressText = overlay.querySelector('#gnosys-ondevice-progress-text');
                const progressBar = overlay.querySelector('#gnosys-ondevice-progress-bar');
                const cancelBtn = overlay.querySelector('#gnosys-download-cancel-btn');

                const finalizeLiteRtSetup = async (message, toastMessage = message) => {
                    const finalMessage = String(message || 'Download complete / Model ready').trim();
                    if (progressWrap) progressWrap.style.display = 'block';
                    if (progressBar) {
                        progressBar.style.width = '100%';
                        progressBar.classList.remove('animate-pulse');
                    }
                    if (progressText) {
                        progressText.textContent = finalMessage;
                        progressText.style.color = '#22c55e';
                        progressText.style.fontWeight = '800';
                    }

                    emitLiteRtSetupStatus({
                        state: 'success',
                        message: finalMessage,
                    });

                    await new Promise((resolve) => setTimeout(resolve, 900));
                    overlay.style.display = 'none';
                    state.modalEl = null;
                    overlay.remove();
                    showTransientToast(toastMessage || finalMessage, 'success');
                };

                if (fsaSaveBtn) {
                    fsaSaveBtn.addEventListener('click', async () => {
                        const activeConfig = getActiveModelConfig();
                        if (activeConfig.id === 'gemma-4-e4b' && navigator.deviceMemory && navigator.deviceMemory < 8) {
                            const confirmPro = confirm("Warning: Gemma 4 Pro requires at least 8GB RAM. Your device reports less than 8GB, which may cause your browser tab to crash during initialization.\n\nWe highly recommend using the Gemma 4 Efficient tier instead. Are you sure you want to proceed?");
                            if (!confirmPro) return;
                        }

                        try {
                            const options = {
                                suggestedName: activeConfig.filename,
                                startIn: 'downloads',
                                types: [{
                                    description: 'LiteRT LM model (.litertlm)',
                                    accept: { 'application/octet-stream': ['.litertlm'] }
                                }]
                            };
                            const handle = await window.showSaveFilePicker(options);
                            await saveFileHandle(activeConfig.id, handle);
                            refreshLocalFileStatus();

                            // Start piping the stream directly to the target file
                            if (progressWrap) progressWrap.style.display = 'block';
                            localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'true');
                            downloadAbortController = new AbortController();

                            const res = await fetch(activeConfig.url, {
                                signal: downloadAbortController.signal
                            });

                            if (!res.ok || !res.body) {
                                throw new Error('Network error; failed to retrieve model file stream.');
                            }

                            if (progressText) progressText.textContent = 'Streaming model directly to target file...';

                            await writeStreamToFileHandle(res.body, handle, (info) => {
                                if (progressBar && progressText) {
                                    progressBar.style.width = `${info.percent}%`;
                                    progressText.textContent = `Streaming model directly to selected folder: ${info.percent}%`;
                                }
                            }, { total: activeConfig.expectedSize });

                            // Verify & complete
                            localStorage.setItem(STORAGE_KEYS.onDeviceReady, 'true');
                            localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'false');
                            localStorage.setItem(STORAGE_KEYS.onDeviceExpectedSize, String(activeConfig.expectedSize));
                            localStorage.setItem(STORAGE_KEYS.routeMode, 'mobile-ondevice');

                            const provider = createLiteRtProvider();
                            await provider.ensureReady((info) => {
                                if (progressText && progressBar) {
                                    if (info.stage === 'compiling') {
                                        progressText.textContent = 'Optimizing GPU shaders & allocating VRAM... (takes 10-25s)';
                                    }
                                }
                            });

                            state.provider = provider;
                            state.mobileChoicePending = false;
                            setProvider('mobile-litert');
                            await finalizeLiteRtSetup('Download complete / Model ready', 'LiteRT model is ready to use.');
                        } catch (err) {
                            if (err.name === 'AbortError') {
                                if (progressText) progressText.textContent = 'Download cancelled.';
                                emitLiteRtSetupStatus({ state: 'info', message: 'LiteRT setup cancelled.' });
                            } else {
                                console.error('[GnosysLLM] Direct stream setup failed:', err);
                                alert(`Storage setup failed: ${err.message || err}`);
                                emitLiteRtSetupStatus({
                                    state: 'error',
                                    message: `LiteRT setup failed: ${err.message || err}`,
                                });
                            }
                            localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'false');
                            if (progressWrap) progressWrap.style.display = 'none';
                            refreshLocalFileStatus();
                        }
                    });
                }

                if (fsaOpenBtn) {
                    fsaOpenBtn.addEventListener('click', async () => {
                        const activeConfig = getActiveModelConfig();
                        try {
                            const [handle] = await window.showOpenFilePicker({
                                types: [{
                                    description: 'LiteRT LM model (.litertlm)',
                                    accept: { 'application/octet-stream': ['.litertlm'] }
                                }]
                            });
                            await saveFileHandle(activeConfig.id, handle);
                            
                            // Instantly initialize local provider
                            localStorage.setItem(STORAGE_KEYS.onDeviceReady, 'true');
                            localStorage.setItem(STORAGE_KEYS.routeMode, 'mobile-ondevice');
                            localStorage.setItem(STORAGE_KEYS.onDeviceExpectedSize, String(activeConfig.expectedSize));
                            
                            if (progressWrap) progressWrap.style.display = 'block';
                            if (progressText) progressText.textContent = 'Initializing WebGPU engine & warm VRAM...';

                            const provider = createLiteRtProvider();
                            await provider.ensureReady((info) => {
                                if (progressText && progressBar) {
                                    if (info.stage === 'compiling') {
                                        progressText.textContent = 'Optimizing GPU shaders & warm VRAM... (takes 10-25s)';
                                    }
                                }
                            });

                            state.provider = provider;
                            state.mobileChoicePending = false;
                            setProvider('mobile-litert');
                            await finalizeLiteRtSetup('Download complete / Model ready', 'LiteRT model is ready to use.');
                        } catch (err) {
                            console.error('[GnosysLLM] Local file linking failed:', err);
                            alert(`File linking failed: ${err.message || err}`);
                            emitLiteRtSetupStatus({
                                state: 'error',
                                message: `LiteRT setup failed: ${err.message || err}`,
                            });
                        }
                    });
                }

                // Tab 1 Standard File Input handlers (Safari / iOS Fallback)
                const manualBtn = overlay.querySelector('#gnosys-manual-input-btn');
                const fileInput = overlay.querySelector('#gnosys-local-file-input');
                const quickCard = overlay.querySelector('#gnosys-quick-reselect-card');

                if (manualBtn && fileInput) {
                    manualBtn.addEventListener('click', () => {
                        fileInput.click();
                    });
                }

                if (quickCard && fileInput) {
                    quickCard.addEventListener('click', () => {
                        fileInput.click();
                    });
                }

                if (fileInput) {
                    fileInput.addEventListener('change', async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        selectedLocalFile = file;

                        // Save metadata representation in localStorage for fast reload
                        const meta = { name: file.name, size: file.size, lastModified: file.lastModified };
                        localStorage.setItem(STORAGE_KEYS.onDeviceLocalFileMetadata, JSON.stringify(meta));

                        // Instantly initialize
                        const activeConfig = getActiveModelConfig();
                        localStorage.setItem(STORAGE_KEYS.onDeviceReady, 'true');
                        localStorage.setItem(STORAGE_KEYS.routeMode, 'mobile-ondevice');
                        localStorage.setItem(STORAGE_KEYS.onDeviceExpectedSize, String(file.size));

                        if (progressWrap) progressWrap.style.display = 'block';
                        if (progressText) progressText.textContent = 'Loading local file reference & warm WebGPU VRAM...';

                        try {
                            const provider = createLiteRtProvider();
                            await provider.ensureReady((info) => {
                                if (progressText) {
                                    if (info.stage === 'compiling') {
                                        progressText.textContent = 'Optimizing GPU shaders & VRAM allocation... (takes 10-25s)';
                                    }
                                }
                            });

                            state.provider = provider;
                            state.mobileChoicePending = false;
                            setProvider('mobile-litert');
                            overlay.style.display = 'none';
                            state.modalEl = null;
                            overlay.remove();
                        } catch (err) {
                            console.error('[GnosysLLM] iOS Fallback initialization failed:', err);
                            alert(`Initialization failed: ${err.message || err}`);
                            if (progressWrap) progressWrap.style.display = 'none';
                        }
                    });
                }

                // Tab 2 OPFS Setup Handlers
                const onDeviceBtn = overlay.querySelector('#gnosys-ondevice-btn');
                if (onDeviceBtn) {
                    onDeviceBtn.addEventListener('click', async () => {
                        const activeConfig = getActiveModelConfig();
                        if (activeConfig.id === 'gemma-4-e4b' && navigator.deviceMemory && navigator.deviceMemory < 8) {
                            const confirmPro = confirm("Warning: Gemma 4 Pro requires at least 8GB RAM. Your device reports less than 8GB, which may cause your browser tab to crash during initialization.\n\nWe highly recommend using the Gemma 4 Efficient tier instead. Are you sure you want to download Pro?");
                            if (!confirmPro) return;
                        }

                        if (progressWrap) progressWrap.style.display = 'block';
                        localStorage.setItem(STORAGE_KEYS.routeMode, 'mobile-ondevice');
                        localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'true');

                        try {
                            await invalidateStaleOnDeviceCache();
                            const provider = createLiteRtProvider();
                            await provider.ensureReady((info) => {
                                if (!progressText || !progressBar) return;
                                const pct = typeof info.percent === 'number' ? info.percent : 0;
                                progressBar.style.width = `${pct}%`;
                                if (info.stage === 'finalizing') {
                                    progressText.textContent = 'Verifying storage & finalizing file sync...';
                                    progressBar.classList.add('animate-pulse');
                                } else if (info.stage === 'cooling') {
                                    progressText.textContent = 'Releasing download memory & cleaning up...';
                                    progressBar.classList.add('animate-pulse');
                                } else if (info.stage === 'compiling') {
                                    progressText.textContent = `Optimizing GPU shaders & allocating VRAM... (takes 10-25s)`;
                                    progressBar.classList.add('animate-pulse');
                                } else {
                                    progressText.textContent = `Downloading Gemma 4 ${activeConfig.shortName}: ${pct}%`;
                                    progressBar.classList.remove('animate-pulse');
                                }
                            });

                            state.provider = provider;
                            state.mobileChoicePending = false;
                            localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'false');
                            setProvider('mobile-litert');
                            await finalizeLiteRtSetup('Download complete / Model ready', 'LiteRT model is ready to use.');
                        } catch (err) {
                            console.error('[GnosysLLM] OPFS setup failed:', err);
                            localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'false');
                            const detail = String(err?.message || err || 'Unknown OPFS error');
                            if (progressText) progressText.textContent = `Setup failed: ${detail}`;
                            alert(`LiteRT OPFS Error: ${detail}`);
                            emitLiteRtSetupStatus({
                                state: 'error',
                                message: `LiteRT setup failed: ${detail}`,
                            });
                        }
                    });
                }

                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        if (downloadAbortController) {
                            try {
                                downloadAbortController.abort();
                                console.log('[GnosysLLM] Download stream explicitly aborted by user.');
                            } catch (_) {}
                        }
                        localStorage.setItem(STORAGE_KEYS.onDeviceDownloadInProgress, 'false');
                        if (progressWrap) progressWrap.style.display = 'none';
                        refreshLocalFileStatus();
                    });
                }
            } else {
                const profileOllamaLlama32 = overlay.querySelector('#gnosys-profile-ollama-llama32');
                const profileOllamaLlama3 = overlay.querySelector('#gnosys-profile-ollama-llama3');
                const profileOllamaQwen25 = overlay.querySelector('#gnosys-profile-ollama-qwen25');
                const profileOllamaGemma4 = overlay.querySelector('#gnosys-profile-ollama-gemma4');
                const activateOllamaBtn = overlay.querySelector('#gnosys-activate-ollama-btn');

                if (profileOllamaLlama32) {
                    profileOllamaLlama32.addEventListener('click', () => {
                        activeOllamaSelection = 'llama3.2';
                        highlightOllamaCard('llama3.2');
                    });
                }
                if (profileOllamaLlama3) {
                    profileOllamaLlama3.addEventListener('click', () => {
                        activeOllamaSelection = 'llama3';
                        highlightOllamaCard('llama3');
                    });
                }
                if (profileOllamaQwen25) {
                    profileOllamaQwen25.addEventListener('click', () => {
                        activeOllamaSelection = 'qwen2.5';
                        highlightOllamaCard('qwen2.5');
                    });
                }
                if (profileOllamaGemma4) {
                    profileOllamaGemma4.addEventListener('click', () => {
                        activeOllamaSelection = 'gemma4:e4b';
                        highlightOllamaCard('gemma4:e4b');
                    });
                }

                function highlightOllamaCard(modelVal) {
                    const cards = {
                        'llama3.2': profileOllamaLlama32,
                        'llama3': profileOllamaLlama3,
                        'qwen2.5': profileOllamaQwen25,
                        'gemma4:e4b': profileOllamaGemma4
                    };
                    Object.keys(cards).forEach(key => {
                        if (cards[key]) {
                            if (key === modelVal) {
                                cards[key].classList.add('active');
                            } else {
                                cards[key].classList.remove('active');
                            }
                        }
                    });
                }

                if (activateOllamaBtn) {
                    activateOllamaBtn.addEventListener('click', () => {
                        localStorage.setItem(STORAGE_KEYS.routeMode, 'desktop-ollama');
                        localStorage.setItem('gnosys_active_llm', activeOllamaSelection);
                        localStorage.setItem('chemistry_llm', activeOllamaSelection);
                        overlay.remove();
                        state.modalEl = null;
                        init();
                    });
                }
            }

            // Option B: No-AI offline handler
            const noAiBtn = overlay.querySelector('#gnosys-noai-btn');
            if (noAiBtn) {
                noAiBtn.addEventListener('click', async () => {
                    if (localStorage.getItem(STORAGE_KEYS.onDeviceDownloadInProgress) === 'true') {
                        alert('Cannot switch modes while download is in progress.');
                        return;
                    }
                    if (state.provider && typeof state.provider.close === 'function') {
                        await state.provider.close();
                    }
                    localStorage.setItem(STORAGE_KEYS.routeMode, 'no-ai');
                    state.provider = createNoAiProvider();
                    state.mobileChoicePending = false;
                    setProvider('no-ai');
                    overlay.style.display = 'none';
                    state.modalEl = null;
                    overlay.remove();
                });
            }
        }

        setupEventListeners();
    }
})();
