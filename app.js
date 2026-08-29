// Variabel global untuk melacak instance channel aktif
let leavesChannel = null;
let messagesChannel = null;

function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') {
        setTimeout(initSupabaseRealtime, 1000);
        return;
    }

    // Bersihkan referensi channel sebelumnya jika ada
    if (leavesChannel) {
        supabaseClient.removeChannel(leavesChannel);
        leavesChannel = null;
    }
    if (messagesChannel) {
        supabaseClient.removeChannel(messagesChannel);
        messagesChannel = null;
    }

    // Pembersihan tambahan untuk channel lama di dalam klien Supabase
    const existingChannels = supabaseClient.getChannels();
    existingChannels.forEach(function(ch) {
        if (ch.topic && (ch.topic.includes('realtime-leaves-channel') || ch.topic.includes('realtime-messages-channel'))) {
            supabaseClient.removeChannel(ch);
        }
    });

    // Inisialisasi ulang realtime-leaves-channel dengan auto-retry
    leavesChannel = supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function(payload) {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
        })
        .subscribe(function(status, err) {
            if (status === 'CHANNEL_ERROR') {
                console.error('Gagal terhubung ke realtime-leaves-channel:', err);
                // Coba hubungkan kembali setelah 5 detik jika terjadi error
                setTimeout(initSupabaseRealtime, 5000);
            }
        });

    // Inisialisasi ulang realtime-messages-channel dengan auto-retry
    messagesChannel = supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function(payload) {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        })
        .subscribe(function(status, err) {
            if (status === 'CHANNEL_ERROR') {
                console.error('Gagal terhubung ke realtime-messages-channel:', err);
                // Coba hubungkan kembali setelah 5 detik jika terjadi error
                setTimeout(initSupabaseRealtime, 5000);
            }
        });
}

// Live clock interval tetap dipertahankan
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
