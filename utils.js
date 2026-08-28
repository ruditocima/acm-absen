
# ============================================================
# FILE 2: utils.js — Helpers, Sanitasi, Format WIB
# ============================================================
utils_js = r'''// ============================================================
// UTILS: Escape HTML, Format WIB, Toast, Confirm, Loading State
// ============================================================

/**
 * SANITASI CRITICAL: Escape HTML untuk mencegah XSS
 * Gunakan ini di SEMUA innerHTML yang menampilkan data user
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function getWIBDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
}

function getWIBTimeParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(date);
    return {
        h: parts.find(p => p.type === 'hour').value,
        m: parts.find(p => p.type === 'minute').value,
        s: parts.find(p => p.type === 'second').value
    };
}

function formatWIBTime(date) {
    return new Date(date).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatWIBDateTime(date) {
    return new Date(date).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function formatRekapTime(timeValue) {
    if (!timeValue) return '--:--:--';
    if (typeof timeValue === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
        return timeValue;
    }
    try {
        return new Date(timeValue).toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (e) {
        return timeValue;
    }
}

function timeToSeconds(timeStr) {
    const [h, m, s] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'border-emerald-500/30' : type === 'warning' ? 'border-amber-500/30' : 'border-rose-500/30';
    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'warning' ? 'fa-triangle-exclamation text-amber-400' : 'fa-circle-xmark text-rose-400';
    toast.className = `glass-card pointer-events-auto px-4 py-3 rounded-2xl border ${borderColor} shadow-xl flex items-center gap-3 transform translate-y-2 opacity-0 transition-all duration-300 text-xs text-white max-w-sm`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span class="flex-1">${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================================
// CONFIRM MODAL
// ============================================================
let confirmCallback = null;

function showConfirm(title, message, callback, isDanger = true) {
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

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmCallback = null;
}

// Bind tombol konfirmasi saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const confirmBtnYes = document.getElementById('confirm-btn-yes');
    if (confirmBtnYes) {
        confirmBtnYes.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') confirmCallback();
            closeConfirmModal();
        });
    }
});

// ============================================================
// IMAGE ZOOM MODAL
// ============================================================
function openImageZoom(url, caption) {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    const cap = document.getElementById('zoomed-caption');
    if (modal && img) {
        img.src = url;
        if (cap) cap.innerText = caption || 'Foto Selfie Absensi';
        modal.classList.remove('hidden');
    }
}

function closeImageZoom() {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    if (modal) {
        modal.classList.add('hidden');
        if (img) img.src = '';
    }
}

// ============================================================
// LOADING STATE HELPER (Anti-spam tombol)
// ============================================================
function setButtonLoading(btn, loadingText = 'Memproses...') {
    if (!btn) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(loadingText)}`;
}

function resetButtonLoading(btn) {
    if (!btn || !btn.dataset.originalHtml) return;
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml;
}

// ============================================================
// EMAILJS INIT
// ============================================================
let emailjsReady = false;

function initEmailJS() {
    try {
        if (typeof emailjs !== 'undefined' && typeof emailjs.init === 'function') {
            emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
            emailjsReady = true;
        } else {
            console.warn('[EmailJS] Library not loaded yet');
            emailjsReady = false;
        }
    } catch (e) {
        console.error('[EmailJS] Init failed:', e);
        emailjsReady = false;
    }
}

(function () {
    initEmailJS();
})();
'''

with open('/mnt/agents/output/utils.js', 'w', encoding='utf-8') as f:
    f.write(utils_js)

print("✅ utils.js created")
