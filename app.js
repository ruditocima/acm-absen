function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') return;

    // Menghapus channel lama jika sudah ada untuk menghindari duplikasi
    const existingChannels = supabaseClient.getChannels();
    existingChannels.forEach(function(ch) {
        if (ch.topic === 'realtime:realtime-leaves-channel' || ch.topic === 'realtime:realtime-messages-channel') {
            supabaseClient.removeChannel(ch);
        }
    });

    supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function() {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
        })
        .subscribe(function(status) {
            if (status === 'CHANNEL_ERROR') {
                console.error('Gagal terhubung ke realtime-leaves-channel');
            }
        });

    supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function() {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        })
        .subscribe(function(status) {
            if (status === 'CHANNEL_ERROR') {
                console.error('Gagal terhubung ke realtime-messages-channel');
            }
        });
}

setInterval(function() {
    var el = document.getElementById('live-clock');
    if (el) el.innerText = new Date().toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour12: false
    }) + ' WIB';
}, 1000);

document.addEventListener('DOMContentLoaded', function() {
    if (typeof initializeDeviceBinding === 'function') initializeDeviceBinding();
    if (typeof fetchAllDataFromSupabase === 'function') fetchAllDataFromSupabase();
    if (typeof initAuth === 'function') initAuth();
    initSupabaseRealtime();
});
