function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') {
        // Coba lagi setelah 1 detik jika supabaseClient belum siap dimuat
        setTimeout(initSupabaseRealtime, 1000);
        return;
    }

    // Membersihkan channel lama yang relevan secara menyeluruh
    const targetTopics = ['realtime-leaves-channel', 'realtime-messages-channel'];
    const existingChannels = supabaseClient.getChannels();
    existingChannels.forEach(function(ch) {
        if (ch.topic && targetTopics.some(topic => ch.topic.includes(topic))) {
            supabaseClient.removeChannel(ch);
        }
    });

    // Inisialisasi Channel Izin List dengan penanganan error dan reconnect
    const leavesChannel = supabaseClient.channel('realtime-leaves-channel');
    leavesChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function(payload) {
            try {
                if (typeof renderAdminIzin === 'function') renderAdminIzin(payload);
                if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
            } catch (err) {
                console.error('Error pada renderAdminIzin:', err);
            }
        })
        .subscribe(function(status, err) {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Gagal terhubung ke realtime-leaves-channel:', err || status);
                // Coba sambungkan kembali setelah 5 detik
                setTimeout(function() {
                    if (leavesChannel) leavesChannel.subscribe();
                }, 5000);
            }
        });

    // Inisialisasi Channel Emails dengan penanganan error dan reconnect
    const messagesChannel = supabaseClient.channel('realtime-messages-channel');
    messagesChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function(payload) {
            try {
                if (typeof renderEmails === 'function') renderEmails(payload);
                if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
            } catch (err) {
                console.error('Error pada renderEmails:', err);
            }
        })
        .subscribe(function(status, err) {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Gagal terhubung ke realtime-messages-channel:', err || status);
                // Coba sambungkan kembali setelah 5 detik
                setTimeout(function() {
                    if (messagesChannel) messagesChannel.subscribe();
                }, 5000);
            }
        });
}

// Interval live clock tetap berjalan efisien
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
