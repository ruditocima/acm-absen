// ============================================================
// REFACTOR: SUPABASE AUTH v2 (Fixed)
// ============================================================

const SUPABASE_URL = 'https://gviqfdbuoruqldsbbrxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aXFmZGJ1b3J1cWxkc2JicnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjU1MzksImV4cCI6MjEwMjIwMTUzOX0.RalUZTRpAKswYK0SxdJjZWkY1wQb1V0JFKmXu8i0Lo0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentDeviceUUID = "PENDING";
let generatedOTP = null;
let otpExpiryTime = null;
let roles = [];
let employees = [];
let basecamps = [];
let rekapList = [];
let izinList = [];
let emailsList = [];
let activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
let tempRegData = null;
let pendingAbsenData = null;
let mediaStream = null;
let capturedBlob = null;
let activeSelectedEmail = null;
let bcMap = null;
let bcMarkers = [];
let confirmCallback = null;
let supabaseConnected = false;

// ============================================================
// SUPABASE CONNECTION CHECK (dengan retry)
// ============================================================
async function checkSupabaseConnection(retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            // Query ke roles (sekarang public read, tidak recursive)
            const { data, error } = await supabaseClient.from('roles').select('id').limit(1);
            if (error) {
                console.warn(`[Supabase] Connection check attempt ${i+1} failed:`, error.message);
                if (i < retries) await new Promise(r => setTimeout(r, 800));
                continue;
            }
            supabaseConnected = true;
            return true;
        } catch (err) {
            console.error(`[Supabase] Connection check attempt ${i+1} exception:`, err);
            if (i < retries) await new Promise(r => setTimeout(r, 800));
        }
    }
    supabaseConnected = false;
    return false;
}

// ============================================================
// FALLBACK SEED DATA (jika Supabase error/tabel kosong)
// ============================================================
function loadFallbackData() {
    if (roles.length === 0) {
        roles = [
            { id: 'ROL-01', name: 'Master Admin', access: 'Dashboard, Rekap, Role, Karyawan, Basecamp, Izin, Email' },
            { id: 'ROL-02', name: 'Manajer Lapangan', access: 'Dashboard, Rekap, Karyawan, Basecamp, Izin, Email' },
            { id: 'ROL-03', name: 'Karyawan / Field', access: 'Dashboard, Rekap, Basecamp, Email' },
            { id: 'ROL-04', name: 'Supervisor Field', access: 'Dashboard, Rekap, Basecamp, Izin, Email' },
            { id: 'ROL-05', name: 'Admin', access: 'Dashboard, Rekap, Basecamp, Izin, Email' }
        ];
    }
    if (basecamps.length === 0) {
        basecamps = [{ id: 1, name: 'Basecamp Pekanbaru Pusat', lat: 0.434291, lng: 101.466385, radius: 1500 }];
    }
}
// ============================================================
// EMAILJS CONFIG  ->  SENDGRID VIA EMAILJS
// ============================================================
// LANGKAH SETUP SENDGRID:
// 1. Daftar di https://sendgrid.com (gratis 100 email/hari)
// 2. Settings -> Sender Authentication -> Single Sender Verification
//    -> isi data & verifikasi via email
// 3. Settings -> API Keys -> Create API Key (Full Access) -> copy key
// 4. Dashboard EmailJS -> Email Services -> Add New Service -> pilih SendGrid
//    -> paste API Key SendGrid -> Save
// 5. Copy Service ID SendGrid Anda (contoh: service_abc123) dan paste di bawah
// ============================================================
const EMAILJS_PUBLIC_KEY = 'il5LfNiQu0y8dsN35';   // Public Key EmailJS (tetap sama)
const EMAILJS_SERVICE_ID = 'service_3w0ocfc';  // <-- GANTI INI dengan Service ID SendGrid dari EmailJS
const EMAILJS_TEMPLATE_ID = 'template_09rz7kd';      // Template ID tetap sama
let emailjsReady = false;

function initEmailJS() {
    try {
        if (typeof emailjs !== 'undefined' && typeof emailjs.init === 'function') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            emailjsReady = true;
            console.log('[EmailJS] Initialized successfully');
        } else {
            console.warn('[EmailJS] Library not loaded yet, will retry...');
            emailjsReady = false;
        }
    } catch (e) {
        console.error('[EmailJS] Init failed:', e);
        emailjsReady = false;
    }
}

