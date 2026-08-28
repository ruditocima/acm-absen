// ============================================================
// UI: Switch Mode, Tabs, Role Permissions, Auth Mode Toggle
// ============================================================

function switchMode(mode) {
    const session = Store.get('activeEmployeeSession');
    if (session && session.name !== 'Tamu') {
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

// --------------------------------------------------------
// MOBILE TABS
// --------------------------------------------------------
function switchMobileTab(tab) {
    ['daftar', 'absen', 'izin', 'email'].forEach(t => {
        const tabEl = document.getElementById(`m-tab-${t}`);
        if (tabEl) tabEl.classList.add('hidden');
        const btn = document.getElementById(`m-nav-${t}`);
        if (btn) {
            btn.classList.remove('text-gold-400');
            btn.classList.add('text-slate-400');
        }
    });

    const activeTabEl = document.getElementById(`m-tab-${tab}`);
    if (activeTabEl) activeTabEl.classList.remove('hidden');

    const activeBtn = document.getElementById(`m-nav-${tab}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-400');
        activeBtn.classList.add('text-gold-400');
    }

    if (tab === 'email') switchMobileEmailSub('inbox');
    if (tab === 'izin') renderMobileMyHistory();
}

function switchMobileEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(s => {
        const sec = document.getElementById(`m-email-${s}-section`);
        const btn = document.getElementById(`m-btn-${s}`);
        if (sec) sec.classList.add('hidden');
        if (btn) {
            btn.className = s === sub
                ? "px-3 py-1.5 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 transition"
                : "px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition";
        }
    });

    const activeSec = document.getElementById(`m-email-${sub}-section`);
    if (activeSec) activeSec.classList.remove('hidden');

    if (sub === 'compose') {
        const rec = document.getElementById('m-email-recipient');
        const subj = document.getElementById('m-email-subject');
        const msg = document.getElementById('m-email-message');
        if (rec) rec.value = 'BROADCAST';
        if (subj) subj.value = '';
        if (msg) msg.value = '';
    }
    if (sub === 'inbox' || sub === 'sent') renderEmails();
}

// --------------------------------------------------------
// DESKTOP TABS
// --------------------------------------------------------
function switchDesktopTab(tab) {
    ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin', 'email'].forEach(t => {
        const el = document.getElementById(`d-tab-${t}`);
        const btn = document.getElementById(`d-nav-${t}`);
        if (el) el.classList.add('hidden');
        if (btn && !btn.classList.contains('hidden')) {
            btn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all";
        }
    });

    const activeEl = document.getElementById(`d-tab-${tab}`);
    const activeBtn = document.getElementById(`d-nav-${tab}`);
    if (activeEl) activeEl.classList.remove('hidden');
    if (activeBtn && !activeBtn.classList.contains('hidden')) {
        activeBtn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 transition-all";
    }

    if (tab === 'rekap') renderRekap();
    if (tab === 'karyawan') renderEmployees();
    if (tab === 'basecamp') {
        renderBasecamps();
        setTimeout(() => {
            const bcMap = Store.get('bcMap');
            if (bcMap) bcMap.invalidateSize();
        }, 200);
    }
    if (tab === 'email') switchDesktopEmailSub('inbox');
}

function switchDesktopEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(s => {
        const sec = document.getElementById(`d-email-${s}-section`);
        const btn = document.getElementById(`d-btn-${s}`);
        if (sec) sec.classList.add('hidden');
        if (btn) {
            btn.className = s === sub
                ? "px-4 py-2 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 shadow"
                : "px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-slate-300 border border-slate-800";
        }
    });

    const activeSec = document.getElementById(`d-email-${sub}-section`);
    if (activeSec) activeSec.classList.remove('hidden');

    if (sub === 'compose') {
        const rec = document.getElementById('d-email-recipient');
        const subj = document.getElementById('d-email-subject');
        const msg = document.getElementById('d-email-message');
        if (rec) rec.value = 'BROADCAST';
        if (subj) subj.value = '';
        if (msg) msg.value = '';
    }
    if (sub === 'inbox' || sub === 'sent') renderEmails();
}

// --------------------------------------------------------
// ROLE PERMISSIONS
// --------------------------------------------------------
function applyRolePermissions() {
    const session = Store.get('activeEmployeeSession');
    document.getElementById('desktop-user-initial').innerText = session.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('desktop-role-label').innerText = session.role;

    const roleName = session.role;
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

    const dashBtn = document.getElementById('d-nav-dashboard');
    if (dashBtn) dashBtn.classList.remove('hidden');

    if (roleName === 'Master Admin') {
        for (const [key, btnId] of Object.entries(menuMapping)) {
            if (key === 'dashboard') continue;
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.remove('hidden');
        }
    } else if (roleName === 'Karyawan / Field') {
        ['rekap', 'email', 'basecamp'].forEach(key => {
            const btn = document.getElementById(menuMapping[key]);
            if (btn) btn.classList.remove('hidden');
        });
    } else if (roleName === 'Supervisor Field') {
        ['rekap', 'izin', 'email', 'basecamp'].forEach(key => {
            const btn = document.getElementById(menuMapping[key]);
            if (btn) btn.classList.remove('hidden');
        });
    } else if (roleName === 'Admin') {
        ['rekap', 'izin', 'email', 'basecamp'].forEach(key => {
            const btn = document.getElementById(menuMapping[key]);
            if (btn) btn.classList.remove('hidden');
        });
    } else {
        const roles = Store.get('roles');
        const rData = roles.find(r => r.name === roleName);
        const accessStr = rData ? rData.access.toLowerCase() : '';
        for (const [key, btnId] of Object.entries(menuMapping)) {
            if (key === 'dashboard') continue;
            const btn = document.getElementById(btnId);
            if (btn && accessStr.includes(key)) btn.classList.remove('hidden');
        }
    }

    const btnAddBasecamp = document.getElementById('btn-add-basecamp');
    if (btnAddBasecamp) {
        btnAddBasecamp.classList.toggle('hidden', !(roleName === 'Master Admin' || roleName === 'Supervisor Field'));
    }

    const btnResetRekap = document.getElementById('btn-reset-rekap');
    if (btnResetRekap) {
        btnResetRekap.classList.toggle('hidden', roleName !== 'Master Admin');
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