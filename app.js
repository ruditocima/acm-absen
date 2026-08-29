// Variabel global untuk melacak instance channel dan timer reconnect
let leavesChannel = null;
let messagesChannel = null;
let reconnectTimer = null;

function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') {
        setTimeout(initSupabaseRealtime, 1000);
        return;
    }

    // Batalkan timer reconnect yang sedang berjalan untuk menghindari duplikasi loop
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    // Bersihkan referensi channel sebelumnya jika ada[cite: 2]
    if (leavesChannel) {
        supabaseClient.removeChannel(leavesChannel);
        leavesChannel = null;
    }
    if (messagesChannel) {
        supabaseClient.removeChannel(messagesChannel);
        messagesChannel = null;
    }

    // Pembersihan tambahan untuk channel lama di dalam klien Supabase[cite: 2]
    const existingChannels = supabaseClient.getChannels();
    existingChannels.forEach(function(ch) {
        if (ch.topic && (ch.topic.includes('realtime-leaves-channel') || ch.topic.includes('realtime-messages-channel'))) {
            supabaseClient.removeChannel(ch);
        }
    });

    // Handler error terpusat agar retry timer hanya dipanggil sekali meskipun kedua channel gagal bersamaan
    const handleChannelError = function(channelName, err) {
        console.error(`Gagal terhubung ke ${channelName}:`, err);
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(function() {
                reconnectTimer = null;
                initSupabaseRealtime();
            }, 5000);
        }
    };

    // Inisialisasi ulang realtime-leaves-channel
    leavesChannel = supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function(payload) {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
        })
        .subscribe(function(status, err) {
            if (status === 'CHANNEL_ERROR') {
                handleChannelError('realtime-leaves-channel', err);
            }
        });

    // Inisialisasi ulang realtime-messages-channel
    messagesChannel = supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function(payload) {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        })
        .subscribe(function(status, err) {
            if (status === 'CHANNEL_ERROR') {
                handleChannelError('realtime-messages-channel', err);
            }
        });
}

// Live clock interval tetap dipertahankan[cite: 2]
setInterval(function() {
    var el = document.getElementById('live-clock');
    if (el) {
        el.innerText = new Date().toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour12: false
        }) + ' WIB';
    }
}, 1000);

document.addEventListener('DOMContentLoaded', function() {
    if (typeof initializeDeviceBinding === 'function') initializeDeviceBinding();
    if (typeof fetchAllDataFromSupabase === 'function') fetchAllDataFromSupabase();
    if (typeof initAuth === 'function') initAuth();
    initSupabaseRealtime();
});