(function(){
    initEmailJS();
})();
// ============================================================
// UTILITY FUNCTIONS
// ============================================================
// ============================================================
// HELPER: WIB (Asia/Jakarta)
// ============================================================
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
    // Jika sudah format HH:MM:SS string, kembalikan apa adanya
    if (typeof timeValue === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
        return timeValue;
    }
    // Jika format ISO atau Date object, konversi ke WIB
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
    setTimeout(() => { toast.classList.add('translate-y-2', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function showConfirm(title, message, callback, isDanger = true) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    const btnYes = document.getElementById('confirm-btn-yes');
    if (isDanger) { btnYes.className = "flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition"; btnYes.innerText = "Ya, Hapus/Reset"; }
    else { btnYes.className = "flex-1 py-2.5 rounded-xl gold-gradient text-slate-950 font-bold text-xs shadow-md hover:opacity-95 transition"; btnYes.innerText = "Ya, Lanjutkan"; }
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() { document.getElementById('confirm-modal').classList.add('hidden'); confirmCallback = null; }

function openImageZoom(url, caption) {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    const cap = document.getElementById('zoomed-caption');
    if (modal && img) { img.src = url; if (cap) cap.innerText = caption || 'Foto Selfie Absensi'; modal.classList.remove('hidden'); }
}

function closeImageZoom() {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    if (modal) { modal.classList.add('hidden'); if (img) img.src = ''; }
}

function getReadEmailIds() {
    try {
        const userId = activeEmployeeSession && activeEmployeeSession.id ? activeEmployeeSession.id : 'tamu';
        const stored = localStorage.getItem('read_emails_' + userId);
        return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
}

function markEmailAsRead(emailId) {
    const userId = activeEmployeeSession && activeEmployeeSession.id ? activeEmployeeSession.id : 'tamu';
    const readIds = getReadEmailIds();
    if (!readIds.includes(emailId)) { readIds.push(emailId); localStorage.setItem('read_emails_' + userId, JSON.stringify(readIds)); }
    const email = emailsList.find(e => e.id === emailId);
    if (email) email.read = true;
    updateEmailBadges(); renderEmails();
}

function getEmployeeDisplayName(emailOrId) {
    if (!emailOrId || emailOrId === 'BROADCAST') return 'BROADCAST (Semua Karyawan)';
    const emp = employees.find(e => e.id === emailOrId);
    return emp ? emp.name : emailOrId;
}

function isMasterAdmin() { return activeEmployeeSession.role === 'Master Admin'; }

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180; const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ============================================================
// DEVICE BINDING
// ============================================================
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
    if(deviceStatusEl) {
        deviceStatusEl.innerHTML = `<i class="fa-solid fa-shield-check"></i> ID: ${currentDeviceUUID.substring(0,8)}...`;
        deviceStatusEl.className = "text-emerald-400 font-semibold text-[11px]";
    }
}

// ============================================================
// RENDER FUNCTIONS (didefinisikan SEMUA sebelum dipanggil)
// ============================================================
function updateEmailBadges() {
    const mBadge = document.getElementById('mobile-email-badge');
    const sBadge = document.getElementById('sidebar-email-badge');
    if (!activeEmployeeSession || activeEmployeeSession.name === 'Tamu') {
        if (mBadge) mBadge.classList.add('hidden'); if (sBadge) sBadge.classList.add('hidden'); return;
    }
    const userEmail = activeEmployeeSession.id;
    const readIds = getReadEmailIds();
    const unreadCount = emailsList.filter(e => {
        const isForMe = (e.receiver === userEmail || e.receiver === 'BROADCAST');
        const isNotMyOwn = (e.sender !== userEmail);
        const isRead = readIds.includes(e.id) || e.read;
        return isForMe && isNotMyOwn && !isRead;
    }).length;
    if (mBadge) { if (unreadCount > 0) { mBadge.innerText = unreadCount; mBadge.classList.remove('hidden'); } else { mBadge.classList.add('hidden'); } }
    if (sBadge) { if (unreadCount > 0) { sBadge.innerText = unreadCount; sBadge.classList.remove('hidden'); } else { sBadge.classList.add('hidden'); } }
}

function populateEmailRecipients() {
    const mSelect = document.getElementById('m-email-recipient');
    const dSelect = document.getElementById('d-email-recipient');
    const currentUserId = activeEmployeeSession && activeEmployeeSession.id ? activeEmployeeSession.id.toLowerCase() : '';
    const optionsHtml = `<option value="BROADCAST">BROADCAST (Kirim ke Seluruh Karyawan)</option>` +
        employees.filter(emp => emp.id.toLowerCase() !== currentUserId && emp.status === 'Approved')
            .map(emp => `<option value="${emp.id}">${emp.name} - ${emp.position}</option>`).join('');
    if(mSelect) mSelect.innerHTML = optionsHtml; if(dSelect) dSelect.innerHTML = optionsHtml;
}

function renderEmployees() {
    const tbody = document.getElementById('karyawan-tbody');
    if(!tbody) return;

    // Handle state kosong dengan pesan informatif
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-500 text-xs"><i class="fa-solid fa-circle-info text-slate-600 mb-1 block text-lg"></i>Tidak ada data karyawan yang dapat ditampilkan.<br><span class="text-[10px] text-slate-600">Pastikan Anda sudah login dan memiliki hak akses.</span></td></tr>';
        const badge = document.getElementById('karyawan-pending-badge');
        if(badge) badge.classList.add('hidden');
        // Reset dropdown atasan
        const atasanSelect = document.getElementById('inp-atasan');
        if(atasanSelect) {
            atasanSelect.innerHTML = '<option value="">--- (Tidak Ada Atasan)</option><option value="Master Admin">Master Admin</option>';
        }
        return;
    }

    const pendingCount = employees.filter(e => e.status === 'Pending').length;
    const badge = document.getElementById('karyawan-pending-badge');
    if(badge) {
        if(pendingCount > 0) { badge.innerText = `${pendingCount} Pending`; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    }
    tbody.innerHTML = employees.map((e, index) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 font-mono text-white">${e.id}</td>
            <td class="p-3 font-semibold text-white">${e.name}</td>
            <td class="p-3 text-slate-300">${e.position}</td>
            <td class="p-3 text-slate-300">${e.role}</td>
            <td class="p-3 text-slate-300">${e.atasan || '-'}</td>
            <td class="p-3 font-mono text-slate-400 truncate max-w-[100px]">${e.auth_id ? e.auth_id.substring(0,8)+'...' : 'Belum Aktif'}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${e.status}</span>
            </td>
            <td class="p-3">
                <div class="flex flex-wrap items-center gap-1.5">
                    ${e.status === 'Pending' ? `<button onclick="approveEmployeeAccount(${index})" class="px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-[11px] font-semibold transition">Approve</button>` : ''}
                    <button onclick="openEditEmployeeModal(${index})" class="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button onclick="resetEmployeeDevice(${index})" class="px-2 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded text-[11px] font-semibold transition" title="Reset Device UUID"><i class="fa-solid fa-mobile-screen"></i> Reset</button>
                </div>
            </td>
        </tr>
    `).join('');

    // === DROPDOWN ATASAN: tanpa duplikat, ada pilihan --- ===
    const atasanSelect = document.getElementById('inp-atasan');
    if(atasanSelect) {
        const opts = new Map();
        opts.set('', '--- (Tidak Ada Atasan)');
        opts.set('Master Admin', 'Master Admin');
        employees.forEach(emp => {
            if (emp.name && !opts.has(emp.name)) {
                opts.set(emp.name, emp.name);
            }
        });
        atasanSelect.innerHTML = Array.from(opts.entries())
            .map(([val, txt]) => `<option value="${val}">${txt}</option>`)
            .join('');
    }
}

function renderRekapDataToTable(dataList) {
    const tbody = document.getElementById('rekap-tbody');
    if(!tbody) return;
    tbody.innerHTML = dataList.map((r) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 text-white">${r.date}</td>
            <td class="p-3 font-semibold text-white">${r.name}</td>
            <td class="p-3 text-slate-300">${r.basecamp}</td>
            <td class="p-3 font-mono text-emerald-400">${formatRekapTime(r.time)}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Tepat Waktu' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${r.status}</span></td>
            <td class="p-3 text-rose-400 font-mono">${r.late}</td>
            <td class="p-3">${r.selfie_url ? `<button onclick="openImageZoom('${r.selfie_url}')" class="px-2 py-1 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-image"></i> Lihat</button>` : '-'}</td>
        </tr>
    `).join('');
}

function renderRekap() {
    let dataToRender = rekapList;
    if (activeEmployeeSession.role === 'Karyawan / Field') {
        dataToRender = rekapList.filter(r => r.name === activeEmployeeSession.name);
    }
    renderRekapDataToTable(dataToRender);
}

function renderMobileMyHistory() {
    const container = document.getElementById('mobile-my-history');
    if(!container) return;
    const myRekap = rekapList.filter(r => r.name === activeEmployeeSession.name);
    const myIzin = izinList.filter(i => i.name === activeEmployeeSession.name);
    let html = '';
    if(myRekap.length === 0 && myIzin.length === 0) {
        html = '<p class="text-slate-500 text-center py-2">Belum ada riwayat tercatat.</p>';
    } else {
        myRekap.slice().reverse().forEach(r => {
            html += `<div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2"><div><p class="text-xs font-bold text-white">${r.date}</p><p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-gold-400"></i> ${r.basecamp}</p></div><div class="text-right"><p class="text-xs font-mono text-emerald-400">${formatRekapTime(r.time)} WIB</p><p class="text-[10px] ${r.status === 'Tepat Waktu' ? 'text-emerald-500' : 'text-amber-500'} font-semibold">${r.status}</p></div></div>`;
        });
        myIzin.slice().reverse().forEach(i => {
            html += `<div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2"><div><p class="text-xs font-bold text-white">Izin: ${i.jenis}</p><p class="text-[10px] text-slate-400">${i.start} s/d ${i.end}</p></div><div class="text-right"><span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${i.status}</span></div></div>`;
        });
    }
    container.innerHTML = html;
}

// ============================================================
// REFRESH DATA MANUAL
// ============================================================
async function refreshAllData() {
    showToast('Memuat ulang data dari server...', 'info');
    await fetchAllDataFromSupabase();
    renderEmployees(); renderRekap(); renderBasecamps(); renderAdminIzin();
    renderEmails(); updateEmailBadges(); updateDashboardStats();
    showToast('Data berhasil diperbarui!', 'success');
}

function updateDashboardStats() {
    const todayStr = getWIBDateString(); // WIB, bukan UTC
    // Karyawan dengan posisi "Administrator" tidak dihitung dalam total karyawan operasional
    const karyawanOperasional = employees.filter(e => e.position && e.position.toLowerCase() !== 'administrator');
    const totalKaryawan = karyawanOperasional.length;
    const todayRekap = rekapList.filter(r => r.date === todayStr);
    const tepatWaktuCount = todayRekap.filter(r => r.status === 'Tepat Waktu').length;
    const terlambatCount = todayRekap.filter(r => r.status === 'Terlambat').length;
    const izinAlphaCount = izinList.filter(i => i.status === 'Approved' && i.start <= todayStr && i.end >= todayStr).length;
    const elTotal = document.getElementById('stat-total-karyawan');
    const elTepat = document.getElementById('stat-tepat-waktu');
    const elTerlambat = document.getElementById('stat-terlambat');
    const elIzin = document.getElementById('stat-izin-alpha');
    if (elTotal) elTotal.innerText = `${totalKaryawan} Orang`;
    if (elTepat) elTepat.innerText = `${tepatWaktuCount} Orang`;
    if (elTerlambat) elTerlambat.innerText = `${terlambatCount} Orang`;
    if (elIzin) elIzin.innerText = `${izinAlphaCount} Orang`;
}

function renderRoles() {
    const tbody = document.getElementById('role-tbody');
    if(!tbody) return;
    tbody.innerHTML = roles.map((r, i) => `
        <tr class="hover:bg-slate-900/50"><td class="p-3 font-mono text-gold-400">${r.id}</td><td class="p-3 font-semibold text-white">${r.name}</td><td class="p-3 text-slate-300">${r.access}</td><td class="p-3"><button onclick="openEditRoleModal(${i})" class="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-pen"></i> Edit</button></td></tr>
    `).join('');
    const roleSelect = document.getElementById('inp-role');
    if(roleSelect) roleSelect.innerHTML = roles.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
}

// ============================================================
// BASECAMP DELETE
// ============================================================
function deleteBasecamp(index) {
    if (activeEmployeeSession.role === 'Karyawan / Field') return showToast('Akses Ditolak! View Only.', 'error');
    if (!isMasterAdmin()) return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    const bc = basecamps[index];
    showConfirm('Hapus Basecamp', `Hapus basecamp "${bc.name}"? Tindakan ini tidak dapat dibatalkan.`, async () => {
        await supabaseClient.from('basecamps').delete().eq('id', bc.id);
        basecamps.splice(index, 1);
        renderBasecamps();
        showToast('Basecamp berhasil dihapus.', 'success');
    }, true);
}

function renderBasecamps() {
    const container = document.getElementById('basecamp-container');
    if(!container) return;

    const roleName = activeEmployeeSession.role;
    let canEdit = false;
    let canDelete = false;

    // Permission basecamp berdasarkan role
    if (roleName === 'Master Admin') {
        canEdit = true;
        canDelete = true;
    } else if (roleName === 'Supervisor Field') {
        // Supervisor: bisa tambah dan edit, TIDAK boleh hapus
        canEdit = true;
        canDelete = false;
    } else {
        // Karyawan / Field, Admin = view only (tidak bisa edit maupun hapus)
        canEdit = false;
        canDelete = false;
    }

    container.innerHTML = basecamps.map((b, i) => `
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-start">
                <h5 class="text-xs font-bold text-white">${b.name}</h5>
                ${(canEdit || canDelete) ? `
                <div class="flex items-center gap-2">
                    ${canEdit ? `<button onclick="openEditBasecampModal(${i})" class="text-blue-400 hover:text-blue-300 text-xs px-1.5 py-0.5 rounded hover:bg-blue-500/10 transition"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${canDelete ? `<button onclick="deleteBasecamp(${i})" class="text-rose-400 hover:text-rose-300 text-xs px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition" title="Hapus Basecamp"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
                ` : ''}
            </div>
            <p class="text-[11px] text-slate-400 font-mono">Lat/Lng: ${b.lat}, ${b.lng}</p><p class="text-[11px] text-gold-400">Radius GPS: ${b.radius} Meter</p>
        </div>
    `).join('');
    if(!bcMap) {
        bcMap = L.map('basecamp-map').setView([0.434291, 101.466385], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(bcMap);
    } else {
        bcMarkers.forEach(layer => { if(bcMap.hasLayer(layer)) bcMap.removeLayer(layer); });
        bcMarkers = [];
    }
    basecamps.forEach(b => {
        const m = L.marker([b.lat, b.lng]).addTo(bcMap).bindPopup(`<b>${b.name}</b><br>Radius: ${b.radius}m`);
        const c = L.circle([b.lat, b.lng], { radius: b.radius, color: '#d4af37', fillColor: '#d4af37', fillOpacity: 0.2 }).addTo(bcMap);
        bcMarkers.push(m, c);
    });
}

function renderAdminIzin() {
    const container = document.getElementById('admin-izin-container');
    const badge = document.getElementById('sidebar-izin-badge');
    const counterBadge = document.getElementById('tab-izin-counter-badge');
    if(!container) return;

    const roleName = activeEmployeeSession.role;
    let visibleIzins = [];

    // Filter izin berdasarkan role
    if (roleName === 'Master Admin') {
        visibleIzins = izinList;
    } else if (roleName === 'Supervisor Field') {
        // Hanya izin yang atasan = nama Supervisor Field ini
        visibleIzins = izinList.filter(i => i.atasan === activeEmployeeSession.name);
    } else if (roleName === 'Admin') {
        // Admin: view only semua izin dari seluruh karyawan
        visibleIzins = izinList;
    } else {
        visibleIzins = [];
    }

    const pendingIzins = visibleIzins.filter(i => i.status === 'Pending');
    if(badge) { if(pendingIzins.length > 0) { badge.innerText = pendingIzins.length; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); } }
    if(counterBadge) { if(pendingIzins.length > 0) { counterBadge.innerText = `${pendingIzins.length} Pengajuan Pending`; counterBadge.classList.remove('hidden'); } else { counterBadge.classList.add('hidden'); } }
    if(visibleIzins.length === 0) { container.innerHTML = '<p class="text-slate-500 text-center py-4 text-xs">Belum ada pengajuan izin.</p>'; return; }

    container.innerHTML = visibleIzins.map((i) => {
        // Tombol action: hanya Master Admin dan Supervisor Field (untuk izin yang masuk ke dia)
        // Admin = view only, tidak ada tombol approve/reject
        let actionButtons = '';
        if ((roleName === 'Master Admin' || roleName === 'Supervisor Field') && i.status === 'Pending') {
            actionButtons = `
                <div class="flex items-center gap-2">
                    <button onclick="updateIzinStatus(${i.id}, 'Approved')" class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shadow hover:opacity-90">Setujui</button>
                    <button onclick="updateIzinStatus(${i.id}, 'Rejected')" class="px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs shadow hover:opacity-90">Tolak</button>
                </div>
            `;
        }

        return `
        <div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
            <div>
                <div class="flex items-center gap-2"><h5 class="text-xs font-bold text-white">${i.name}</h5><span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : i.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}">${i.status}</span></div>
                <p class="text-xs text-gold-400 font-semibold mt-0.5">Jenis: ${i.jenis}</p><p class="text-[11px] text-slate-300">Tanggal: ${i.start} s/d ${i.end}</p><p class="text-[11px] text-slate-400 mt-1">Alasan: "${i.desc}"</p>
            </div>
            ${actionButtons}
        </div>
        `;
    }).join('');
}

function renderEmails() {
    if (!activeEmployeeSession || activeEmployeeSession.name === 'Tamu') return;
    const userEmail = activeEmployeeSession.id;
    const inboxRows = emailsList.filter(e => e.receiver === userEmail || e.receiver === 'BROADCAST');
    const sentRows = emailsList.filter(e => e.sender === userEmail);
    const readIds = getReadEmailIds();

    const mInboxList = document.getElementById('mobile-inbox-list');
    if (mInboxList) {
        if (inboxRows.length === 0) { mInboxList.innerHTML = '<p class="text-slate-500 text-center py-4">Kotak masuk kosong.</p>'; }
        else {
            mInboxList.innerHTML = inboxRows.map(e => {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = formatWIBTime(e.created_at);
                return `<div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border ${!isRead ? 'border-gold-500/50 bg-slate-900/90' : 'border-slate-800'} cursor-pointer hover:border-gold-500 transition"><div class="flex justify-between items-start mb-1"><span class="font-bold text-white flex items-center gap-1.5">${!isRead ? '<span class="w-2 h-2 rounded-full bg-gold-500 inline-block"></span>' : ''}${e.sender_name || e.sender}</span><span class="text-[10px] text-slate-400 font-mono">${timeStr}</span></div><p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p><p class="text-[11px] text-slate-300 truncate mt-0.5">${e.message}</p></div>`;
            }).join('');
        }
    }

    const mSentList = document.getElementById('mobile-sent-list');
    if (mSentList) {
        if (sentRows.length === 0) { mSentList.innerHTML = '<p class="text-slate-500 text-center py-4">Belum ada pesan terkirim.</p>'; }
        else {
            mSentList.innerHTML = sentRows.map(e => `<div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-gold-500 transition"><div class="flex justify-between items-start mb-1"><span class="font-bold text-white">Kepada: ${getEmployeeDisplayName(e.receiver)}</span><span class="text-[10px] text-slate-400 font-mono">${formatWIBTime(e.created_at)}</span></div><p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p></div>`).join('');
        }
    }

    const dInboxTbody = document.getElementById('desktop-inbox-tbody');
    if (dInboxTbody) {
        if (inboxRows.length === 0) { dInboxTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Kotak masuk kosong.</td></tr>'; }
        else {
            dInboxTbody.innerHTML = inboxRows.map(e => {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = formatWIBDateTime(e.created_at);
                const isBroadcast = e.receiver === 'BROADCAST';
                return `<tr class="hover:bg-slate-900/50 ${!isRead ? 'bg-slate-900/60 font-semibold' : ''}"><td class="p-3 font-mono text-slate-400 text-[11px]">${timeStr}</td><td class="p-3 text-white">${e.sender_name || e.sender}</td><td class="p-3"><div class="text-white font-bold">${e.subject}</div><div class="text-slate-400 truncate max-w-xs font-normal">${e.message}</div></td><td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${isBroadcast ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}">${isBroadcast ? 'Broadcast' : 'Pribadi'}</span></td><td class="p-3 text-right space-x-1"><button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Baca</button><button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            }).join('');
        }
    }

    const dSentTbody = document.getElementById('desktop-sent-tbody');
    if (dSentTbody) {
        if (sentRows.length === 0) { dSentTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Belum ada pesan terkirim.</td></tr>'; }
        else {
            dSentTbody.innerHTML = sentRows.map(e => `<tr class="hover:bg-slate-900/50"><td class="p-3 font-mono text-slate-400 text-[11px]">${formatWIBDateTime(e.created_at)}</td><td class="p-3 text-white">${getEmployeeDisplayName(e.receiver)}</td><td class="p-3 text-white font-semibold">${e.subject}</td><td class="p-3 text-right space-x-1"><button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Lihat</button><button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
        }
    }
}

// ============================================================
// DATA FETCH (dipindahkan ke sini setelah semua render fn defined)
// ============================================================
async function fetchAllDataFromSupabase() {
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
        showToast("Tidak dapat terhubung ke Supabase. Menggunakan data lokal.", "warning");
        loadFallbackData();
        renderRoles(); renderEmployees(); renderRekap(); renderBasecamps();
        renderAdminIzin(); populateEmailRecipients(); renderEmails(); updateDashboardStats();
        updateServerStatusIndicator();
        return;
    }

    // Fetch roles (PUBLIC READ - tidak perlu login)
    try {
        const { data: rData, error: rErr } = await supabaseClient.from('roles').select('*');
        if (rErr) { console.warn('[Supabase] Roles fetch error:', rErr.message, rErr.code); }
        if (rData && rData.length > 0) roles = rData;
        else loadFallbackData();
        const kfRole = roles.find(r => r.name === 'Karyawan / Field');
        if (kfRole) kfRole.access = 'Dashboard, Rekap, Basecamp, Email';
    } catch (err) {
        console.error('[Supabase] Roles exception:', err);
        loadFallbackData();
    }

    // Fetch basecamps (PUBLIC READ - tidak perlu login)
    try {
        const { data: bData, error: bErr } = await supabaseClient.from('basecamps').select('*');
        if (bErr) console.warn('[Supabase] Basecamps fetch error:', bErr.message);
        if (bData && bData.length > 0) basecamps = bData;
        else if (basecamps.length === 0) loadFallbackData();
    } catch (err) {
        console.error('[Supabase] Basecamps exception:', err);
    }

    // Fetch employees (butuh login - auth.uid() IS NOT NULL)
    try {
        const { data: eData, error: eErr } = await supabaseClient.from('employees').select('*');
        if (eErr) {
            console.warn('[Supabase] Employees fetch error:', eErr.message, eErr.code);
            employees = []; // Reset ke empty agar tidak menampilkan data stale
            if (eErr.code === 'PGRST301' || eErr.message?.includes('JWT')) {
                console.log('[Supabase] Employees fetch skipped: user not authenticated');
            }
        } else {
            employees = (eData || []).map(e => ({
                id: e.id, name: e.name, position: e.position || '-', role: e.role,
                atasan: e.atasan, status: e.status, deviceId: e.device_id || 'Unbound', auth_id: e.auth_id
            }));
            console.log('[Supabase] Employees loaded:', employees.length, 'records');
        }
    } catch (err) {
        console.error('[Supabase] Employees exception:', err);
        employees = [];
    }

    // Fetch rekap (butuh login)
    try {
        const { data: rkData, error: rkErr } = await supabaseClient.from('rekap_list').select('*');
        if (rkErr) console.warn('[Supabase] Rekap fetch error:', rkErr.message);
        if (rkData) rekapList = rkData;
    } catch (err) {
        console.error('[Supabase] Rekap exception:', err);
    }

    // Fetch izin (butuh login)
    try {
        const { data: iData, error: iErr } = await supabaseClient.from('izin_list').select('*');
        if (iErr) console.warn('[Supabase] Izin fetch error:', iErr.message);
        if (iData) izinList = iData;
    } catch (err) {
        console.error('[Supabase] Izin exception:', err);
    }

    // Fetch emails (butuh login)
    try {
        const { data: emData, error: emErr } = await supabaseClient.from('emails').select('*').order('created_at', { ascending: false });
        if (emErr) console.warn('[Supabase] Emails fetch error:', emErr.message);
        if (emData) {
            const readIds = getReadEmailIds();
            emailsList = emData.map(e => ({
                id: e.id, sender: e.sender, sender_name: e.sender_name, receiver: e.recipient,
                subject: e.subject, message: e.message, created_at: e.created_at, read: readIds.includes(e.id)
            }));
        }
    } catch (err) {
        console.error('[Supabase] Emails exception:', err);
    }

    renderRoles(); renderEmployees(); renderRekap(); renderBasecamps();
    renderAdminIzin(); populateEmailRecipients(); renderEmails(); updateDashboardStats();
    updateServerStatusIndicator();
}

// ============================================================
// AUTH FUNCTIONS
// ============================================================
async function initAuth() {
    try {
        const { data: { session }, error: sessionErr } = await supabaseClient.auth.getSession();
        if (sessionErr) {
            console.warn('[Auth] Session error:', sessionErr.message);
            return;
        }
        if (session && session.user) {
            let empData = null;
            try {
                const { data, error } = await supabaseClient
                    .from('employees')
                    .select('*')
                    .eq('auth_id', session.user.id)
                    .maybeSingle();
                if (error) console.warn('[Auth] Employee fetch error:', error.message);
                empData = data;
            } catch (err) {
                console.error('[Auth] Employee fetch exception:', err);
            }
            if (empData && empData.status === 'Approved') {
                activeEmployeeSession = {
                    id: empData.id, name: empData.name, position: empData.position,
                    role: empData.role, atasan: empData.atasan, status: empData.status,
                    deviceId: empData.device_id, auth_id: empData.auth_id
                };
                document.getElementById('mobile-user-title').innerText = `Halo, ${empData.name}`;
                document.getElementById('mobile-user-initial').innerText = empData.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
                // Re-fetch semua data setelah login (karena employees sekarang butuh auth)
                await fetchAllDataFromSupabase();
                const readIds = getReadEmailIds();
                emailsList.forEach(e => { if (readIds.includes(e.id)) e.read = true; });
                renderMobileMyHistory(); renderEmails(); renderAdminIzin(); updateEmailBadges(); populateEmailRecipients();
            }
        }
    } catch (err) {
        console.error('[Auth] Init auth exception:', err);
    }
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
            document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
            document.getElementById('mobile-user-initial').innerText = 'T';
            employees = []; rekapList = []; izinList = []; emailsList = [];
            populateEmailRecipients(); updateEmailBadges(); switchMobileTab('daftar');
            await fetchAllDataFromSupabase(); // Re-fetch untuk reset data
        } else if (event === 'SIGNED_IN' && session) {
            // Re-fetch setelah sign in
            await fetchAllDataFromSupabase();
        }
    });
}

async function processLoginValidation(email, pass, isDesktop) {
    // ===== DEV BYPASS (HAPUS/KOMEN BLOK INI SEBELUM PRODUCTION) =====
    if (email === 'admin@acero.com' && pass === 'admin123') {
        activeEmployeeSession = {
            id: 'admin@acero.com',
            name: 'Master Admin',
            position: 'Administrator',
            role: 'Master Admin',
            atasan: 'Self',
            status: 'Approved',
            deviceId: 'DEV-BYPASS',
            auth_id: null
        };
        document.getElementById('mobile-user-title').innerText = `Halo, Master Admin`;
        document.getElementById('mobile-user-initial').innerText = 'MA';
        const readIds = getReadEmailIds();
        emailsList.forEach(e => { if (readIds.includes(e.id)) e.read = true; });
        renderMobileMyHistory(); renderEmails(); renderAdminIzin(); updateEmailBadges(); populateEmailRecipients();
        showToast('Login DEV BYPASS berhasil!', 'success');
        return true;
    }
    // ===== END DEV BYPASS =====

    if(!email || !pass) { showToast('Harap isi email dan password Anda.', 'error'); return false; }

    let authData, authError;
    try {
        const result = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
        authData = result.data; authError = result.error;
    } catch (e) {
        console.error('Auth exception:', e);
        showToast('Gagal menghubungi server autentikasi. Cek koneksi.', 'error');
        return false;
    }

    if (authError || !authData || !authData.user) {
        console.warn('Auth error details:', authError);
        const errMsg = (authError && authError.message) ? authError.message.toLowerCase() : '';
        if (errMsg.includes('invalid login credentials') || errMsg.includes('user not found')) {
            showToast('Akun belum terdaftar di sistem. Silakan daftar via menu Mobile (HP).', 'warning');
        } else if (errMsg.includes('email not confirmed')) {
            showToast('Email belum dikonfirmasi. Cek inbox atau hubungi Admin.', 'warning');
        } else {
            showToast('Login gagal: ' + (authError ? authError.message : 'Kredensial salah'), 'error');
        }
        return false;
    }
    const authUser = authData.user;
    let { data: empData, error: empErr } = await supabaseClient.from('employees').select('*').eq('auth_id', authUser.id).maybeSingle();
    if (empErr) {
        console.warn('[Auth] Fetch employee by auth_id error:', empErr.message);
    }
    if (!empData) {
        const { data: fallbackData, error: fallbackErr } = await supabaseClient.from('employees').select('*').eq('id', email).maybeSingle();
        if (fallbackErr) {
            console.warn('[Auth] Fetch employee by email error:', fallbackErr.message);
        }
        if (fallbackData) {
            await supabaseClient.from('employees').update({ auth_id: authUser.id }).eq('id', email);
            empData = fallbackData; empData.auth_id = authUser.id;
        }
    }
    if (!empData) { showToast('Data karyawan tidak ditemukan. Hubungi Admin.', 'error'); await supabaseClient.auth.signOut(); return false; }
    if(empData.status !== 'Approved') { showToast('Akun Anda masih berstatus Pending.', 'warning'); await supabaseClient.auth.signOut(); return false; }
    if (!isDesktop) {
        if (empData.device_id === 'Unbound' || !empData.device_id) {
            await supabaseClient.from('employees').update({ device_id: currentDeviceUUID }).eq('id', empData.id);
            empData.device_id = currentDeviceUUID;
            showToast('Perangkat berhasil diikat ke akun ini.', 'success'); renderEmployees();
        } else if (empData.device_id !== currentDeviceUUID) {
            await supabaseClient.auth.signOut();
            return showToast('SECURITY ALERT: Login Ditolak! Akun ini telah terikat pada perangkat lain.', 'error');
        }
    }
    activeEmployeeSession = { id: empData.id, name: empData.name, position: empData.position, role: empData.role, atasan: empData.atasan, status: empData.status, deviceId: empData.device_id, auth_id: empData.auth_id };
    document.getElementById('mobile-user-title').innerText = `Halo, ${empData.name}`;
    document.getElementById('mobile-user-initial').innerText = empData.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    // Re-fetch semua data setelah login berhasil
    await fetchAllDataFromSupabase();
    const readIds = getReadEmailIds();
    emailsList.forEach(e => { if (readIds.includes(e.id)) e.read = true; });
    renderMobileMyHistory(); renderEmails(); renderAdminIzin(); updateEmailBadges(); populateEmailRecipients();
    return true;
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const success = await processLoginValidation(email, pass, false);
    if(success) {
        document.getElementById('login-email').value = ''; document.getElementById('login-pass').value = '';
        showToast('Login berhasil!', 'success'); switchMobileTab('absen');
    }
}

async function handleDesktopLogin() {
    const email = document.getElementById('d-login-email').value.trim();
    const pass = document.getElementById('d-login-pass').value.trim();
    const success = await processLoginValidation(email, pass, true);
    if(success) {
        document.getElementById('d-login-email').value = ''; document.getElementById('d-login-pass').value = '';
        showToast('Login Enterprise berhasil!', 'success');
        document.getElementById('desktop-login-section').classList.add('hidden');
        document.getElementById('desktop-app-wrapper').classList.remove('hidden');
        applyRolePermissions();
    }
}

async function handleLogout(skipModeSwitch = false) {
    await supabaseClient.auth.signOut();
    activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
    document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
    document.getElementById('mobile-user-initial').innerText = 'T';
    populateEmailRecipients(); updateEmailBadges();
    showToast('Anda telah logout.', 'success');
    if (!skipModeSwitch) {
        switchMode('mobile');
        switchMobileTab('daftar');
    }
}

async function requestOTP() {
    const email = document.getElementById('reg-email').value.trim();
    const nama = document.getElementById('reg-nama').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    if (!email || !nama || !pass || !email.includes('@')) { showToast('Harap isi semua kolom dengan benar!', 'error'); return; }
    if (pass.length < 6) { showToast('Password minimal 6 karakter!', 'error'); return; }

    tempRegData = { email, nama, pass };
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpExpiryTime = Date.now() + (3 * 60 * 1000);

    const btnOTP = document.querySelector('#reg-step-1 button[onclick="requestOTP()"]');
    const originalText = btnOTP ? btnOTP.innerHTML : '';
    if(btnOTP) {
        btnOTP.disabled = true;
        btnOTP.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim OTP...';
    }

    // Helper: lanjut ke step 2 (sukses maupun fallback)
    const proceedToStep2 = (instructionHtml, toastType = 'success', toastMsg = 'Kode OTP berhasil dikirim!') => {
        const instElem = document.getElementById('otp-instruction-text');
        if (instElem) instElem.innerHTML = instructionHtml;
        showToast(toastMsg, toastType);
        document.getElementById('reg-step-1').classList.add('hidden');
        document.getElementById('reg-step-2').classList.remove('hidden');
        if(btnOTP) {
            btnOTP.disabled = false;
            btnOTP.innerHTML = originalText || 'Kirim Kode OTP';
        }
    };

    // Cek apakah EmailJS tersedia
    if (typeof emailjs === 'undefined' || !emailjsReady) {
        proceedToStep2(
            `<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">
                <p class="text-amber-400 font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Layanan Email Belum Siap</p>
                <p class="text-slate-300 text-[11px]">Gunakan kode OTP berikut untuk verifikasi:</p>
                <div class="text-3xl font-mono font-bold text-gold-400 tracking-[0.2em] my-2 text-center bg-slate-950 py-2 rounded-lg border border-slate-800">${generatedOTP}</div>
                <p class="text-[10px] text-slate-400">Kode berlaku 3 menit. Refresh halaman jika masalah berlanjut.</p>
            </div>`,
            'warning',
            'SendGrid/EmailJS belum siap. Gunakan kode OTP di bawah ini.'
        );
        return;
    }

    try {
        // EmailJS v4: public key sebagai parameter ke-4 lebih reliable
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
                // Parameter untuk EmailJS template (nama harus SAMA dengan variable di template)
                to_email: email,      // untuk template yang pakai {{to_email}}
                email: email,         // untuk template yang pakai {{email}} (screenshot test Anda)
                to: email,            // fallback untuk SendGrid
                recipient: email,     // fallback tambahan
                to_name: nama,
                otp_code: generatedOTP,
                from_name: 'KaryaOne ACM',
                message: `Kode OTP Anda adalah: ${generatedOTP}. Berlaku 3 menit.`
            },
            EMAILJS_PUBLIC_KEY
        );

        proceedToStep2(
            `Kode OTP telah dikirimkan ke email <b class="text-gold-400">${email}</b>. Silakan cek inbox/spam folder Anda.`,
            'success',
            'Kode OTP berhasil dikirim ke email Anda!'
        );

    } catch (error) {
        console.error('EmailJS Error:', error);
        const errorMsg = (error && error.text) ? error.text : (error && error.message ? error.message : 'Unknown error');

        // FALLBACK: Tetap tampilkan OTP di UI agar user bisa lanjut daftar
        proceedToStep2(
            `<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">
                <p class="text-amber-400 font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Gagal Mengirim Email</p>
                <p class="text-slate-300 text-[11px]">Email tidak dapat dikirim. Gunakan kode OTP di bawah ini:</p>
                <div class="text-3xl font-mono font-bold text-gold-400 tracking-[0.2em] my-2 text-center bg-slate-950 py-2 rounded-lg border border-slate-800">${generatedOTP}</div>
                <p class="text-[10px] text-slate-400">Error: ${errorMsg} | Kode berlaku 3 menit.</p>
            </div>`,
            'warning',
            'Email gagal terkirim. Gunakan kode OTP yang ditampilkan.'
        );
        // JANGAN reset generatedOTP & otpExpiryTime agar user tetap bisa verifikasi
    }
}

function backToRegStep1() {
    document.getElementById('reg-step-2').classList.add('hidden');
    document.getElementById('reg-step-1').classList.remove('hidden');
}

async function verifyOTP() {
    const otp = document.getElementById('reg-otp-input').value.trim();
    if (!generatedOTP) return showToast('Sesi OTP tidak valid.', 'error');
    if (Date.now() > otpExpiryTime) return showToast('Kode OTP sudah kedaluwarsa!', 'error');
    if (otp !== generatedOTP) return showToast('Kode OTP salah!', 'error');

    showToast('Mendaftarkan akun ke server...', 'info');
    
    let authData, authError;
    try {
        const result = await supabaseClient.auth.signUp({
            email: tempRegData.email, 
            password: tempRegData.pass, 
            options: { data: { name: tempRegData.nama } }
        });
        authData = result.data; 
        authError = result.error;
    } catch (e) {
        console.error('SignUp exception:', e);
        showToast('Gagal menghubungi server. Cek koneksi internet.', 'error');
        return;
    }

    if (authError) {
        console.warn('SignUp error:', authError);
        const errMsg = authError.message.toLowerCase();
        if (errMsg.includes('already') || errMsg.includes('registered')) {
            showToast('Email sudah terdaftar. Silakan login.', 'warning'); 
            toggleAuthMode('login'); 
            return;
        } else if (errMsg.includes('rate limit')) {
            showToast('Terlalu banyak percobaan. Tunggu 1 menit.', 'warning'); 
            return;
        }
        showToast('Gagal mendaftar: ' + authError.message, 'error'); 
        return;
    }

    const authId = authData && authData.user ? authData.user.id : null;
    if (!authId) {
        showToast('Gagal mendapatkan ID autentikasi.', 'error');
        return;
    }

    // LANGSUNG LOGIN agar session aktif untuk RLS policy
    try {
        const { error: loginErr } = await supabaseClient.auth.signInWithPassword({
            email: tempRegData.email,
            password: tempRegData.pass
        });
        if (loginErr) console.warn('Auto-login warning:', loginErr.message);
    } catch (e) {
        console.warn('Auto-login exception:', e);
    }

    // Tunggu trigger SQL berjalan (1.5 detik)
    await new Promise(r => setTimeout(r, 1500));

    // CEK: apakah trigger sudah membuat data?
    let existingEmp = null;
    let fetchErr = null;
    try {
        const { data, error } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('id', tempRegData.email)
            .maybeSingle();
        existingEmp = data;
        fetchErr = error;
        if (error) console.warn('[Verify] Fetch existing employee error:', error.message);
    } catch (err) {
        console.error('[Verify] Fetch existing employee exception:', err);
    }

    if (existingEmp) {
        // Trigger berhasil. Update nama jika trigger pakai default 'User Baru'
        if (existingEmp.name === 'User Baru' || !existingEmp.name) {
            await supabaseClient
                .from('employees')
                .update({ name: tempRegData.nama })
                .eq('id', tempRegData.email);
            existingEmp.name = tempRegData.nama;
        }
        // Update array lokal
        const idx = employees.findIndex(e => e.id === tempRegData.email);
        const empObj = { 
            id: existingEmp.id, 
            name: existingEmp.name, 
            position: existingEmp.position || 'Staff', 
            role: existingEmp.role,
            atasan: existingEmp.atasan,
            status: existingEmp.status,
            deviceId: existingEmp.device_id || 'Unbound',
            auth_id: existingEmp.auth_id
        };
        if (idx >= 0) employees[idx] = empObj; else employees.push(empObj);
        
        showToast('Registrasi berhasil! Akun Pending. Tunggu approval Admin.', 'success');
    } else {
        // FALLBACK: Trigger gagal, insert manual dengan session aktif
        showToast('Menyimpan data profil...', 'info');
        const { error: insertErr } = await supabaseClient
            .from('employees')
            .insert([{
                id: tempRegData.email,
                auth_id: authId,
                name: tempRegData.nama,
                position: 'Staff',
                role: 'Karyawan / Field',
                atasan: 'Master Admin',
                status: 'Pending',
                device_id: 'Unbound'
            }]);
        
        if (insertErr) {
            console.error('Insert employee error:', insertErr);
            showToast('Akun dibuat, tapi gagal menyimpan profil. Hubungi admin.', 'warning');
        } else {
            employees.push({
                id: tempRegData.email,
                name: tempRegData.nama,
                position: 'Staff',
                role: 'Karyawan / Field',
                atasan: 'Master Admin',
                status: 'Pending',
                deviceId: 'Unbound',
                auth_id: authId
            });
            showToast('Registrasi berhasil! Akun Pending. Tunggu approval Admin.', 'success');
        }
    }

    // Refresh semua data dari server
    await fetchAllDataFromSupabase();
    renderEmployees(); 
    updateDashboardStats(); 
    populateEmailRecipients();
    
    generatedOTP = null; 
    otpExpiryTime = null;
    document.getElementById('reg-otp-input').value = '';
    toggleAuthMode('login');
}

async function approveEmployeeAccount(index) {
    const emp = employees[index];
    emp.status = 'Approved';
    await supabaseClient.from('employees').update({ status: 'Approved' }).eq('id', emp.id);
    renderEmployees(); updateDashboardStats(); populateEmailRecipients();
    showToast('Akun disetujui!', 'success');
}

function resetEmployeeDevice(index) {
    if (!isMasterAdmin()) return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    showConfirm('Reset Perangkat', `Reset ikatan perangkat untuk ${employees[index].name}?`, async () => {
        employees[index].deviceId = 'Unbound';
        await supabaseClient.from('employees').update({ device_id: 'Unbound' }).eq('id', employees[index].id);
        renderEmployees(); showToast(`Perangkat ${employees[index].name} berhasil di-reset.`, 'success');
    }, false);
}

// ============================================================
// EMPLOYEE MODAL
// ============================================================
function openAddEmployeeModal() {
    document.getElementById('modal-title').innerText = "Tambah Karyawan Baru";
    document.getElementById('edit-index').value = "-1";
    document.getElementById('inp-id').value = ""; document.getElementById('inp-id').disabled = false;
    document.getElementById('inp-name').value = "";
    document.getElementById('inp-position').value = "";
    document.getElementById('inp-password').value = "";
    document.getElementById('employee-modal').classList.remove('hidden');
}

function openEditEmployeeModal(index) {
    const emp = employees[index];
    document.getElementById('modal-title').innerText = "Edit Data Karyawan";
    document.getElementById('edit-index').value = index;
    document.getElementById('inp-id').value = emp.id; document.getElementById('inp-id').disabled = true;
    document.getElementById('inp-name').value = emp.name;
    document.getElementById('inp-position').value = emp.position;
    document.getElementById('inp-role').value = emp.role;
    // Default ke --- (kosong) kalau tidak punya atasan
    document.getElementById('inp-atasan').value = emp.atasan || '';
    document.getElementById('inp-password').value = "••••••••";
    document.getElementById('employee-modal').classList.remove('hidden');
}
function closeEmployeeModal() { document.getElementById('employee-modal').classList.add('hidden'); }

async function saveEmployee() {
    const index = parseInt(document.getElementById('edit-index').value);
    const id = document.getElementById('inp-id').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    const position = document.getElementById('inp-position').value.trim();
    const role = document.getElementById('inp-role').value;
    const atasan = document.getElementById('inp-atasan').value;
    if (!id || !name) { showToast('ID/Email dan Nama wajib diisi!', 'error'); return; }
    if (index === -1) {
        const newEmp = { id, name, position: position || 'Staff', role, atasan, status: 'Pending', device_id: 'Unbound' };
        employees.push({ ...newEmp, deviceId: 'Unbound' });
        await supabaseClient.from('employees').insert([newEmp]);
        showToast('Karyawan baru ditambahkan. User harus register via mobile.', 'success');
    } else {
        const emp = employees[index];
        emp.name = name; emp.position = position; emp.role = role; emp.atasan = atasan;
        await supabaseClient.from('employees').update({ name, position, role, atasan }).eq('id', id);
        showToast('Data karyawan diperbarui.', 'success');
    }
    closeEmployeeModal(); renderEmployees(); updateDashboardStats(); populateEmailRecipients();
}

// ============================================================
// ROLE MODAL
// ============================================================
function openRoleModal() {
    document.getElementById('role-modal-title').innerText = "Tambah Role Baru";
    document.getElementById('role-edit-index').value = "-1";
    document.getElementById('inp-role-id').value = "";
    document.getElementById('inp-role-name').value = "";
    document.getElementById('inp-role-access').value = "";
    document.getElementById('role-modal').classList.remove('hidden');
}
function openEditRoleModal(index) {
    const r = roles[index];
    document.getElementById('role-modal-title').innerText = "Edit Role";
    document.getElementById('role-edit-index').value = index;
    document.getElementById('inp-role-id').value = r.id;
    document.getElementById('inp-role-name').value = r.name;
    document.getElementById('inp-role-access').value = r.access;
    document.getElementById('role-modal').classList.remove('hidden');
}
function closeRoleModal() { document.getElementById('role-modal').classList.add('hidden'); }

async function saveRole() {
    const index = parseInt(document.getElementById('role-edit-index').value);
    const id = document.getElementById('inp-role-id').value.trim();
    const name = document.getElementById('inp-role-name').value.trim();
    const access = document.getElementById('inp-role-access').value.trim();
    if(!id || !name) { showToast('ID dan Nama Role wajib diisi!', 'error'); return; }
    if(index === -1) {
        const newRole = { id, name, access }; roles.push(newRole);
        await supabaseClient.from('roles').insert([newRole]);
        showToast('Role baru ditambahkan.', 'success');
    } else {
        roles[index] = { id, name, access };
        await supabaseClient.from('roles').update({ name, access }).eq('id', id);
        showToast('Role diperbarui.', 'success');
    }
    closeRoleModal(); renderRoles();
}

// ============================================================
// BASECAMP MODAL
// ============================================================
function openAddBasecampModal() {
    const roleName = activeEmployeeSession.role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    document.getElementById('bc-modal-title').innerText = "Tambah Basecamp";
    document.getElementById('bc-edit-index').value = "-1";
    document.getElementById('bc-inp-name').value = "";
    document.getElementById('bc-inp-lat').value = "";
    document.getElementById('bc-inp-lng').value = "";
    document.getElementById('bc-inp-radius').value = "";
    document.getElementById('basecamp-modal').classList.remove('hidden');
}
function openEditBasecampModal(index) {
    const roleName = activeEmployeeSession.role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    const b = basecamps[index];
    document.getElementById('bc-modal-title').innerText = "Edit Basecamp";
    document.getElementById('bc-edit-index').value = index;
    document.getElementById('bc-inp-name').value = b.name;
    document.getElementById('bc-inp-lat').value = b.lat;
    document.getElementById('bc-inp-lng').value = b.lng;
    document.getElementById('bc-inp-radius').value = b.radius;
    document.getElementById('basecamp-modal').classList.remove('hidden');
}
function closeBasecampModal() { document.getElementById('basecamp-modal').classList.add('hidden'); }

async function saveBasecamp() {
    const roleName = activeEmployeeSession.role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    const index = parseInt(document.getElementById('bc-edit-index').value);
    const name = document.getElementById('bc-inp-name').value.trim();
    const lat = parseFloat(document.getElementById('bc-inp-lat').value);
    const lng = parseFloat(document.getElementById('bc-inp-lng').value);
    const radius = parseInt(document.getElementById('bc-inp-radius').value);
    if(!name || isNaN(lat) || isNaN(lng) || isNaN(radius)) { showToast('Harap isi data basecamp dengan benar!', 'error'); return; }
    if(index === -1) {
        const newBc = { id: Date.now(), name, lat, lng, radius }; basecamps.push(newBc);
        await supabaseClient.from('basecamps').insert([newBc]);
        showToast('Basecamp baru ditambahkan.', 'success');
    } else {
        const b = basecamps[index]; b.name = name; b.lat = lat; b.lng = lng; b.radius = radius;
        await supabaseClient.from('basecamps').update({ name, lat, lng, radius }).eq('id', b.id);
        showToast('Basecamp diperbarui.', 'success');
    }
    closeBasecampModal(); renderBasecamps();
}

// ============================================================
// ABSENSI & SELFIE
// ============================================================
async function handleAbsen() {
    if (activeEmployeeSession.name === 'Tamu') { showToast('Silakan login terlebih dahulu.', 'error'); switchMobileTab('daftar'); return; }
    const now = new Date();
    const wib = getWIBTimeParts(now);
    const currentTimeInSeconds = parseInt(wib.h) * 3600 + parseInt(wib.m) * 60 + parseInt(wib.s);
    const limitOpenInSeconds = 7 * 3600 + 45 * 60;
    const limitMaxInSeconds = 9 * 3600 + 40 * 60;
    if (currentTimeInSeconds < limitOpenInSeconds) { showToast('Absensi belum dibuka. Mulai 07:45 WIB.', 'warning'); return; }
    if (!navigator.geolocation) { showToast('Browser tidak mendukung GPS.', 'error'); return; }
    showToast('Mendeteksi lokasi GPS...', 'info');
    navigator.geolocation.getCurrentPosition((position) => {
        const userLat = position.coords.latitude; const userLng = position.coords.longitude;
        let validBasecamp = null;
        for (let bc of basecamps) {
            const dist = calculateDistance(userLat, userLng, parseFloat(bc.lat), parseFloat(bc.lng));
            if (dist <= parseFloat(bc.radius)) { validBasecamp = bc; break; }
        }
        // Tanggal WIB, bukan UTC
        pendingAbsenData = { 
            date: getWIBDateString(), 
            name: activeEmployeeSession.name, 
            basecamp: validBasecamp ? validBasecamp.name : 'Dinas Luar / Lapangan (Terverifikasi GPS)' 
        };
        openSelfieModal();
    }, (err) => { showToast('Gagal mendeteksi GPS. Aktifkan izin lokasi.', 'error'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}
function openSelfieModal() {
    document.getElementById('selfie-modal').classList.remove('hidden');
    const video = document.getElementById('selfie-video');
    video.classList.remove('hidden');
    document.getElementById('selfie-canvas').classList.add('hidden');
    document.getElementById('selfie-preview').classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => { mediaStream = stream; video.srcObject = stream; })
        .catch(err => { showToast('Gagal mengakses kamera: ' + err.message, 'error'); });
}

function captureSelfie() {
    const video = document.getElementById('selfie-video');
    const canvas = document.getElementById('selfie-canvas');
    const preview = document.getElementById('selfie-preview');
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6); preview.src = dataUrl;
    video.classList.add('hidden'); preview.classList.remove('hidden');
    document.getElementById('btn-capture').classList.add('hidden');
    document.getElementById('btn-retake').classList.remove('hidden');
    document.getElementById('btn-submit-absen').classList.remove('hidden');
    canvas.toBlob((blob) => { capturedBlob = blob; }, 'image/jpeg', 0.6);
}

function retakeSelfie() {
    const video = document.getElementById('selfie-video');
    const preview = document.getElementById('selfie-preview');
    video.classList.remove('hidden'); preview.classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');
    capturedBlob = null;
}

function closeSelfieModal() {
    if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); mediaStream = null; }
    document.getElementById('selfie-modal').classList.add('hidden');
}

