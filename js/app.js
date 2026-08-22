// ==========================================
// APP INITIALIZATION
// Entry point, event listeners, timers
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { initSupabaseRealtime(); }, 1000);
});

// Live clock updater
setInterval(() => {
    const el = document.getElementById('live-clock');
    if(el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
}, 1000);

// Confirm modal listener
document.getElementById('confirm-btn-yes').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
});