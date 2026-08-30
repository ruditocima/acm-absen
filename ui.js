function switchMode(mode) {
    var session = Store.get('activeEmployeeSession');
    if (session && session.name !== 'Tamu') {
        handleLogout(true).then(function() {
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
    }
}

// Fungsi Pengaturan Mode Autentikasi (Login / Register / Lupa Password)
function toggleAuthMode(mode) {
    var loginStep = document.getElementById('login-step');
    var regStep1 = document.getElementById('reg-step-1');
    var regStep2 = document.getElementById('reg-step-2');
    var forgotStep1 = document.getElementById('forgot-step-1');
    var forgotStep2 = document.getElementById('forgot-step-2');

    if (loginStep) loginStep.classList.add('hidden');
    if (regStep1) regStep1.classList.add('hidden');
    if (regStep2) regStep2.classList.add('hidden');
    if (forgotStep1) forgotStep1.classList.add('hidden');
    if (forgotStep2) forgotStep2.classList.add('hidden');

    if (mode === 'login') {
        if (loginStep) loginStep.classList.remove('hidden');
    } else if (mode === 'register') {
        if (regStep1) regStep1.classList.remove('hidden');
    } else if (mode === 'forgot') {
        if (forgotStep1) forgotStep1.classList.remove('hidden');
    }
}

// ==================== LOGIKA LUPA PASSWORD ====================
var tempForgotEmail = '';
var tempForgotOTP = '';

function requestForgotOTP() {
    var emailInput = document.getElementById('forgot-email');
    var email = emailInput ? emailInput.value.trim() : '';
    
    if (!email) {
        showToast('Email harus diisi!', 'error');
        return;
    }

    var employees = Store.get('employees') || [];
    var emp = employees.find(function(e) { return e.email && e.email.toLowerCase() === email.toLowerCase(); });
    
    if (!emp) {
        showToast('Email tidak terdaftar sebagai karyawan!', 'error');
        return;
    }

    tempForgotEmail = email;
    tempForgotOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // Kirim via EmailJS jika tersedia, atau fallback/simulasi toast
    if (typeof emailjs !== 'undefined' && typeof EMAIL_SERVICE_ID !== 'undefined') {
        emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {
            to_email: email,
            to_name: emp.name,
            otp_code: tempForgotOTP
        }).then(function() {
            showToast('Kode OTP Reset telah dikirim ke email Anda.', 'success');
            document.getElementById('forgot-step-1').classList.add('hidden');
            document.getElementById('forgot-step-2').classList.remove('hidden');
        }, function(err) {
            console.error(err);
            showToast('OTP Reset (Simulasi): ' + tempForgotOTP, 'success');
            document.getElementById('forgot-step-1').classList.add('hidden');
            document.getElementById('forgot-step-2').classList.remove('hidden');
        });
    } else {
        showToast('OTP Reset (Simulasi): ' + tempForgotOTP, 'success');
        document.getElementById('forgot-step-1').classList.add('hidden');
        document.getElementById('forgot-step-2').classList.remove('hidden');
    }
}

function backToForgotStep1() {
    document.getElementById('forgot-step-2').classList.add('hidden');
    document.getElementById('forgot-step-1').classList.remove('hidden');
}

function verifyAndResetPassword() {
    var otpInput = document.getElementById('forgot-otp-input');
    var passInput = document.getElementById('forgot-new-pass');
    
    var enteredOTP = otpInput ? otpInput.value.trim() : '';
    var newPass = passInput ? passInput.value.trim() : '';

    if (!enteredOTP || !newPass) {
        showToast('OTP dan Password baru harus diisi!', 'error');
        return;
    }

    if (enteredOTP !== tempForgotOTP) {
        showToast('Kode OTP salah!', 'error');
        return;
    }

    var employees = Store.get('employees') || [];
    var empIndex = employees.findIndex(function(e) { return e.email && e.email.toLowerCase() === tempForgotEmail.toLowerCase(); });
    
    if (empIndex >= 0) {
        employees[empIndex].password = newPass;
        Store.set('employees', employees);
        showToast('Password berhasil diubah! Silakan login.', 'success');
        toggleAuthMode('login');
        if (otpInput) otpInput.value = '';
        if (passInput) passInput.value = '';
    } else {
        showToast('Data karyawan tidak ditemukan.', 'error');
    }
}

// ==================== TAB NAVIGATION ====================
function switchMobileTab(tab) {
    if (tab === 'logout') {
        mobileLogout();
        return;
    }

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
}

function mobileLogout() {
    if (typeof handleLogout === 'function') {
        handleLogout(true);
    } else {
        Store.set('activeEmployeeSession', null);
        window.location.reload();
    }
}
