function switchMode(mode) {
    var session = Store.get('activeEmployeeSession');
    if (session && session.name !== 'Tamu') {
        handleLogout(true).then(function() {
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
        document.getElementById('btn-mobile').className = 'px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2';
        document.getElementById('btn-desktop').className = 'px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2';
        switchMobileTab('daftar');
    } else {
        document.getElementById('view-desktop').classList.remove('hidden');
        document.getElementById('btn-desktop').className = 'px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2';
        document.getElementById('btn-mobile').className = 'px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2';
        document.getElementById('desktop-login-section').classList.remove('hidden');
        document.getElementById('desktop-app-wrapper').classList.add('hidden');
    }
}

function switchMobileTab(tab) {
    ['daftar', 'absen', 'izin', 'email'].forEach(function(t) {
        var tabEl = document.getElementById('m-tab-' + t);
        if (tabEl) tabEl.classList.add('hidden');
        var btn = document.getElementById('m-nav-' + t);
        if (btn) {
            btn.classList.remove('text-gold-400');
            btn.classList.add('text-slate-400');
        }
    });

    var activeTabEl = document.getElementById('m-tab-' + tab);
    if (activeTabEl) activeTabEl.classList.remove('hidden');

    var activeBtn = document.getElementById('m-nav-' + tab);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-400');
        activeBtn.classList.add('text-gold-400');
    }

    if (tab === 'email') switchMobileEmailSub('inbox');
    if (tab === 'izin') renderMobileMyHistory();
}

function switchMobileEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(function(s) {
        var sec = document.getElementById('m-email-' + s + '-section');
        var btn = document.getElementById('m-btn-' + s);
        if (sec) sec.classList.add('hidden');
        if (btn) {
            btn.className = s === sub
                ? 'px-3 py-1.5 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 transition'
                : 'px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition';
        }
    });

    var activeSec = document.getElementById('m-email-' + sub + '-section');
    if (activeSec) activeSec.classList.remove('hidden');

    if (sub === 'compose') {
        var rec = document.getElementById('m-email-recipient');
        var subj = document.getElementById('m-email-subject');
        var msg = document.getElementById('m-email-message');
        if (rec) rec.value = 'BROADCAST';
        if (subj) subj.value = '';
        if (msg) msg.value = '';
    }
    if (sub === 'inbox' || sub === 'sent') renderEmails();
}

function switchDesktopTab(tab) {
    ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin', 'email', 'libur'].forEach(function(t) {
        var el = document.getElementById('d-tab-' + t);
        var btn = document.getElementById('d-nav-' + t);
        if (el) el.classList.add('hidden');
        if (btn && !btn.classList.contains('hidden')) {
            btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all';
        }
    });

    var activeEl = document.getElementById('d-tab-' + tab);
    var activeBtn = document.getElementById('d-nav-' + tab);
    if (activeEl) activeEl.classList.remove('hidden');
    if (activeBtn && !activeBtn.classList.contains('hidden')) {
        activeBtn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 transition-all';
    }

    if (tab === 'rekap') renderRekap();
    if (tab === 'karyawan') renderEmployees();
    if (tab === 'basecamp') {
        renderBasecamps();
        setTimeout(function() {
            var bcMap = Store.get('bcMap');
            if (bcMap) bcMap.invalidateSize();
        }, 200);
    }
    if (tab === 'email') switchDesktopEmailSub('inbox');
    if (tab === 'libur') renderLibur();
}

function switchDesktopEmailSub(sub) {
    ['inbox', 'sent', 'compose'].forEach(function(s) {
        var sec = document.getElementById('d-email-' + s + '-section');
        var btn = document.getElementById('d-btn-' + s);
        if (sec) sec.classList.add('hidden');
        if (btn) {
            btn.className = s === sub
                ? 'px-4 py-2 text-xs font-bold rounded-xl bg-gold-500 text-slate-950 shadow'
                : 'px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-slate-300 border border-slate-800';
        }
    });

    var activeSec = document.getElementById('d-email-' + sub + '-section');
    if (activeSec) activeSec.classList.remove('hidden');

    if (sub === 'compose') {
        var rec = document.getElementById('d-email-recipient');
        var subj = document.getElementById('d-email-subject');
        var msg = document.getElementById('d-email-message');
        if (rec) rec.value = 'BROADCAST';
        if (subj) subj.value = '';
        if (msg) msg.value = '';
    }
    if (sub === 'inbox' || sub === 'sent') renderEmails();
}

function applyRolePermissions() {
    var session = Store.get('activeEmployeeSession');
    document.getElementById('desktop-user-initial').innerText = session.name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();
    document.getElementById('desktop-role-label').innerText = session.role;

    var roleName = session.role;
    var menuMapping = {
        'dashboard': 'd-nav-dashboard',
        'rekap': 'd-nav-rekap',
        'role': 'd-nav-role',
        'karyawan': 'd-nav-karyawan',
        'basecamp': 'd-nav-basecamp',
        'izin': 'd-nav-izin',
        'email': 'd-nav-email',
        'libur': 'd-nav-libur' // Tambahkan ini
    };

    for (var key in menuMapping) {
        var btnId = menuMapping[key];
        var btn = document.getElementById(btnId);
        if (btn) btn.classList.add('hidden');
    }

    var dashBtn = document.getElementById('d-nav-dashboard');
    if (dashBtn) dashBtn.classList.remove('hidden');

    if (roleName === 'Master Admin') {
        for (var k in menuMapping) {
            if (k === 'dashboard') continue;
            var b = document.getElementById(menuMapping[k]);
            if (b) b.classList.remove('hidden');
        }
    } else if (roleName === 'Karyawan / Field') {
        ['rekap', 'email', 'basecamp'].forEach(function(key) {
            var b = document.getElementById(menuMapping[key]);
            if (b) b.classList.remove('hidden');
        });
    } else if (roleName === 'Supervisor Field') {
        ['rekap', 'izin', 'email', 'basecamp'].forEach(function(key) {
            var b = document.getElementById(menuMapping[key]);
            if (b) b.classList.remove('hidden');
        });
    } else if (roleName === 'Admin') {
        ['rekap', 'izin', 'email', 'basecamp', 'libur'].forEach(function(key) { // Tambahkan 'libur' di sini jika Admin juga boleh mengakses
            var b = document.getElementById(menuMapping[key]);
            if (b) b.classList.remove('hidden');
        });
    } else {
        var roles = Store.get('roles');
        var rData = roles.find(function(r) { return r.name === roleName; });
        var accessStr = rData ? rData.access.toLowerCase() : '';
        for (var k2 in menuMapping) {
            if (k2 === 'dashboard') continue;
            var b2 = document.getElementById(menuMapping[k2]);
            if (b2 && accessStr.indexOf(k2) >= 0) b2.classList.remove('hidden');
        }
    }

    var btnAddBasecamp = document.getElementById('btn-add-basecamp');
    if (btnAddBasecamp) {
        btnAddBasecamp.classList.toggle('hidden', !(roleName === 'Master Admin' || roleName === 'Supervisor Field'));
    }

    var btnResetRekap = document.getElementById('btn-reset-rekap');
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