async function submitAbsenWithSelfie() {
    if (!pendingAbsenData) { showToast('Data absensi tidak ditemukan.', 'error'); return; }
    const canvas = document.getElementById('selfie-canvas');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    
    // WIB explicit
    const now = new Date();
    const wib = getWIBTimeParts(now);
    const timeString = `${wib.h}:${wib.m}:${wib.s}`;
    const dateStr = getWIBDateString(now);
    
    let status = 'Tepat Waktu'; let lateStr = '-';
    const limitMaxInSeconds = 9 * 3600 + 40 * 60;
    const currentS = parseInt(wib.h) * 3600 + parseInt(wib.m) * 60 + parseInt(wib.s);
    if (currentS > limitMaxInSeconds) {
        status = 'Terlambat';
        const diff = currentS - limitMaxInSeconds;
        const dh = Math.floor(diff / 3600); const dm = Math.floor((diff % 3600) / 60); const ds = diff % 60;
        lateStr = `${dh}:${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')}`;
    }
    const newRekap = { date: dateStr, name: pendingAbsenData.name, basecamp: pendingAbsenData.basecamp, time: timeString, status: status, late: lateStr, selfie_url: dataUrl };
    try {
        const { data, error } = await supabaseClient.from('rekap_list').insert([newRekap]).select();
        if (error) throw error;
        if (data && data.length > 0) rekapList.push(data[0]); else rekapList.push(newRekap);
        showToast(`Absen berhasil! Jam: ${timeString} WIB`, 'success');
        const jamMasukEl = document.getElementById('mobile-jam-masuk');
        if (jamMasukEl) jamMasukEl.innerText = `${timeString} WIB`;
        closeSelfieModal(); renderRekap(); renderMobileMyHistory(); updateDashboardStats();
    } catch (err) { console.error("Error:", err); showToast('Gagal menyimpan absensi.', 'error'); }
}
// ============================================================
// IZIN
// ============================================================
async function submitMobileIzin() {
    if (activeEmployeeSession.name === 'Tamu') { showToast('Silakan login terlebih dahulu.', 'error'); switchMobileTab('daftar'); return; }
    const jenis = document.getElementById('m-izin-jenis').value;
    const start = document.getElementById('m-izin-start').value;
    const end = document.getElementById('m-izin-end').value;
    const desc = document.getElementById('m-izin-desc').value.trim();
    if (!start || !end || !desc) { showToast('Harap lengkapi semua data pengajuan!', 'error'); return; }
    const atasanName = activeEmployeeSession.atasan || 'Master Admin';
    const newIzin = { id: Date.now(), name: activeEmployeeSession.name, jenis: jenis, start: start, end: end, desc: desc, atasan: atasanName, status: 'Pending' };
    izinList.push(newIzin);
    await supabaseClient.from('izin_list').insert([newIzin]);
    renderAdminIzin(); renderMobileMyHistory(); updateDashboardStats();
    showToast('Permohonan izin berhasil diajukan.', 'success');
    document.getElementById('m-izin-start').value = ''; document.getElementById('m-izin-end').value = ''; document.getElementById('m-izin-desc').value = '';
}

