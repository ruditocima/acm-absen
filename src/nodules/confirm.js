let confirmCallback = null;

export function showConfirm(title, message, callback, isDanger = true) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    const btnYes = document.getElementById('confirm-btn-yes');
    if (isDanger) {
        btnYes.className = "flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition";
        btnYes.innerText = "Ya, Hapus/Reset";
    } else {
        btnYes.className = "flex-1 py-2.5 rounded-xl gold-gradient text-slate-950 font-bold text-xs shadow-md hover:opacity-95 transition";
        btnYes.innerText = "Ya, Lanjutkan";
    }
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

export function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmCallback = null;
}

export function initConfirm() {
    document.getElementById('confirm-btn-yes').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirmModal();
    });
    document.getElementById('confirm-btn-cancel').addEventListener('click', () => {
        closeConfirmModal();
    });
}