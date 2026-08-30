/**
 * Modul Pengelolaan Koneksi Realtime Supabase
 * Versi Definitif Enterprise (Bulletproof, Cycle-Aware & Fully Sanitized)
 */
(function() {
    // Cegah inisialisasi ganda jika skrip dimuat lebih dari sekali
    if (window.__supabaseRealtimeInitialized) {
        console.warn('Modul Realtime Supabase sudah diinisialisasi sebelumnya.');
        return;
    }
    window.__supabaseRealtimeInitialized = true;

    // Variabel global untuk melacak instance channel, timer, dan status kontrol
    let leavesChannel = null;
    let messagesChannel = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let initThrottleTimer = null;
    let isInitializing = false;
    let pendingInit = false; 
    let clockInterval = null;
    
    // ANTI-GHOST EVENT: Token untuk memastikan callback lama tidak memicu UI ganda
    let activeCycleId = 0; 

    function initSupabaseRealtime() {
        if (typeof supabaseClient === 'undefined' || typeof supabaseClient.channel !== 'function') {
            setTimeout(initSupabaseRealtime, 1000);
            return;
        }

        // 1. BATALKAN TIMER DULUAN: Mencegah timer leak jika dipanggil paksa
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // 2. MUTEX KONTROL: Cegah tumpang tindih
        if (isInitializing) {
            pendingInit = true;
            return;
        }
        isInitializing = true;

        try {
            const cleanupPromises = [];

            // Helper absolut aman (Anti-Crash) untuk menangkap error dari removeChannel
            const safeRemove = function(ch) {
                return new Promise(function(resolve) {
                    try {
                        if (ch && typeof supabaseClient.removeChannel === 'function') {
                            const p = supabaseClient.removeChannel(ch);
                            if (p && typeof p.then === 'function') {
                                p.then(resolve).catch(resolve);
                                return;
                            }
                        }
                    } catch (e) {
                        console.warn('Pengecualian saat menghapus channel:', e);
                    }
                    resolve(); 
                });
            };

            if (leavesChannel) cleanupPromises.push(safeRemove(leavesChannel));
            leavesChannel = null;

            if (messagesChannel) cleanupPromises.push(safeRemove(messagesChannel));
            messagesChannel = null;

            // Bersihkan channel liar dari instance client
            const existingChannels = (typeof supabaseClient.getChannels === 'function' ? supabaseClient.getChannels() : []) || [];
            existingChannels.forEach(function(ch) {
                if (ch && ch.topic && (ch.topic.includes('realtime-leaves-channel') || ch.topic.includes('realtime-messages-channel'))) {
                    cleanupPromises.push(safeRemove(ch));
                }
            });

            // 3. TIMEOUT RACE TERKELOLA: Bersihkan timer agar tidak bocor di memori
            let fallbackTimeoutId;
            const cleanupTimeout = new Promise(function(resolve) {
                fallbackTimeoutId = setTimeout(resolve, 2500); 
            });

            Promise.race([
                Promise.all(cleanupPromises),
                cleanupTimeout
            ]).then(function() {
                clearTimeout(fallbackTimeoutId);
                setupChannelSubscriptions();
            }).catch(function() {
                clearTimeout(fallbackTimeoutId);
                setupChannelSubscriptions(); 
            });

        } catch (syncErr) {
            console.error('Kesalahan sinkron saat pembersihan channel:', syncErr);
            setupChannelSubscriptions();
        }
    }

    function setupChannelSubscriptions() {
        let errorHandledInCycle = false;
        
        let leavesSettled = false;
        let messagesSettled = false;
        let leavesSuccess = false;
        let messagesSuccess = false;

        // Validasi Token Siklus (Cycle-Aware)
        activeCycleId++;
        const currentCycle = activeCycleId;
        let forceSettlementTimer = null;

        const clearAllTimers = function() {
            if (forceSettlementTimer) {
                clearTimeout(forceSettlementTimer);
                forceSettlementTimer = null;
            }
        };

        const checkAllSettled = function() {
            if (leavesSettled && messagesSettled) {
                clearAllTimers();
                isInitializing = false;
                
                if (leavesSuccess && messagesSuccess) {
                    reconnectAttempts = 0;
                }

                if (pendingInit) {
                    pendingInit = false;
                    initSupabaseRealtime();
                }
            }
        };

        // SAFETY GUARD: Pastikan timer aktif mengawasi sampai kedua channel selesai
        forceSettlementTimer = setTimeout(function() {
            if (currentCycle === activeCycleId && isInitializing) {
                console.warn('Peringatan: Timeout koneksi realtime tercapai, memaksa pembukaan kunci inisialisasi.');
                let forced = false;
                if (!leavesSettled) { leavesSettled = true; leavesSuccess = false; forced = true; }
                if (!messagesSettled) { messagesSettled = true; messagesSuccess = false; forced = true; }
                if (forced) {
                    checkAllSettled();
                }
            }
        }, 6000);

        const handleChannelError = function(channelName, status, err) {
            console.warn(`Koneksi ke ${channelName} bermasalah (Status: ${status}):`, err);
            
            if (!reconnectTimer) {
                if (!errorHandledInCycle) {
                    errorHandledInCycle = true;
                    reconnectAttempts++;
                    if (reconnectAttempts > 50) reconnectAttempts = 50;
                }

                const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 30000);
                
                reconnectTimer = setTimeout(function() {
                    reconnectTimer = null;
                    initSupabaseRealtime();
                }, delay);
            }
        };

        try {
            // Inisialisasi realtime-leaves-channel
            leavesChannel = supabaseClient.channel('realtime-leaves-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function(payload) {
                    if (currentCycle !== activeCycleId) return;
                    try {
                        if (!payload || (!payload.new && !payload.old)) return;
                        if (typeof renderAdminIzin === 'function') renderAdminIzin(payload);
                        if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
                    } catch (e) {
                        console.error('Error pada renderAdminIzin:', e);
                    }
                })
                .subscribe(function(status, err) {
                    if (currentCycle !== activeCycleId) return;
                    
                    if (status === 'SUBSCRIBED') {
                        if (!leavesSettled) {
                            leavesSettled = true;
                            leavesSuccess = true;
                            checkAllSettled();
                        }
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        if (!leavesSettled) {
                            leavesSettled = true;
                            leavesSuccess = false;
                            handleChannelError('realtime-leaves-channel', status, err);
                            checkAllSettled();
                        } else {
                            handleChannelError('realtime-leaves-channel', status, err);
                        }
                    }
                });

            // Inisialisasi realtime-messages-channel
            messagesChannel = supabaseClient.channel('realtime-messages-channel')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function(payload) {
                    if (currentCycle !== activeCycleId) return;
                    try {
                        if (!payload || !payload.new) return;
                        if (typeof renderEmails === 'function') renderEmails(payload);
                        if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
                    } catch (e) {
                        console.error('Error pada renderEmails:', e);
                    }
                })
                .subscribe(function(status, err) {
                    if (currentCycle !== activeCycleId) return;

                    if (status === 'SUBSCRIBED') {
                        if (!messagesSettled) {
                            messagesSettled = true;
                            messagesSuccess = true;
                            checkAllSettled();
                        }
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        if (!messagesSettled) {
                            messagesSettled = true;
                            messagesSuccess = false;
                            handleChannelError('realtime-messages-channel', status, err);
                            checkAllSettled();
                        } else {
                            handleChannelError('realtime-messages-channel', status, err);
                        }
                    }
                });
        } catch (setupErr) {
            console.error('Kesalahan sinkron saat mendaftarkan channel subscription:', setupErr);
            clearAllTimers();
            isInitializing = false;
            handleChannelError('general-setup', 'SETUP_EXCEPTION', setupErr);
            
            if (pendingInit) {
                pendingInit = false;
                initSupabaseRealtime();
            }
        }
    }

    function safeInitSupabaseRealtime() {
        if (initThrottleTimer) return;
        initThrottleTimer = setTimeout(function() {
            initThrottleTimer = null;
            initSupabaseRealtime();
        }, 1000);
    }

    // Event Listener Jaringan dan Siklus Halaman
    window.addEventListener('online', function() {
        console.log('Koneksi internet pulih, mereset backoff dan menyambungkan ulang...');
        reconnectAttempts = 0; 
        safeInitSupabaseRealtime();
    });

    window.addEventListener('offline', function() {
        console.warn('Koneksi internet terputus.');
    });

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            console.log('Tab aktif kembali, memverifikasi ulang koneksi realtime...');
            safeInitSupabaseRealtime();
        }
    });

    // Penanganan Back/Forward Cache (bfcache)
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            console.log('Halaman dipulihkan dari bfcache, menginisialisasi ulang koneksi realtime...');
            window.__supabaseRealtimeInitialized = true;
            if (!clockInterval) {
                startClock();
            }
            safeInitSupabaseRealtime();
        }
    });

    window.addEventListener('pagehide', function() {
        activeCycleId++; 
        
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (initThrottleTimer) {
            clearTimeout(initThrottleTimer);
            initThrottleTimer = null;
        }
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
        if (leavesChannel && typeof supabaseClient !== 'undefined' && typeof supabaseClient.removeChannel === 'function') {
            try { supabaseClient.removeChannel(leavesChannel); } catch (e) {}
            leavesChannel = null;
        }
        if (messagesChannel && typeof supabaseClient !== 'undefined' && typeof supabaseClient.removeChannel === 'function') {
            try { supabaseClient.removeChannel(messagesChannel); } catch (e) {}
            messagesChannel = null;
        }
        isInitializing = false;
        pendingInit = false;
        window.__supabaseRealtimeInitialized = false;
    });

    // Fungsi Inisialisasi Live Clock Terpusat
    function startClock() {
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(function() {
            var el = document.getElementById('live-clock');
            if (el) {
                el.innerText = new Date().toLocaleTimeString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour12: false
                }) + ' WIB';
            }
        }, 1000);
    }

    startClock();

    // Inisialisasi Utama saat DOM Siap
    document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Menjamin Supabase Client siap digunakan sebelum melakukan query
        const supabase = await window.waitForSupabase();
        console.log('Supabase Siap:', supabase);

        // Menjamin EmailJS siap digunakan
        await window.waitForEmailJS();
        console.log('EmailJS Siap');

        // Lanjutkan logika aplikasi (misal: cek sesi pengguna)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            console.log('Pengguna aktif:', session.user.email);
        }

    } catch (error) {
        console.error('Gagal memuat modul aplikasi:', error.message);
        // Tampilkan notifikasi error ke antarmuka pengguna (UI)
    }
  });
})();