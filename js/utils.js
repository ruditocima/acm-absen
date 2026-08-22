
# 5. js/utils.js
utils_js = '''// ==========================================
// UTILITY & HELPER FUNCTIONS
// ==========================================

async function initializeDeviceBinding() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
            const info = await window.Capacitor.Plugins.Device.getId();
            currentDeviceUUID = info.uuid;
        } else {
            throw new Error("Capacitor Native Plugin not found.");
        }
    } catch (error) {
        let localUUID = localStorage.getItem('hybrid_device_uuid');
        if (!localUUID) {
            localUUID = 'WEB-' + Math.random().toString(36).substring(2, 12).toUpperCase();
            localStorage.setItem('hybrid_device_uuid', localUUID);
        }
        currentDeviceUUID = localUUID;
    }

    const deviceStatusEl = document.getElementById('mobile-device-status');
    if (deviceStatusEl) {
        deviceStatusEl.innerHTML = `<i class="fa-solid fa-shield-check"></i> ID: ${currentDeviceUUID.substring(0,8)}...`;
        deviceStatusEl.className = "text-emerald-400 font-semibold text-[11px]";
    }
}

async function hashPassword(message) {
    if (message === '••••••••') return message;
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return "$2a$10$" + hashHex.substring(0, 53);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'border-emerald-500/30' : type === 'warning' ? 'border-amber-500/30' : 'border-rose-500/30';
    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'warning' ? 'fa-triangle-exclamation text-amber-400' : 'fa-circle-xmark text-rose-400';

    toast.className = `glass-card pointer-events-auto px-4 py-3 rounded-2xl border ${borderColor} shadow-xl flex items-center gap-3 transform translate-y-2 opacity-0 transition-all duration-300 text-xs text-white max-w-sm`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span class="flex-1">${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

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

// Image Zoom Functions
function openImageZoom(url, caption = 'Foto Selfie Absensi') {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    const cap = document.getElementById('zoomed-caption');
    if (modal && img) {
        img.src = url;
        if (cap) cap.innerText = caption;
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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getReadEmailIds() {
    try {
        const userId = activeEmployeeSession && activeEmployeeSession.id ? activeEmployeeSession.id : 'tamu';
        const stored = localStorage.getItem('read_emails_' + userId);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function markEmailAsRead(emailId) {
    const userId = activeEmployeeSession && activeEmployeeSession.id ? activeEmployeeSession.id : 'tamu';
    const readIds = getReadEmailIds();
    if (!readIds.includes(emailId)) {
        readIds.push(emailId);
        localStorage.setItem('read_emails_' + userId, JSON.stringify(readIds));
    }
    const email = emailsList.find(e => e.id === emailId);
    if (email) email.read = true;
    updateEmailBadges();
    renderEmails();
}

function updateEmailBadges() {
    const mBadge = document.getElementById('mobile-email-badge');
    const sBadge = document.getElementById('sidebar-email-badge');

    if (!activeEmployeeSession || activeEmployeeSession.name === 'Tamu' || activeEmployeeSession.role === 'Tamu') {
        if (mBadge) mBadge.classList.add('hidden');
        if (sBadge) sBadge.classList.add('hidden');
        return;
    }

    const userEmail = activeEmployeeSession.id;
    const readIds = getReadEmailIds();

    const unreadCount = emailsList.filter(e => {
        const isForMe = (e.receiver === userEmail || e.receiver === 'BROADCAST');
        const isNotMyOwn = (e.sender !== userEmail);
        const isRead = readIds.includes(e.id) || e.read;
        return isForMe && isNotMyOwn && !isRead;
    }).length;

    if (mBadge) {
        if (unreadCount > 0) {
            mBadge.innerText = unreadCount;
            mBadge.classList.remove('hidden');
        } else {
            mBadge.classList.add('hidden');
        }
    }

    if (sBadge) {
        if (unreadCount > 0) {
            sBadge.innerText = unreadCount;
            sBadge.classList.remove('hidden');
        } else {
            sBadge.classList.add('hidden');
        }
    }
}

function getEmployeeDisplayName(emailOrId) {
    if (!emailOrId || emailOrId === 'BROADCAST') return '📢 BROADCAST (Semua Karyawan)';
    const emp = employees.find(e => e.id === emailOrId);
    return emp ? emp.name : emailOrId;
}

function populateEmailRecipients() {
    const mSelect = document.getElementById('m-email-recipient');
    const dSelect = document.getElementById('d-email-recipient');

    const currentUserId = activeEmployeeSession && activeEmployeeSession.id ? activeEmployeeSession.id.toLowerCase() : '';

    const optionsHtml = `<option value="BROADCAST">📢 BROADCAST (Kirim ke Seluruh Karyawan)</option>` +
        employees
            .filter(emp => emp.id.toLowerCase() !== currentUserId && emp.status === 'Approved')
            .map(emp => `<option value="${emp.id}">${emp.name} - ${emp.position}</option>`)
            .join('');

    if (mSelect) mSelect.innerHTML = optionsHtml;
    if (dSelect) dSelect.innerHTML = optionsHtml;
}

function isMasterAdmin() {
    return activeEmployeeSession.role === 'Master Admin';
}
'''

with open(f"{output_dir}/js/utils.js", "w", encoding="utf-8") as f:
    f.write(utils_js)

print("✅ js/utils.js created")
