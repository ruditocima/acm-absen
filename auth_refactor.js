// ============================================================
// REFACTOR: SUPABASE AUTH (Drop-in Replacement)
// Gantikan SELURUH blok <script> lama dengan kode ini
// HTML, CSS, dan Modal tidak diubah sama sekali
// ============================================================

const SUPABASE_URL = 'https://gviqfdbuoruqldsbbrxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aXFmZGJ1b3J1cWxkc2JicnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjU1MzksImV4cCI6MjEwMjIwMTUzOX0.RalUZTRpAKswYK0SxdJjZWkY1wQb1V0JFKmXu8i0Lo0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentDeviceUUID = "PENDING";

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

let generatedOTP = null;
let otpExpiryTime = null;

async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        const { data: empData } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('auth_id', session.user.id)
            .single();
        if (empData && empData.status === 'Approved') {
            activeEmployeeSession = {
                id: empData.id, name: empData.name, position: empData.position,
                role: empData.role, atasan: empData.atasan, status: empData.status,
                deviceId: empData.device_id, auth_id: empData.auth_id
            };
            document.getElementById('mobile-user-title').innerText = `Halo, ${empData.name}`;
            document.getElementById('mobile-user-initial').innerText = empData.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            const readIds = getReadEmailIds();
            emailsList.forEach(e => { if (readIds.includes(e.id)) e.read = true; });
            renderMobileMyHistory(); renderEmails(); renderAdminIzin(); updateEmailBadges(); populateEmailRecipients();
        }
    }
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
            document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
            document.getElementById('mobile-user-initial').innerText = 'T';
            populateEmailRecipients(); updateEmailBadges(); switchMobileTab('daftar');
        }
    });
}

function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') return;
    supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, (payload) => {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui secara real-time.', 'info');
        }).subscribe();
    supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, (payload) => {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        }).subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => { await initAuth(); await fetchAllDataFromSupabase(); initSupabaseRealtime(); }, 1000);
});

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

let confirmCallback = null;
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
document.getElementById('confirm-btn-yes').addEventListener('click', () => { if (confirmCallback) confirmCallback(); closeConfirmModal(); });

function openImageZoom(url, caption = 'Foto Selfie Absensi') {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    const cap = document.getElementById('zoomed-caption');
    if (modal && img) { img.src = url; if (cap) cap.innerText = caption; modal.classList.remove('hidden'); }
}
function closeImageZoom() {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    if (modal) { modal.classList.add('hidden'); if (img) img.src = ''; }
}