async function updateIzinStatus(id, newStatus) {
    const izin = izinList.find(i => i.id === id);
    if(izin) { izin.status = newStatus; await supabaseClient.from('izin_list').update({ status: newStatus }).eq('id', id); renderAdminIzin(); renderMobileMyHistory(); updateDashboardStats(); showToast(`Status izin diubah menjadi ${newStatus}.`, 'success'); }
}

// ============================================================
// EMAIL
// ============================================================
async function sendAppEmail(mode) {
    if (activeEmployeeSession.name === 'Tamu') { showToast('Silakan login terlebih dahulu.', 'error'); return; }
    const prefix = mode === 'mobile' ? 'm' : 'd';
    const recipient = document.getElementById(`${prefix}-email-recipient`).value;
    const subject = document.getElementById(`${prefix}-email-subject`).value.trim();
    const message = document.getElementById(`${prefix}-email-message`).value.trim();
    if (!subject || !message) { showToast('Subjek dan isi pesan wajib diisi!', 'error'); return; }
    const newEmail = { sender: activeEmployeeSession.id, sender_name: activeEmployeeSession.name, recipient: recipient, subject: subject, message: message, created_at: new Date().toISOString() };
    const { data, error } = await supabaseClient.from('emails').insert([newEmail]).select();
    if (error) { showToast('Gagal mengirim pesan.', 'error'); return; }
    if (data && data.length > 0) {
        emailsList.unshift({ id: data[0].id, sender: data[0].sender, sender_name: data[0].sender_name, receiver: data[0].recipient, subject: data[0].subject, message: data[0].message, created_at: data[0].created_at, read: true });
    }
    showToast('Pesan berhasil dikirim!', 'success');
    if (mode === 'mobile') switchMobileEmailSub('inbox'); else switchDesktopEmailSub('inbox');
    renderEmails(); updateEmailBadges();
}

