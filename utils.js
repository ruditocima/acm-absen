# ============================================================
# FILE 2: utils.js
# ============================================================
utils_js = '''// ============================================================
// UTILS: Escape HTML, Format WIB, Toast, Confirm, Loading
// ============================================================

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function getWIBDateString(date) {
    if (!date) date = new Date();
    const parts = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return y + '-' + m + '-' + d;
}

function getWIBTimeParts(date) {
    if (!date) date = new Date();
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
    if (typeof timeValue === 'string' && /^\\d{2}:\\d{2}:\\d{2}$/.test(timeValue)) {
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
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function showToast(message, type) {
    if (!type) type = 'success';
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    var borderColor, icon;
    if (type === 'success') {
        borderColor = 'border-emerald-500/30';
        icon = 'fa-circle-check text-emerald-400';
    } else if (type === 'warning') {
        borderColor = 'border-amber-500/30';
        icon = 'fa-triangle-exclamation text-amber-400';
    } else {
        borderColor = 'border-rose-500/30';
        icon = 'fa-circle-xmark text-rose-400';
    }
    toast.className = 'glass-card pointer-events-auto px-4 py-3 rounded-2xl border ' + borderColor + ' shadow-xl flex items-center gap-3 transform translate-y-2 opacity-0 transition-all duration-300 text-xs text-white max-w-sm';
    toast.innerHTML = '<i class="fa-solid ' + icon + ' text-base"></i><span class="flex-1">' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    setTimeout(function() {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);
    setTimeout(function() {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
}

var confirmCallback = null;

function showConfirm(title, message, callback, isDanger) {
    if (isDanger === undefined) isDanger = true;
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    var btnYes = document.getElementById('confirm-btn-yes');
    if (isDanger) {
        btnYes.className = 'flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition';
        btnYes.innerText = 'Ya, Hapus/Reset';
    } else {
        btnYes.className = 'flex-1 py-2.5 rounded-xl gold-gradient text-slate-950 font-bold text-xs shadow-md hover:opacity-95 transition';
        btnYes.innerText = 'Ya, Lanjutkan';
    }
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmCallback = null;
}

document.addEventListener('DOMContentLoaded', function() {
    var confirmBtnYes = document.getElementById('confirm-btn-yes');
    if (confirmBtnYes) {
        confirmBtnYes.addEventListener('click', function() {
            if (typeof confirmCallback === 'function') confirmCallback();
            closeConfirmModal();
        });
    }
});

function openImageZoom(url, caption) {
    var modal = document.getElementById('image-zoom-modal');
    var img = document.getElementById('zoomed-image');
    var cap = document.getElementById('zoomed-caption');
    if (modal && img) {
        img.src = url;
        if (cap) cap.innerText = caption || 'Foto Selfie Absensi';
        modal.classList.remove('hidden');
    }
}

function closeImageZoom() {
    var modal = document.getElementById('image-zoom-modal');
    var img = document.getElementById('zoomed-image');
    if (modal) {
        modal.classList.add('hidden');
        if (img) img.src = '';
    }
}

function setButtonLoading(btn, loadingText) {
    if (!btn) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + escapeHtml(loadingText || 'Memproses...');
}

function resetButtonLoading(btn) {
    if (!btn || !btn.dataset.originalHtml) return;
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml;
}

var emailjsReady = false;

function initEmailJS() {
    try {
        if (typeof emailjs !== 'undefined' && typeof emailjs.init === 'function') {
            emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
            emailjsReady = true;
        } else {
            emailjsReady = false;
        }
    } catch (e) {
        emailjsReady = false;
    }
}

(function() {
    initEmailJS();
})();
'''

with open('/mnt/agents/output/utils.js', 'w', encoding='utf-8') as f:
    f.write(utils_js)