let roles = [
    { id: 'ROL-01', name: 'Master Admin', access: 'Dashboard, Rekap, Role, Karyawan, Basecamp, Izin, Email' },
    { id: 'ROL-02', name: 'Manajer Lapangan', access: 'Dashboard, Rekap, Karyawan, Basecamp, Izin, Email' },
    { id: 'ROL-03', name: 'Karyawan / Field', access: 'Dashboard, Izin, Email' }
];
let employees = [];
let basecamps = [{ id: 1, name: 'Basecamp Pekanbaru Pusat', lat: 0.434291, lng: 101.466385, radius: 1500 }];
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
function getEmployeeDisplayName(emailOrId) {
    if (!emailOrId || emailOrId === 'BROADCAST') return 'BROADCAST (Semua Karyawan)';
    const emp = employees.find(e => e.id === emailOrId);
    return emp ? emp.name : emailOrId;
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
setInterval(() => {
    const el = document.getElementById('live-clock');
    if(el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
}, 1000);

async function fetchAllDataFromSupabase() {
    try {
        const { data: rData } = await supabaseClient.from('roles').select('*');
        if (rData && rData.length > 0) roles = rData;
        const { data: eData } = await supabaseClient.from('employees').select('*');
        if (eData && eData.length > 0) {
            employees = eData.map(e => ({
                id: e.id, name: e.name, position: e.position || '-', role: e.role,
                atasan: e.atasan, status: e.status, deviceId: e.device_id || 'Unbound', auth_id: e.auth_id
            }));
        }
        const { data: bData } = await supabaseClient.from('basecamps').select('*');
        if (bData && bData.length > 0) basecamps = bData;
        const { data: rkData } = await supabaseClient.from('rekap_list').select('*');
        if (rkData) rekapList = rkData;
        const { data: iData } = await supabaseClient.from('izin_list').select('*');
        if (iData) izinList = iData;
        const { data: emData } = await supabaseClient.from('emails').select('*').order('created_at', { ascending: false });
        if (emData) {
            const readIds = getReadEmailIds();
            emailsList = emData.map(e => ({
                id: e.id, sender: e.sender, sender_name: e.sender_name, receiver: e.recipient,
                subject: e.subject, message: e.message, created_at: e.created_at, read: readIds.includes(e.id)
            }));
        }
        renderRoles(); renderEmployees(); renderRekap(); renderBasecamps();
        renderAdminIzin(); populateEmailRecipients(); renderEmails(); updateDashboardStats();
    } catch (err) {
        console.error("Gagal sinkronisasi:", err);
        showToast("Gagal memuat data dari server.", "warning");
    }
}

function isMasterAdmin() { return activeEmployeeSession.role === 'Master Admin'; }

function switchMode(mode) {
    document.getElementById('view-mobile').classList.add('hidden');
    document.getElementById('view-desktop').classList.add('hidden');
    if (mode === 'mobile') {
        document.getElementById('view-mobile').classList.remove('hidden');
        document.getElementById('btn-mobile').className = "px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2";
        document.getElementById('btn-desktop').className = "px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2";
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
    if(tab === 'basecamp') setTimeout(() => { if(bcMap) bcMap.invalidateSize(); }, 200);
    if(tab === 'email') switchDesktopEmailSub('inbox');
}

function applyRolePermissions() {
    document.getElementById('desktop-user-initial').innerText = activeEmployeeSession.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('desktop-role-label').innerText = activeEmployeeSession.role;
    const roleName = activeEmployeeSession.role;
    const rData = roles.find(r => r.name === roleName);
    const accessStr = (roleName === 'Master Admin') ? 'dashboard, rekap, role, karyawan, basecamp, izin, email' : (rData ? rData.access.toLowerCase() : '');
    const isAtasanOrManager = isMasterAdmin() || roleName.includes('Admin') || roleName.includes('Manajer') || employees.some(e => e.atasan === activeEmployeeSession.name);
    const menuMapping = { 'dashboard': 'd-nav-dashboard', 'rekap': 'd-nav-rekap', 'role': 'd-nav-role', 'karyawan': 'd-nav-karyawan', 'basecamp': 'd-nav-basecamp', 'izin': 'd-nav-izin', 'email': 'd-nav-email' };
    for (const [key, btnId] of Object.entries(menuMapping)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (key === 'izin') {
                if (isAtasanOrManager && (accessStr.includes('izin') || isMasterAdmin() || roleName.includes('Manajer') || roleName.includes('Admin'))) btn.classList.remove('hidden');
                else btn.classList.add('hidden');
            } else {
                if (accessStr.includes(key)) btn.classList.remove('hidden');
                else btn.classList.add('hidden');
            }
        }
    }
    switchDesktopTab('dashboard');
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
    document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
    document.getElementById('mobile-user-initial').innerText = 'T';
    populateEmailRecipients(); updateEmailBadges();
    showToast('Anda telah logout dari sistem.', 'success');
    switchMode('mobile'); switchMobileTab('daftar');
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

// ==========================================
// AUTH REFACTOR: LOGIN & REGISTER
// ==========================================
async function processLoginValidation(email, pass, isDesktop = false) {
    if(!email || !pass) { showToast('Harap isi email dan password Anda.', 'error'); return false; }
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
    if (authError || !authData.user) { showToast('Kombinasi Email dan Password salah!', 'error'); return false; }
    const authUser = authData.user;
    let { data: empData } = await supabaseClient.from('employees').select('*').eq('auth_id', authUser.id).single();
    if (!empData) {
        const { data: fallbackData } = await supabaseClient.from('employees').select('*').eq('id', email).single();
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
            showToast(`Perangkat berhasil diikat ke akun ini.`, 'success'); renderEmployees();
        } else if (empData.device_id !== currentDeviceUUID) {
            await supabaseClient.auth.signOut();
            return showToast('SECURITY ALERT: Login Ditolak! Akun ini telah terikat pada perangkat lain.', 'error');
        }
    }
    activeEmployeeSession = { id: empData.id, name: empData.name, position: empData.position, role: empData.role, atasan: empData.atasan, status: empData.status, deviceId: empData.device_id, auth_id: empData.auth_id };
    document.getElementById('mobile-user-title').innerText = `Halo, ${empData.name}`;
    document.getElementById('mobile-user-initial').innerText = empData.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
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
        showToast('Login berhasil! Mengarahkan ke panel absensi...', 'success'); switchMobileTab('absen');
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

function requestOTP() {
    const email = document.getElementById('reg-email').value.trim();
    const nama = document.getElementById('reg-nama').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    if (!email || !nama || !pass || !email.includes('@')) { showToast('Harap isi semua kolom dengan benar!', 'error'); return; }
    if (pass.length < 6) { showToast('Password minimal 6 karakter!', 'error'); return; }
    tempRegData = { email, nama, pass };
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpExpiryTime = Date.now() + (3 * 60 * 1000);
    const instElem = document.getElementById('otp-instruction-text');
    if (instElem) instElem.innerHTML = `Kode OTP telah dikirimkan ke Email terdaftar Anda. (Simulasi OTP: <b class="text-gold-400">${generatedOTP}</b>)`;
    showToast(`Kode OTP terkirim! (Simulasi: Gunakan ${generatedOTP})`, 'success');
    document.getElementById('reg-step-1').classList.add('hidden');
    document.getElementById('reg-step-2').classList.remove('hidden');
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
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: tempRegData.email, password: tempRegData.pass, options: { data: { name: tempRegData.nama } }
    });
    if (authError) {
        if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('already exists')) {
            showToast('Email sudah terdaftar. Silakan login.', 'warning'); toggleAuthMode('login'); return;
        }
        showToast('Gagal mendaftar: ' + authError.message, 'error'); return;
    }
    await supabaseClient.from('employees').update({ name: tempRegData.nama, status: 'Pending' }).eq('id', tempRegData.email);
    showToast('Registrasi berhasil! Akun berstatus Pending. Tunggu approval Admin.', 'success');
    renderEmployees(); updateDashboardStats();
    generatedOTP = null; otpExpiryTime = null;
    document.getElementById('reg-otp-input').value = '';
    toggleAuthMode('login');
}