function openEmailDetail(emailId) {
    const email = emailsList.find(e => e.id === emailId);
    if (!email) return;
    activeSelectedEmail = email; markEmailAsRead(email.id);
    document.getElementById('detail-email-sender').innerText = email.sender_name || email.sender;
    document.getElementById('detail-email-receiver').innerText = getEmployeeDisplayName(email.receiver);
    document.getElementById('detail-email-time').innerText = formatWIBDateTime(email.created_at);
    document.getElementById('detail-email-subject').innerText = email.subject;
    document.getElementById('detail-email-message').innerText = email.message;
    const btnReply = document.getElementById('btn-reply-email');
    if (email.sender === activeEmployeeSession.id) btnReply.classList.add('hidden'); else btnReply.classList.remove('hidden');
    document.getElementById('email-detail-modal').classList.remove('hidden');
}

function closeEmailDetailModal() { document.getElementById('email-detail-modal').classList.add('hidden'); activeSelectedEmail = null; }

function replyEmail() {
    if (!activeSelectedEmail) return;
    const targetSender = activeSelectedEmail.sender;
    const subjectReply = "Re: " + activeSelectedEmail.subject;
    closeEmailDetailModal();
    if (document.getElementById('view-desktop').classList.contains('hidden')) {
        switchMobileTab('email'); switchMobileEmailSub('compose');
        document.getElementById('m-email-recipient').value = targetSender;
        document.getElementById('m-email-subject').value = subjectReply;
        document.getElementById('m-email-message').value = "\n\n--- Pesan Dibalas ---\n" + activeSelectedEmail.message;
    } else {
        switchDesktopTab('email'); switchDesktopEmailSub('compose');
        document.getElementById('d-email-recipient').value = targetSender;
        document.getElementById('d-email-subject').value = subjectReply;
        document.getElementById('d-email-message').value = "\n\n--- Pesan Dibalas ---\n" + activeSelectedEmail.message;
    }
}

