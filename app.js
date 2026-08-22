document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() { initSupabaseRealtime(); }, 1000);
});

setInterval(function() {
    const el = document.getElementById('live-clock');
    if(el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
}, 1000);

document.getElementById('confirm-btn-yes').addEventListener('click', function() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
});