async function approveEmployeeAccount(index) {
    const emp = employees[index];
    emp.status = 'Approved';
    await supabaseClient.from('employees').update({ status: 'Approved' }).eq('id', emp.id);
    renderEmployees(); updateDashboardStats(); populateEmailRecipients();
    showToast(`Akun disetujui!`, 'success');
}

function resetEmployeeDevice(index) {
    if (!isMasterAdmin()) return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    showConfirm('Reset Perangkat', `Reset ikatan perangkat untuk ${employees[index].name}?`, async () => {
        employees[index].deviceId = 'Unbound';
        await supabaseClient.from('employees').update({ device_id: 'Unbound' }).eq('id', employees[index].id);
        renderEmployees();
        showToast(`Perangkat ${employees[index].name} berhasil di-reset.`, 'success');
    }, false);
}

function openAddEmployeeModal() {
    document.getElementById('modal-title').innerText = "Tambah Karyawan Baru";
    document.getElementById('edit-index').value = "-1";
    document.getElementById('inp-id').value = "";
    document.getElementById('inp-id').disabled = false;
    document.getElementById('inp-name').value = "";
    document.getElementById('inp-position').value = "";
    document.getElementById('inp-password').value = "";
    document.getElementById('employee-modal').classList.remove('hidden');
}

function openEditEmployeeModal(index) {
    const emp = employees[index];
    document.getElementById('modal-title').innerText = "Edit Data Karyawan";
    document.getElementById('edit-index').value = index;
    document.getElementById('inp-id').value = emp.id;
    document.getElementById('inp-id').disabled = true;
    document.getElementById('inp-name').value = emp.name;
    document.getElementById('inp-position').value = emp.position;
    document.getElementById('inp-role').value = emp.role;
    document.getElementById('inp-atasan').value = emp.atasan || 'Master Admin';
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
        showToast('Data karyawan berhasil diperbarui.', 'success');
    }
    closeEmployeeModal(); renderEmployees(); updateDashboardStats(); populateEmailRecipients();
}

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