async function deleteEmailItem(emailId) {
    showConfirm('Hapus Pesan', 'Apakah Anda yakin ingin menghapus pesan ini?', async () => {
        await supabaseClient.from('emails').delete().eq('id', emailId);
        emailsList = emailsList.filter(e => e.id !== emailId);
        renderEmails(); updateEmailBadges(); showToast('Pesan berhasil dihapus.', 'success');
    });
}

// ============================================================
// REKAP & EXPORT
// ============================================================
function filterRekap() {
    const start = document.getElementById('rekap-start-date').value;
    const end = document.getElementById('rekap-end-date').value;
    let filtered = rekapList;
    if (activeEmployeeSession.role === 'Karyawan / Field') {
        filtered = filtered.filter(r => r.name === activeEmployeeSession.name);
    }
    if(start && end) {
        filtered = filtered.filter(r => r.date >= start && r.date <= end);
    }
    renderRekapDataToTable(filtered); showToast('Filter rekap berhasil.', 'success');
}

function resetRekapData() {
    // C. Admin (dan role lain) tidak boleh reset data. Hanya Master Admin.
    if (activeEmployeeSession.role !== 'Master Admin') return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    showConfirm('Reset Data Rekap', 'Hapus seluruh data rekap absensi?', async () => {
        await supabaseClient.from('rekap_list').delete().neq('id', 0);
        rekapList = []; renderRekap(); updateDashboardStats();
        showToast('Data rekap berhasil di-reset.', 'success');
    });
}

