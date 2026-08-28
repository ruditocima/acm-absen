// ============================================================
// APP: Entry Point, Realtime, Clock, Init
// ============================================================

// Realtime subscriptions
function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') return;

    supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, () => {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
        }).subscribe();

    supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, () => {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        }).subscribe();
}

// Live clock
setInterval(() => {
    const el = document.getElementById('live-clock');
    if (el) el.innerText = new Date().toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour12: false
    }) + ' WIB';
}, 1000);

// Init
document.addEventListener('DOMContentLoaded', () => {
    initializeDeviceBinding();
    fetchAllDataFromSupabase();
    initAuth();
    initSupabaseRealtime();
});