async function handleAbsen() {
    if (activeEmployeeSession.name === 'Tamu') { showToast('Silakan login terlebih dahulu.', 'error'); switchMobileTab('daftar'); return; }
    const now = new Date();
    const currentTimeInSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
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
        pendingAbsenData = { date: new Date().toISOString().split('T')[0], name: activeEmployeeSession.name, basecamp: validBasecamp ? validBasecamp.name : 'Dinas Luar / Lapangan (Terverifikasi GPS)' };
        openSelfieModal();
    }, (err) => { showToast('Gagal mendeteksi GPS. Aktifkan izin lokasi.', 'error'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180; const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const timeString = `${h}:${m}:${s}`;
    let status = 'Tepat Waktu'; let lateStr = '-';
    const limitMaxInSeconds = 9 * 3600 + 40 * 60;
    const currentS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    if (currentS > limitMaxInSeconds) {
        status = 'Terlambat';
        const diff = currentS - limitMaxInSeconds;
        const dh = Math.floor(diff / 3600); const dm = Math.floor((diff % 3600) / 60); const ds = diff % 60;
        lateStr = `${dh}:${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')}`;
    }
    const newRekap = { date: pendingAbsenData.date, name: pendingAbsenData.name, basecamp: pendingAbsenData.basecamp, time: timeString, status: status, late: lateStr, selfie_url: dataUrl };
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

function renderRekap() { renderRekapDataToTable(rekapList); }

function renderRekapDataToTable(dataList) {
    const tbody = document.getElementById('rekap-tbody');
    if(!tbody) return;
    tbody.innerHTML = dataList.map((r) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 text-white">${r.date}</td>
            <td class="p-3 font-semibold text-white">${r.name}</td>
            <td class="p-3 text-slate-300">${r.basecamp}</td>
            <td class="p-3 font-mono text-emerald-400">${r.time}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Tepat Waktu' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${r.status}</span></td>
            <td class="p-3 text-rose-400 font-mono">${r.late}</td>
            <td class="p-3">${r.selfie_url ? `<button onclick="openImageZoom('${r.selfie_url}')" class="px-2 py-1 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-image"></i> Lihat</button>` : '-'}</td>
        </tr>
    `).join('');
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
            html += `<div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2"><div><p class="text-xs font-bold text-white">${r.date}</p><p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-gold-400"></i> ${r.basecamp}</p></div><div class="text-right"><p class="text-xs font-mono text-emerald-400">${r.time} WIB</p><p class="text-[10px] ${r.status === 'Tepat Waktu' ? 'text-emerald-500' : 'text-amber-500'} font-semibold">${r.status}</p></div></div>`;
        });
        myIzin.slice().reverse().forEach(i => {
            html += `<div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2"><div><p class="text-xs font-bold text-white">Izin: ${i.jenis}</p><p class="text-[10px] text-slate-400">${i.start} s/d ${i.end}</p></div><div class="text-right"><span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${i.status}</span></div></div>`;
        });
    }
    container.innerHTML = html;
}

function updateDashboardStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    const totalKaryawan = employees.length;
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

function filterRekap() {
    const start = document.getElementById('rekap-start-date').value;
    const end = document.getElementById('rekap-end-date').value;
    if(!start || !end) { renderRekapDataToTable(rekapList); return; }
    const filtered = rekapList.filter(r => r.date >= start && r.date <= end);
    renderRekapDataToTable(filtered); showToast('Filter rekap berhasil.', 'success');
}

function resetRekapData() {
    if (!isMasterAdmin()) return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    showConfirm('Reset Data Rekap', 'Hapus seluruh data rekap absensi?', async () => {
        await supabaseClient.from('rekap_list').delete().neq('id', 0);
        rekapList = []; renderRekap(); updateDashboardStats();
        showToast('Data rekap berhasil di-reset.', 'success');
    });
}

