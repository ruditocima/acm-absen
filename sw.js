// ============================================================
// KaryaOne ACM - Service Worker
// Offline Support + Background Sync + Cache Strategy
// ============================================================

const CACHE_NAME = 'karyaone-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/config.js',
    '/state.js',
    '/utils.js',
    '/auth.js',
    '/attendance.js',
    '/services.js',
    '/data.js',
    '/leaves.js',
    '/email.js',
    '/rekap.js',
    '/dashboard.js',
    '/ui.js',
    '/app.js',
    '/pwa.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ─── Install: Cache static assets ───
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).catch((err) => {
            console.warn('[SW] Cache install failed:', err);
        })
    );
});

// ─── Activate: Clean old caches ───
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// ─── Fetch: Cache-first for static, network-first for API ───
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (handled by background sync)
    if (request.method !== 'GET') {
        return;
    }

    // API calls (Supabase) → Network first, fallback cache
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Static assets → Cache first, fallback network
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                return response;
            });
        })
    );
});

// ─── Background Sync: Queue absen offline ───
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-attendance') {
        event.waitUntil(syncAttendanceQueue());
    }
});

async function syncAttendanceQueue() {
    const db = await openIndexedDB();
    const tx = db.transaction('attendance_queue', 'readwrite');
    const store = tx.objectStore('attendance_queue');
    const requests = await store.getAll();

    for (const req of requests) {
        try {
            // Kirim ke Supabase via fetch
            const response = await fetch(req.url, {
                method: req.method,
                headers: req.headers,
                body: JSON.stringify(req.body)
            });

            if (response.ok) {
                await store.delete(req.id);
                // Notify client
                notifyClients('attendance-synced', { message: 'Absen offline berhasil disinkronkan!' });
            }
        } catch (err) {
            console.warn('[SW] Sync failed for item', req.id, err);
        }
    }
}

// ─── Push Notification handler ───
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'KaryaOne Notification';
    const options = {
        body: data.body || 'Ada notifikasi baru',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: data.tag || 'general',
        requireInteraction: data.requireInteraction || false,
        data: data.data || {}
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});

// ─── IndexedDB helpers ───
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('KaryaOneDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('attendance_queue')) {
                db.createObjectStore('attendance_queue', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('pending_emails')) {
                db.createObjectStore('pending_emails', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function notifyClients(type, payload) {
    self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type, payload }));
    });
}
