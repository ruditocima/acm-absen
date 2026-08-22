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
    ['daftar', 'absen', 'izin', 'email'].forEach(function(t) {
        const tabEl = document.getElementById('m-tab-' + t);
        if(tabEl) tabEl.classList.add('hidden');
        const btn = document.getElementById('m-nav-' + t);
        if(btn) { btn.classList.remove('text-gold-400'); btn.classList.add('text-slate-400'); }
    });
    const activeTabEl = document.getElementById('m-tab-' + tab);
    if(activeTabEl) activeTabEl.classList.remove('hidden');
    const activeBtn = document.getElementById('m-nav-' + tab);
    if(activeBtn) { activeBtn.classList.remove('text-slate-400'); activeBtn.classList.add('text-gold-400'); }
    if (tab === 'email') switchMobileEmailSub('inbox');
    if (tab === 'izin') renderMobileMyHistory();
}

function switchMobileEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(function(s) {
        const sec = document.getElementById('m-email-' + s + '-section');
        const btn = document.getElementById('m-btn-' + s);
        if(sec) sec.classList.add('hidden');
        if(btn) { btn.className = s === sub ? "px-3 py-1.5 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 transition" : "px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition"; }
    });
    const activeSec = document.getElementById('m-email-' + sub + '-section');
    if(activeSec) activeSec.classList.remove('hidden');
    if (sub === 'compose') {
        const rec = document.getElementById('m-email-recipient');
        const subj = document.getElementById('m-email-subject');
        const msg = document.getElementById('m-email-message');
        if(rec) rec.value = 'BROADCAST';
        if(subj) subj.value = '';
        if(msg) msg.value = '';
    }
    if(sub === 'inbox' || sub === 'sent') renderEmails();
}

function switchDesktopTab(tab) {
    ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin', 'email'].forEach(function(t) {
        const el = document.getElementById('d-tab-' + t);
        const btn = document.getElementById('d-nav-' + t);
        if(el) el.classList.add('hidden');
        if(btn) btn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all";
    });
    const activeEl = document.getElementById('d-tab-' + tab);
    const activeBtn = document.getElementById('d-nav-' + tab);
    if(activeEl) activeEl.classList.remove('hidden');
    if(activeBtn) activeBtn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 transition-all";
    if(tab === 'basecamp') setTimeout(function() { if(bcMap) bcMap.invalidateSize(); }, 200);
    if(tab === 'email') switchDesktopEmailSub('inbox');
}

function switchDesktopEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(function(s) {
        const sec = document.getElementById('d-email-' + s + '-section');
        const btn = document.getElementById('d-btn-' + s);
        if(sec) sec.classList.add('hidden');
        if(btn) { btn.className = s === sub ? "px-4 py-2 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 shadow" : "px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-slate-300 border border-slate-800"; }
    });
    const activeSec = document.getElementById('d-email-' + sub + '-section');
    if(activeSec) activeSec.classList.remove('hidden');
    if (sub === 'compose') {
        const rec = document.getElementById('d-email-recipient');
        const subj = document.getElementById('d-email-subject');
        const msg = document.getElementById('d-email-message');
        if(rec) rec.value = 'BROADCAST';
        if(subj) subj.value = '';
        if(msg) msg.value = '';
    }
    if(sub === 'inbox' || sub === 'sent') renderEmails();
}

function applyRolePermissions() {
    document.getElementById('desktop-user-initial').innerText = activeEmployeeSession.name.split(' ').map(function(n) { return n[0]; }).join('').substring(0,2).toUpperCase();
    document.getElementById('desktop-role-label').innerText = activeEmployeeSession.role;
    const roleName = activeEmployeeSession.role;
    const rData = roles.find(function(r) { return r.name === roleName; });
    const accessStr = (roleName === 'Master Admin') ? 'dashboard, rekap, role, karyawan, basecamp, izin, email' : (rData ? rData.access.toLowerCase() : '');
    const isAtasanOrManager = isMasterAdmin() || roleName.includes('Admin') || roleName.includes('Manajer') || employees.some(function(e) { return e.atasan === activeEmployeeSession.name; });
    const menuMapping = {
        'dashboard': 'd-nav-dashboard',
        'rekap': 'd-nav-rekap',
        'role': 'd-nav-role',
        'karyawan': 'd-nav-karyawan',
        'basecamp': 'd-nav-basecamp',
        'izin': 'd-nav-izin',
        'email': 'd-nav-email'
    };
    for (const key in menuMapping) {
        const btnId = menuMapping[key];
        const btn = document.getElementById(btnId);
        if (btn) {
            if (key === 'izin') {
                if (isAtasanOrManager && (accessStr.includes('izin') || isMasterAdmin() || roleName.includes('Manajer') || roleName.includes('Admin'))) {
                    btn.classList.remove('hidden');
                } else {
                    btn.classList.add('hidden');
                }
            } else {
                if (accessStr.includes(key)) { btn.classList.remove('hidden'); } else { btn.classList.add('hidden'); }
            }
        }
    }
    switchDesktopTab('dashboard');
}

function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') {
        console.warn('Supabase client belum diinisialisasi.');
        return;
    }
    supabaseClient.channel('realtime-leaves-channel').on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function(payload) {
        if (typeof renderAdminIzin === 'function') renderAdminIzin();
        if (typeof showToast === 'function') showToast('Data izin diperbarui secara real-time.', 'info');
    }).subscribe();
    supabaseClient.channel('realtime-messages-channel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function(payload) {
        if (typeof renderEmails === 'function') renderEmails();
        if (typeof showToast === 'function') showToast('Pesan atau email baru diterima!', 'success');
    }).subscribe();
}

async function fetchAllDataFromSupabase() {
    try {
        const rRes = await supabaseClient.from('roles').select('*');
        if (rRes.data && rRes.data.length > 0) roles = rRes.data;
        const eRes = await supabaseClient.from('employees').select('*');
        if (eRes.data && eRes.data.length > 0) {
            employees = eRes.data.map(function(e) {
                return { id: e.id, name: e.name, position: e.position || '-', role: e.role, atasan: e.atasan, password: e.password, status: e.status, deviceId: e.device_id || 'Unbound' };
            });
        }
        const bRes = await supabaseClient.from('basecamps').select('*');
        if (bRes.data && bRes.data.length > 0) basecamps = bRes.data;
        const rkRes = await supabaseClient.from('rekap_list').select('*');
        if (rkRes.data) rekapList = rkRes.data;
        const iRes = await supabaseClient.from('izin_list').select('*');
        if (iRes.data) izinList = iRes.data;
        const emRes = await supabaseClient.from('emails').select('*').order('created_at', { ascending: false });
        if (emRes.data) {
            const readIds = getReadEmailIds();
            emailsList = emRes.data.map(function(e) {
                return { id: e.id, sender: e.sender, sender_name: e.sender_name, receiver: e.recipient, subject: e.subject, message: e.message, created_at: e.created_at, read: readIds.includes(e.id) };
            });
        }
        renderRoles(); renderEmployees(); renderRekap(); renderBasecamps();
        renderAdminIzin(); populateEmailRecipients(); renderEmails(); updateDashboardStats();
    } catch (err) {
        console.error("Gagal sinkronisasi dengan Supabase:", err);
        showToast("Gagal memuat sebagian data dari server Supabase.", "warning");
    }
}