function exportToExcel() {
    if(rekapList.length === 0) return showToast('Tidak ada data rekap.', 'warning');
    const worksheet = XLSX.utils.json_to_sheet(rekapList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    XLSX.writeFile(workbook, "Rekap_Absensi_Enterprise.xlsx");
    showToast('File Excel berhasil di-download.', 'success');
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
        showToast('Role baru berhasil ditambahkan.', 'success');
    } else {
        roles[index] = { id, name, access };
        await supabaseClient.from('roles').update({ name, access }).eq('id', id);
        showToast('Role berhasil diperbarui.', 'success');
    }
    closeRoleModal(); renderRoles();
}

function renderBasecamps() {
    const container = document.getElementById('basecamp-container');
    if(!container) return;
    container.innerHTML = basecamps.map((b, i) => `
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-start"><h5 class="text-xs font-bold text-white">${b.name}</h5><button onclick="openEditBasecampModal(${i})" class="text-blue-400 hover:text-blue-300 text-xs"><i class="fa-solid fa-pen"></i></button></div>
            <p class="text-[11px] text-slate-400 font-mono">Lat/Lng: ${b.lat}, ${b.lng}</p><p class="text-[11px] text-gold-400">Radius GPS: ${b.radius} Meter</p>
        </div>
    `).join('');
    if(!bcMap) {
        bcMap = L.map('basecamp-map').setView([0.434291, 101.466385], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(bcMap);
    }
    basecamps.forEach(b => {
        L.marker([b.lat, b.lng]).addTo(bcMap).bindPopup(`<b>${b.name}</b><br>Radius: ${b.radius}m`);
        L.circle([b.lat, b.lng], { radius: b.radius, color: '#d4af37', fillColor: '#d4af37', fillOpacity: 0.2 }).addTo(bcMap);
    });
}

function openAddBasecampModal() {
    document.getElementById('bc-modal-title').innerText = "Tambah Basecamp";
    document.getElementById('bc-edit-index').value = "-1";
    document.getElementById('bc-inp-name').value = "";
    document.getElementById('bc-inp-lat').value = "";
    document.getElementById('bc-inp-lng').value = "";
    document.getElementById('bc-inp-radius').value = "";
    document.getElementById('basecamp-modal').classList.remove('hidden');
}
function openEditBasecampModal(index) {
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

function renderAdminIzin() {
    const container = document.getElementById('admin-izin-container');
    const badge = document.getElementById('sidebar-izin-badge');
    const counterBadge = document.getElementById('tab-izin-counter-badge');
    if(!container) return;
    const pendingIzins = izinList.filter(i => i.status === 'Pending' && (isMasterAdmin() || i.atasan === activeEmployeeSession.name));
    if(badge) { if(pendingIzins.length > 0) { badge.innerText = pendingIzins.length; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); } }
    if(counterBadge) { if(pendingIzins.length > 0) { counterBadge.innerText = `${pendingIzins.length} Pengajuan Pending`; counterBadge.classList.remove('hidden'); } else { counterBadge.classList.add('hidden'); } }
    if(izinList.length === 0) { container.innerHTML = '<p class="text-slate-500 text-center py-4 text-xs">Belum ada pengajuan izin.</p>'; return; }
    container.innerHTML = izinList.map((i) => `
        <div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
            <div>
                <div class="flex items-center gap-2"><h5 class="text-xs font-bold text-white">${i.name}</h5><span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : i.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}">${i.status}</span></div>
                <p class="text-xs text-gold-400 font-semibold mt-0.5">Jenis: ${i.jenis}</p><p class="text-[11px] text-slate-300">Tanggal: ${i.start} s/d ${i.end}</p><p class="text-[11px] text-slate-400 mt-1">Alasan: "${i.desc}"</p>
            </div>
            <div class="flex items-center gap-2">${i.status === 'Pending' ? `<button onclick="updateIzinStatus(${i.id}, 'Approved')" class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shadow hover:opacity-90">Setujui</button><button onclick="updateIzinStatus(${i.id}, 'Rejected')" class="px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs shadow hover:opacity-90">Tolak</button>` : ''}</div>
        </div>
    `).join('');
}

async function updateIzinStatus(id, newStatus) {
    const izin = izinList.find(i => i.id === id);
    if(izin) { izin.status = newStatus; await supabaseClient.from('izin_list').update({ status: newStatus }).eq('id', id); renderAdminIzin(); renderMobileMyHistory(); updateDashboardStats(); showToast(`Status izin diubah menjadi ${newStatus}.`, 'success'); }
}

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
                const timeStr = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `<div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border ${!isRead ? 'border-gold-500/50 bg-slate-900/90' : 'border-slate-800'} cursor-pointer hover:border-gold-500 transition"><div class="flex justify-between items-start mb-1"><span class="font-bold text-white flex items-center gap-1.5">${!isRead ? '<span class="w-2 h-2 rounded-full bg-gold-500 inline-block"></span>' : ''}${e.sender_name || e.sender}</span><span class="text-[10px] text-slate-400 font-mono">${timeStr}</span></div><p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p><p class="text-[11px] text-slate-300 truncate mt-0.5">${e.message}</p></div>`;
            }).join('');
        }
    }

    const mSentList = document.getElementById('mobile-sent-list');
    if (mSentList) {
        if (sentRows.length === 0) { mSentList.innerHTML = '<p class="text-slate-500 text-center py-4">Belum ada pesan terkirim.</p>'; }
        else {
            mSentList.innerHTML = sentRows.map(e => `<div onclick="openEmailDetail(${e.id})" class="glass-card p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-gold-500 transition"><div class="flex justify-between items-start mb-1"><span class="font-bold text-white">Kepada: ${getEmployeeDisplayName(e.receiver)}</span><span class="text-[10px] text-slate-400 font-mono">${new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></div><p class="text-xs font-semibold text-gold-400 truncate">${e.subject}</p></div>`).join('');
        }
    }

    const dInboxTbody = document.getElementById('desktop-inbox-tbody');
    if (dInboxTbody) {
        if (inboxRows.length === 0) { dInboxTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Kotak masuk kosong.</td></tr>'; }
        else {
            dInboxTbody.innerHTML = inboxRows.map(e => {
                const isRead = readIds.includes(e.id) || e.read || e.sender === userEmail;
                const timeStr = new Date(e.created_at).toLocaleString('id-ID');
                const isBroadcast = e.receiver === 'BROADCAST';
                return `<tr class="hover:bg-slate-900/50 ${!isRead ? 'bg-slate-900/60 font-semibold' : ''}"><td class="p-3 font-mono text-slate-400 text-[11px]">${timeStr}</td><td class="p-3 text-white">${e.sender_name || e.sender}</td><td class="p-3"><div class="text-white font-bold">${e.subject}</div><div class="text-slate-400 truncate max-w-xs font-normal">${e.message}</div></td><td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${isBroadcast ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}">${isBroadcast ? 'Broadcast' : 'Pribadi'}</span></td><td class="p-3 text-right space-x-1"><button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Baca</button><button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            }).join('');
        }
    }

    const dSentTbody = document.getElementById('desktop-sent-tbody');
    if (dSentTbody) {
        if (sentRows.length === 0) { dSentTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Belum ada pesan terkirim.</td></tr>'; }
        else {
            dSentTbody.innerHTML = sentRows.map(e => `<tr class="hover:bg-slate-900/50"><td class="p-3 font-mono text-slate-400 text-[11px]">${new Date(e.created_at).toLocaleString('id-ID')}</td><td class="p-3 text-white">${getEmployeeDisplayName(e.receiver)}</td><td class="p-3 text-white font-semibold">${e.subject}</td><td class="p-3 text-right space-x-1"><button onclick="openEmailDetail(${e.id})" class="px-2.5 py-1 bg-slate-800 text-gold-400 hover:bg-slate-700 rounded text-[11px] font-semibold transition">Lihat</button><button onclick="deleteEmailItem(${e.id})" class="px-2.5 py-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
        }
    }
}

function openEmailDetail(emailId) {
    const email = emailsList.find(e => e.id === emailId);
    if (!email) return;
    activeSelectedEmail = email; markEmailAsRead(email.id);
    document.getElementById('detail-email-sender').innerText = email.sender_name || email.sender;
    document.getElementById('detail-email-receiver').innerText = getEmployeeDisplayName(email.receiver);
    document.getElementById('detail-email-time').innerText = new Date(email.created_at).toLocaleString('id-ID');
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