function exportToExcel() {
    let dataToExport = rekapList;
    if (activeEmployeeSession.role === 'Karyawan / Field') {
        dataToExport = rekapList.filter(r => r.name === activeEmployeeSession.name);
    }
    if(dataToExport.length === 0) return showToast('Tidak ada data rekap.', 'warning');
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    XLSX.writeFile(workbook, "Rekap_Absensi_Enterprise.xlsx");
    showToast('File Excel berhasil di-download.', 'success');
}

// ============================================================
// UI SWITCH FUNCTIONS
// ============================================================
function switchMode(mode) {
    if (activeEmployeeSession && activeEmployeeSession.name !== 'Tamu') {
        handleLogout(true).then(() => {
            showToast('Logout otomatis: beralih mode perangkat.', 'info');
            executeSwitchMode(mode);
        });
        return;
    }
    executeSwitchMode(mode);
}

function executeSwitchMode(mode) {
    document.getElementById('view-mobile').classList.add('hidden');
    document.getElementById('view-desktop').classList.add('hidden');
    if (mode === 'mobile') {
        document.getElementById('view-mobile').classList.remove('hidden');
        document.getElementById('btn-mobile').className = "px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2";
        document.getElementById('btn-desktop').className = "px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2";
        switchMobileTab('daftar');
    } else {
        document.getElementById('view-desktop').classList.remove('hidden');
        document.getElementById('btn-desktop').className = "px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2";
        document.getElementById('btn-mobile').className = "px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2";
        document.getElementById('desktop-login-section').classList.remove('hidden');
        document.getElementById('desktop-app-wrapper').classList.add('hidden');
    }
}

