// sw.js - Gnosys-AI High-Performance OPFS & FSA Streaming Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Only intercept same-origin requests to prevent interfering with Hugging Face downloads
    if (url.origin !== self.location.origin) {
        return;
    }
    
    // Intercept model files
    if (url.pathname.endsWith('.litertlm') || url.pathname.includes('/models/')) {
        event.respondWith((async () => {
            try {
                // Extract the filename from the URL path
                const filename = url.pathname.split('/').pop();
                
                let file;
                if (filename.startsWith('local-')) {
                    // Local File System Access API (SD Card / Direct File) mode
                    // Extract model ID from e.g. "local-gemma-4-e2b.litertlm" -> "gemma-4-e2b"
                    const modelId = filename.replace('local-', '').replace('.litertlm', '');
                    
                    // Retrieve handle from IndexedDB
                    const handle = await getFileHandleFromIndexedDB(modelId);
                    if (!handle) {
                        throw new Error(`File handle for model ID "${modelId}" not found in IndexedDB.`);
                    }
                    file = await handle.getFile();
                } else {
                    // Standard OPFS Sandbox mode
                    const root = await navigator.storage.getDirectory();
                    const handle = await root.getFileHandle(filename, { create: false });
                    file = await handle.getFile();
                }
                
                // Return a streamed response directly from File.stream()
                // This keeps memory allocations under 20MB!
                return new Response(file.stream(), {
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': file.size,
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            } catch (err) {
                console.warn('[GnosysSW] SW stream fallback to network:', err);
                return fetch(event.request);
            }
        })());
    }
});

// Helper function to read from IndexedDB in the Service Worker context
function getFileHandleFromIndexedDB(key) {
    return new Promise((resolve) => {
        const request = indexedDB.open('gnosys_model_store', 1);
        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('handles')) {
                resolve(null);
                return;
            }
            try {
                const tx = db.transaction('handles', 'readonly');
                const store = tx.objectStore('handles');
                const getReq = store.get(key);
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        };
        request.onerror = () => resolve(null);
    });
}
