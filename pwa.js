// ============================================================
// KaryaOne ACM - PWA Registration & Offline Queue
// ============================================================

const PWA = {
    swRegistration: null,
    isOnline: navigator.onLine,

    async init() {
        // Register Service Worker
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('[PWA] SW registered:', this.swRegistration.scope);

                // Listen for SW messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data.type === 'attendance-synced') {
                        showToast(event.data.payload.message, 'success');
                        // Refresh data
                        if (typeof fetchAllDataFromSupabase === 'function') {
                            fetchAllDataFromSupabase();
                        }
                    }
                });
            } catch (err) {
                console.warn('[PWA] SW registration failed:', err);
            }
        }

        // Online/Offline listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            showToast('Koneksi internet tersambung. Menyinkronkan data...', 'success');
            this.syncQueue();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            showToast('Anda offline. Data akan disimpan dan dikirim saat online.', 'warning');
        });

        // Update online status badge
        this.updateNetworkBadge();
    },

    updateNetworkBadge() {
        const badge = document.getElementById('network-status-badge');
        if (!badge) return;
        if (this.isOnline) {
            badge.innerHTML = '<i class="fa-solid fa-wifi"></i> Online';
            badge.className = 'text-emerald-400 font-semibold text-[11px]';
        } else {
            badge.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> Offline';
            badge.className = 'text-rose-400 font-semibold text-[11px]';
        }
    },

    // ─── Queue absen saat offline ───
    async queueAttendance(record, blob) {
        const db = await this.openDB();
        const tx = db.transaction('attendance_queue', 'readwrite');
        const store = tx.objectStore('attendance_queue');

        // Convert blob to base64 untuk storage
        const base64 = await this.blobToBase64(blob);

        await store.add({
            type: 'check_in',
            record: record,
            selfieBase64: base64,
            timestamp: Date.now(),
            synced: false
        });

        // Request background sync
        if (this.swRegistration && 'sync' in this.swRegistration) {
            await this.swRegistration.sync.register('sync-attendance');
        }

        showToast('Absen disimpan offline. Akan dikirim saat online.', 'info');
    },

    async syncQueue() {
        if (!this.isOnline) return;

        const db = await this.openDB();
        const tx = db.transaction('attendance_queue', 'readonly');
        const store = tx.objectStore('attendance_queue');
        const requests = await store.getAll();

        for (const req of requests.filter(r => !r.synced)) {
            try {
                // Reconstruct blob dari base64
                const blob = this.base64ToBlob(req.selfieBase64, 'image/jpeg');
                const fileName = AppUtils.generateSelfieFileName(req.record.date, req.record.name);

                // Upload selfie
                await DB.storage.uploadSelfie(blob, fileName);
                const selfieUrl = await DB.storage.getPublicUrl(fileName);
                req.record.selfie_url = selfieUrl;

                // Insert ke DB
                await DB.attendance.checkIn(req.record);

                // Mark as synced
                const delTx = db.transaction('attendance_queue', 'readwrite');
                await delTx.objectStore('attendance_queue').delete(req.id);
            } catch (err) {
                console.warn('[PWA] Sync item failed:', err);
            }
        }
    },

    // ─── Push Notification ───
    async subscribePush() {
        if (!this.swRegistration) return;
        try {
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(
                    'YOUR_VAPID_PUBLIC_KEY_HERE' // Ganti dengan VAPID key dari FCM
                )
            });
            // Kirim subscription ke server
            await supabaseClient.from('push_subscriptions').insert([{
                user_id: activeEmployeeSession.id,
                subscription: JSON.stringify(subscription)
            }]);
            console.log('[PWA] Push subscribed');
        } catch (err) {
            console.warn('[PWA] Push subscription failed:', err);
        }
    },

    // ─── IndexedDB helpers ───
    openDB() {
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
    },

    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },

    base64ToBlob(base64, type) {
        const byteString = atob(base64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type });
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
};

// Auto-init saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    PWA.init();
});

window.PWA = PWA;