function switchMobileTab(tab) {
    ['daftar', 'absen', 'izin', 'email'].forEach(t => {
        const tabEl = document.getElementById(`m-tab-${t}`);
        if(tabEl) tabEl.classList.add('hidden');
        const btn = document.getElementById(`m-nav-${t}`);
        if(btn) { btn.classList.remove('text-gold-400'); btn.classList.add('text-slate-400'); }
    });
    const activeTabEl = document.getElementById(`m-tab-${tab}`);
    if(activeTabEl) activeTabEl.classList.remove('hidden');
    const activeBtn = document.getElementById(`m-nav-${tab}`);
    if(activeBtn) { activeBtn.classList.remove('text-slate-400'); activeBtn.classList.add('text-gold-400'); }
    if (tab === 'email') switchMobileEmailSub('inbox');
    if (tab === 'izin') renderMobileMyHistory();
}

function switchMobileEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(s => {
        const sec = document.getElementById(`m-email-${s}-section`);
        const btn = document.getElementById(`m-btn-${s}`);
        if(sec) sec.classList.add('hidden');
        if(btn) btn.className = s === sub ? "px-3 py-1.5 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 transition" : "px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition";
    });
    const activeSec = document.getElementById(`m-email-${sub}-section`);
    if(activeSec) activeSec.classList.remove('hidden');
    if (sub === 'compose') {
        const rec = document.getElementById('m-email-recipient');
        const subj = document.getElementById('m-email-subject');
        const msg = document.getElementById('m-email-message');
        if(rec) rec.value = 'BROADCAST'; if(subj) subj.value = ''; if(msg) msg.value = '';
    }
    if(sub === 'inbox' || sub === 'sent') renderEmails();
}

function switchDesktopEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(s => {
        const sec = document.getElementById(`d-email-${s}-section`);
        const btn = document.getElementById(`d-btn-${s}`);
        if(sec) sec.classList.add('hidden');
        if(btn) btn.className = s === sub ? "px-4 py-2 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 shadow" : "px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-slate-300 border border-slate-800";
    });
    const activeSec = document.getElementById(`d-email-${sub}-section`);
    if(activeSec) activeSec.classList.remove('hidden');
    if (sub === 'compose') {
        const rec = document.getElementById('d-email-recipient');
        const subj = document.getElementById('d-email-subject');
        const msg = document.getElementById('d-email-message');
        if(rec) rec.value = 'BROADCAST'; if(subj) subj.value = ''; if(msg) msg.value = '';
    }
    if(sub === 'inbox' || sub === 'sent') renderEmails();
}

function switchDesktopTab(tab) {
    ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin', 'email'].forEach(t => {
        const el = document.getElementById(`d-tab-${t}`);
        const btn = document.getElementById(`d-nav-${t}`);
        if(el) el.classList.add('hidden');
        if(btn) btn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all";
    });
    const activeEl = document.getElementById(`d-tab-${tab}`);
    const activeBtn = document.getElementById(`d-nav-${tab}`);
    if(activeEl) activeEl.classList.remove('hidden');
    if(activeBtn) activeBtn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 transition-all";
    if(tab === 'rekap') renderRekap();
    if(tab === 'karyawan') renderEmployees();
    if(tab === 'basecamp') { renderBasecamps(); setTimeout(() => { if(bcMap) bcMap.invalidateSize(); }, 200); }
    if(tab === 'email') switchDesktopEmailSub('inbox');
}

function applyRolePermissions() {
    document.getElementById('desktop-user-initial').innerText = activeEmployeeSession.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('desktop-role-label').innerText = activeEmployeeSession.role;
    const roleName = activeEmployeeSession.role;

    // Sembunyikan semua menu navigasi terlebih dahulu
    const menuMapping = { 
        'dashboard': 'd-nav-dashboard', 
        'rekap': 'd-nav-rekap', 
        'role': 'd-nav-role', 
        'karyawan': 'd-nav-karyawan', 
        'basecamp': 'd-nav-basecamp', 
        'izin': 'd-nav-izin', 
        'email': 'd-nav-email' 
    };
    for (const [key, btnId] of Object.entries(menuMapping)) {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.add('hidden');
    }

    // Dashboard selalu tampil untuk semua role
    const dashBtn = document.getElementById('d-nav-dashboard');
    if (dashBtn) dashBtn.classList.remove('hidden');

    // Permission berdasarkan role spesifik
    if (roleName === 'Master Admin') {
        // Master Admin: akses penuh ke semua menu
        for (const [key, btnId] of Object.entries(menuMapping)) {
            if (key === 'dashboard') continue;
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.remove('hidden');
        }
    } else if (roleName === 'Karyawan / Field') {
        // A. Karyawan / Field: dashboard, rekap, email, basecamp (view only)
        // Karyawan, Izin, Role di-hidden
        ['rekap', 'email', 'basecamp'].forEach(key => {
            const btn = document.getElementById(menuMapping[key]);
            if (btn) btn.classList.remove('hidden');
        });
    } else if (roleName === 'Supervisor Field') {
        // B. Supervisor Field: dashboard, rekap (read all), izin (atasan dia), email, basecamp (add/edit, no delete)
        // Karyawan, Role di-hidden
        ['rekap', 'izin', 'email', 'basecamp'].forEach(key => {
            const btn = document.getElementById(menuMapping[key]);
            if (btn) btn.classList.remove('hidden');
        });
    } else if (roleName === 'Admin') {
        // C. Admin: dashboard, rekap (no reset), izin (view only all), email, basecamp (view only)
        // Karyawan, Role di-hidden
        ['rekap', 'izin', 'email', 'basecamp'].forEach(key => {
            const btn = document.getElementById(menuMapping[key]);
            if (btn) btn.classList.remove('hidden');
        });
    } else {
        // Fallback: gunakan data dari tabel roles jika ada
        const rData = roles.find(r => r.name === roleName);
        const accessStr = rData ? rData.access.toLowerCase() : '';
        for (const [key, btnId] of Object.entries(menuMapping)) {
            if (key === 'dashboard') continue;
            const btn = document.getElementById(btnId);
            if (btn && accessStr.includes(key)) btn.classList.remove('hidden');
        }
    }

    // Basecamp: tombol "Tambah Basecamp"
    const btnAddBasecamp = document.getElementById('btn-add-basecamp');
    if (btnAddBasecamp) {
        // Hanya Master Admin dan Supervisor Field yang bisa tambah basecamp
        if (roleName === 'Master Admin' || roleName === 'Supervisor Field') {
            btnAddBasecamp.classList.remove('hidden');
        } else {
            btnAddBasecamp.classList.add('hidden');
        }
    }

    // Rekap: tombol "Reset Data" hanya untuk Master Admin
    const btnResetRekap = document.getElementById('btn-reset-rekap');
    if (btnResetRekap) {
        if (roleName === 'Master Admin') btnResetRekap.classList.remove('hidden');
        else btnResetRekap.classList.add('hidden');
    }

    switchDesktopTab('dashboard');
}

function toggleAuthMode(mode) {
    if (mode === 'login') {
        document.getElementById('login-step').classList.remove('hidden');
        document.getElementById('reg-step-1').classList.add('hidden');
        document.getElementById('reg-step-2').classList.add('hidden');
    } else {
        document.getElementById('login-step').classList.add('hidden');
        document.getElementById('reg-step-1').classList.remove('hidden');
        document.getElementById('reg-step-2').classList.add('hidden');
    }
}

// ============================================================
// REALTIME
// ============================================================
function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') return;
    supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, (payload) => {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
        }).subscribe();
    supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, (payload) => {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        }).subscribe();
}

// ============================================================
// CLOCK
// ============================================================
setInterval(() => {
    const el = document.getElementById('live-clock');
    if(el) el.innerText = new Date().toLocaleTimeString('id-ID', { 
        timeZone: 'Asia/Jakarta', 
        hour12: false 
    }) + ' WIB';
}, 1000);

// ============================================================
// EVENT LISTENERS (PALING AKHIR - setelah semua fn defined)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Retry EmailJS init jika pertama kali gagal
    if (!emailjsReady) initEmailJS();

    document.getElementById('confirm-btn-yes').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirmModal();
    });
    setTimeout(async () => {
        await initializeDeviceBinding();
        await initAuth();
        await fetchAllDataFromSupabase();
        initSupabaseRealtime();
        updateServerStatusIndicator();

        // Inject tombol refresh ke header tab karyawan jika belum ada
        const karyawanHeader = document.querySelector('#d-tab-karyawan .flex.justify-between');
        if (karyawanHeader && !document.getElementById('btn-refresh-karyawan')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'btn-refresh-karyawan';
            refreshBtn.className = 'px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1 transition ml-2';
            refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
            refreshBtn.onclick = refreshAllData;
            karyawanHeader.appendChild(refreshBtn);
        }
    }, 500);
});

// ============================================================
// SERVER STATUS INDICATOR (REAL)
// ============================================================
function updateServerStatusIndicator() {
    const indicators = document.querySelectorAll('.server-status-indicator');
    if (indicators.length === 0) return;
    indicators.forEach(el => {
        if (supabaseConnected) {
            el.innerHTML = '<i class="fa-solid fa-circle text-emerald-500 text-[8px]"></i> Server Online (Supabase)';
            el.classList.remove('text-rose-400');
            el.classList.add('text-slate-400');
        } else {
            el.innerHTML = '<i class="fa-solid fa-circle text-rose-500 text-[8px]"></i> Server Offline / Error';
            el.classList.remove('text-slate-400');
            el.classList.add('text-rose-400');
        }
    });
}
