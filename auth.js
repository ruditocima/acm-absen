async function initializeDeviceBinding() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
            var info = await window.Capacitor.Plugins.Device.getId();
            Store.set('currentDeviceUUID', info.uuid);
        } else {
            throw new Error('Capacitor Native Plugin not found.');
        }
    } catch (error) {
        var localUUID = localStorage.getItem('hybrid_device_uuid');
        if (!localUUID) {
            localUUID = 'WEB-' + Math.random().toString(36).substring(2, 12).toUpperCase();
            localStorage.setItem('hybrid_device_uuid', localUUID);
        }
        Store.set('currentDeviceUUID', localUUID);
    }
    var deviceStatusEl = document.getElementById('mobile-device-status');
    if (deviceStatusEl) {
        var uuid = Store.get('currentDeviceUUID');
        deviceStatusEl.innerHTML = '<i class="fa-solid fa-shield-check"></i> ID: ' + escapeHtml(uuid.substring(0, 8)) + '...';
        deviceStatusEl.className = 'text-emerald-400 font-semibold text-[11px]';
    }
}

async function processLoginValidation(email, pass, isDesktop) {
    if (!email || !pass) {
        showToast('Harap isi email dan password Anda.', 'error');
        return false;
    }

    var authData, authError;
    try {
        var result = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
        authData = result.data;
        authError = result.error;
    } catch (e) {
        console.error('Auth exception:', e);
        showToast('Gagal menghubungi server autentikasi. Cek koneksi.', 'error');
        return false;
    }

    if (authError || !authData || !authData.user) {
        var errMsg = (authError && authError.message) ? authError.message.toLowerCase() : '';
        if (errMsg.indexOf('invalid login credentials') >= 0 || errMsg.indexOf('user not found') >= 0) {
            showToast('Akun belum terdaftar di sistem. Silakan daftar via menu Mobile (HP).', 'warning');
        } else if (errMsg.indexOf('email not confirmed') >= 0) {
            showToast('Email belum dikonfirmasi. Cek inbox atau hubungi Admin.', 'warning');
        } else {
            showToast('Login gagal: ' + (authError ? authError.message : 'Kredensial salah'), 'error');
        }
        return false;
    }

    var authUser = authData.user;

    var empResult = await supabaseClient.from('employees').select('*').eq('auth_id', authUser.id).maybeSingle();
    if (empResult.error) console.warn('[Auth] Fetch employee by auth_id error:', empResult.error.message);

    var empData = empResult.data;
    if (!empData) {
        var fallbackResult = await supabaseClient.from('employees').select('*').eq('id', email).maybeSingle();
        if (fallbackResult.error) console.warn('[Auth] Fetch employee by email error:', fallbackResult.error.message);
        if (fallbackResult.data) {
            await supabaseClient.from('employees').update({ auth_id: authUser.id }).eq('id', email);
            empData = fallbackResult.data;
            empData.auth_id = authUser.id;
        }
    }

    if (!empData) {
        showToast('Data karyawan tidak ditemukan. Hubungi Admin.', 'error');
        await supabaseClient.auth.signOut();
        return false;
    }

    if (empData.status !== 'Approved') {
        showToast('Akun Anda masih berstatus Pending.', 'warning');
        await supabaseClient.auth.signOut();
        return false;
    }

    if (!isDesktop) {
        var currentDeviceUUID = Store.get('currentDeviceUUID');
        if (empData.device_id === 'Unbound' || !empData.device_id) {
            await supabaseClient.from('employees').update({ device_id: currentDeviceUUID }).eq('id', empData.id);
            empData.device_id = currentDeviceUUID;
            showToast('Perangkat berhasil diikat ke akun ini.', 'success');
            renderEmployees();
        } else if (empData.device_id !== currentDeviceUUID) {
            await supabaseClient.auth.signOut();
            showToast('SECURITY ALERT: Login Ditolak! Akun ini telah terikat pada perangkat lain.', 'error');
            return false;
        }
    }

    Store.set('activeEmployeeSession', {
        id: empData.id,
        name: empData.name,
        position: empData.position,
        role: empData.role,
        atasan: empData.atasan,
        status: empData.status,
        deviceId: empData.device_id,
        auth_id: empData.auth_id
    });

    // Update UI Mobile & Desktop dengan format "Halo, [Nama]" dan "[Posisi]"
    var mobileTitleEl = document.getElementById('mobile-user-title');
    if (mobileTitleEl) mobileTitleEl.innerText = 'Halo, ' + escapeHtml(empData.name);
    
    var mobilePosEl = document.getElementById('mobile-user-position');
    if (mobilePosEl) mobilePosEl.innerText = escapeHtml(empData.position || '-');

    var mobileInitialEl = document.getElementById('mobile-user-initial');
    if (mobileInitialEl) mobileInitialEl.innerText = empData.name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();

    var desktopNameEl = document.getElementById('desktop-user-name');
    if (desktopNameEl) desktopNameEl.innerText = 'Halo, ' + escapeHtml(empData.name);

    var desktopPosEl = document.getElementById('desktop-user-position');
    if (desktopPosEl) desktopPosEl.innerText = escapeHtml(empData.position || '-');

    var desktopInitialEl = document.getElementById('desktop-user-initial');
    if (desktopInitialEl) desktopInitialEl.innerText = empData.name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();

    await fetchAllDataFromSupabase();

    var readIds = getReadEmailIds();
    Store.get('emailsList').forEach(function(e) { if (readIds.includes(e.id)) e.read = true; });

    renderMobileMyHistory();
    renderEmails();
    renderAdminIzin();
    updateEmailBadges();
    populateEmailRecipients();

    return true;
}

async function handleLogin() {
    var btn = document.querySelector('#login-step button[onclick="handleLogin()"]');
    setButtonLoading(btn, 'Memproses login...');

    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-pass').value.trim();
    var success = await processLoginValidation(email, pass, false);

    resetButtonLoading(btn);
    if (success) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-pass').value = '';
        showToast('Login berhasil!', 'success');
        switchMobileTab('absen');
    }
}

async function handleDesktopLogin() {
    var btn = document.querySelector('#desktop-login-section button[onclick="handleDesktopLogin()"]');
    setButtonLoading(btn, 'Memproses login...');

    var email = document.getElementById('d-login-email').value.trim();
    var pass = document.getElementById('d-login-pass').value.trim();
    var success = await processLoginValidation(email, pass, true);

    resetButtonLoading(btn);
    if (success) {
        document.getElementById('d-login-email').value = '';
        document.getElementById('d-login-pass').value = '';
        showToast('Login Enterprise berhasil!', 'success');
        document.getElementById('desktop-login-section').classList.add('hidden');
        document.getElementById('desktop-app-wrapper').classList.remove('hidden');
        applyRolePermissions();
    }
}

async function handleLogout(skipModeSwitch) {
    if (skipModeSwitch === undefined) skipModeSwitch = false;
    await supabaseClient.auth.signOut();
    Store.set('activeEmployeeSession', { name: 'Guest', id: 'guest@gmail.com', role: 'Tamu' });
    
    // Reset teks Halo & Posisi ke default Guest
    var mobileTitleEl = document.getElementById('mobile-user-title');
    if (mobileTitleEl) mobileTitleEl.innerText = 'Halo, Guest';
    var mobilePosEl = document.getElementById('mobile-user-position');
    if (mobilePosEl) mobilePosEl.innerText = '-';
    var mobileInitialEl = document.getElementById('mobile-user-initial');
    if (mobileInitialEl) mobileInitialEl.innerText = 'G';

    var desktopNameEl = document.getElementById('desktop-user-name');
    if (desktopNameEl) desktopNameEl.innerText = 'Halo, Guest';
    var desktopPosEl = document.getElementById('desktop-user-position');
    if (desktopPosEl) desktopPosEl.innerText = '-';
    var desktopInitialEl = document.getElementById('desktop-user-initial');
    if (desktopInitialEl) desktopInitialEl.innerText = 'AD';

    populateEmailRecipients();
    updateEmailBadges();
    showToast('Anda telah logout.', 'success');
    if (!skipModeSwitch) {
        switchMode('mobile');
        switchMobileTab('daftar');
    }
}

async function requestOTP() {
    var btn = document.querySelector('#reg-step-1 button[onclick="requestOTP()"]');
    setButtonLoading(btn, 'Mengirim OTP...');

    var email = document.getElementById('reg-email').value.trim();
    var nama = document.getElementById('reg-nama').value.trim();
    var pass = document.getElementById('reg-pass').value.trim();

    if (!email || !nama || !pass || email.indexOf('@') < 0) {
        showToast('Harap isi semua kolom dengan benar!', 'error');
        resetButtonLoading(btn);
        return;
    }
    if (pass.length < 6) {
        showToast('Password minimal 6 karakter!', 'error');
        resetButtonLoading(btn);
        return;
    }

    showToast('Memeriksa ketersediaan email...', 'info');
    try {
        var existingResult = await supabaseClient.from('employees').select('id, name, status, auth_id').eq('id', email).maybeSingle();
        if (!existingResult.error && existingResult.data && existingResult.data.status === 'Approved') {
            showToast('Email sudah terdaftar dan aktif. Silakan login.', 'warning');
            var loginEmail = document.getElementById('login-email');
            if (loginEmail) loginEmail.value = email;
            toggleAuthMode('login');
            resetButtonLoading(btn);
            return;
        }
        var signInCheck = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
        if (!signInCheck.error && signInCheck.data && signInCheck.data.user) {
            showToast('Email sudah terdaftar. Login otomatis...', 'success');
            await processLoginValidation(email, pass, false);
            resetButtonLoading(btn);
            return;
        }
    } catch (e) {}

    Store.set('tempRegData', { email: email, nama: nama, pass: pass });
    var otp = Math.floor(100000 + Math.random() * 900000).toString();
    Store.set('generatedOTP', otp);
    Store.set('otpExpiryTime', Date.now() + (CONFIG.OTP.EXPIRY_MINUTES * 60 * 1000));

    var proceedToStep2 = function(instructionHtml, toastType, toastMsg) {
        var instElem = document.getElementById('otp-instruction-text');
        if (instElem) instElem.innerHTML = instructionHtml;
        showToast(toastMsg, toastType);
        document.getElementById('reg-step-1').classList.add('hidden');
        document.getElementById('reg-step-2').classList.remove('hidden');
        resetButtonLoading(btn);
    };

    if (typeof emailjs === 'undefined' || !emailjsReady) {
        proceedToStep2(
            '<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">' +
            '<p class="text-amber-400 font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Layanan Email Belum Siap</p>' +
            '<p class="text-slate-300 text-[11px]">Gunakan kode OTP berikut untuk verifikasi:</p>' +
            '<div class="text-3xl font-mono font-bold text-gold-400 tracking-[0.2em] my-2 text-center bg-slate-950 py-2 rounded-lg border border-slate-800">' + otp + '</div>' +
            '<p class="text-[10px] text-slate-400">Kode berlaku ' + CONFIG.OTP.EXPIRY_MINUTES + ' menit.</p></div>',
            'warning',
            'SendGrid/EmailJS belum siap. Gunakan kode OTP di bawah ini.'
        );
        return;
    }

    try {
        await emailjs.send(
            CONFIG.EMAILJS.SERVICE_ID,
            CONFIG.EMAILJS.TEMPLATE_ID,
            {
                to_email: email,
                email: email,
                to: email,
                recipient: email,
                to_name: nama,
                otp_code: otp,
                from_name: 'KaryaOne ACM',
                message: 'Kode OTP Anda adalah: ' + otp + '. Berlaku ' + CONFIG.OTP.EXPIRY_MINUTES + ' menit.'
            },
            CONFIG.EMAILJS.PUBLIC_KEY
        );
        proceedToStep2(
            'Kode OTP telah dikirimkan ke email <b class="text-gold-400">' + escapeHtml(email) + '</b>. Silakan cek inbox/spam folder Anda.',
            'success',
            'Kode OTP berhasil dikirim ke email Anda!'
        );
    } catch (error) {
        console.error('EmailJS Error:', error);
        var errorMsg = (error && error.text) ? error.text : (error && error.message ? error.message : 'Unknown error');
        proceedToStep2(
            '<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">' +
            '<p class="text-amber-400 font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Gagal Mengirim Email</p>' +
            '<p class="text-slate-300 text-[11px]">Email tidak dapat dikirim. Gunakan kode OTP di bawah ini:</p>' +
            '<div class="text-3xl font-mono font-bold text-gold-400 tracking-[0.2em] my-2 text-center bg-slate-950 py-2 rounded-lg border border-slate-800">' + otp + '</div>' +
            '<p class="text-[10px] text-slate-400">Error: ' + escapeHtml(errorMsg) + ' | Kode berlaku ' + CONFIG.OTP.EXPIRY_MINUTES + ' menit.</p></div>',
            'warning',
            'Email gagal terkirim. Gunakan kode OTP yang ditampilkan.'
        );
    }
}

function backToRegStep1() {
    document.getElementById('reg-step-2').classList.add('hidden');
    document.getElementById('reg-step-1').classList.remove('hidden');
}

async function verifyOTP() {
    var btn = document.querySelector('#reg-step-2 button[onclick="verifyOTP()"]');
    setButtonLoading(btn, 'Mendaftarkan akun...');

    var otp = document.getElementById('reg-otp-input').value.trim();
    var generatedOTP = Store.get('generatedOTP');
    var otpExpiryTime = Store.get('otpExpiryTime');
    var tempRegData = Store.get('tempRegData');

    if (!generatedOTP) {
        showToast('Sesi OTP tidak valid.', 'error');
        resetButtonLoading(btn);
        return;
    }
    if (Date.now() > otpExpiryTime) {
        showToast('Kode OTP sudah kedaluwarsa!', 'error');
        resetButtonLoading(btn);
        return;
    }
    if (otp !== generatedOTP) {
        showToast('Kode OTP salah!', 'error');
        resetButtonLoading(btn);
        return;
    }

    showToast('Mendaftarkan akun ke server...', 'info');

    var existingAuthUser = null;
    try {
        var signInData = await supabaseClient.auth.signInWithPassword({
            email: tempRegData.email,
            password: tempRegData.pass
        });
        if (!signInData.error && signInData.data && signInData.data.user) {
            existingAuthUser = signInData.data.user;
            showToast('Email sudah terdaftar. Login otomatis...', 'info');
        }
    } catch (e) {}

    var authId = null;

    if (existingAuthUser) {
        authId = existingAuthUser.id;
    } else {
        var authData, authError;
        try {
            var signupResult = await supabaseClient.auth.signUp({
                email: tempRegData.email,
                password: tempRegData.pass,
                options: { data: { name: tempRegData.nama } }
            });
            authData = signupResult.data;
            authError = signupResult.error;
        } catch (e) {
            console.error('SignUp exception:', e);
            showToast('Gagal menghubungi server. Cek koneksi internet.', 'error');
            resetButtonLoading(btn);
            return;
        }

        if (authError) {
            var errMsg = (authError.message || '').toLowerCase();
            var errStatus = authError.status || 0;
            if (errStatus === 422 || errMsg.indexOf('already') >= 0 || errMsg.indexOf('registered') >= 0 || errMsg.indexOf('exists') >= 0) {
                showToast('Email sudah terdaftar. Silakan login.', 'warning');
                var loginEmail = document.getElementById('login-email');
                if (loginEmail && tempRegData) loginEmail.value = tempRegData.email;
                toggleAuthMode('login');
                Store.set('generatedOTP', null);
                Store.set('otpExpiryTime', null);
                document.getElementById('reg-otp-input').value = '';
                resetButtonLoading(btn);
                return;
            } else if (errMsg.indexOf('rate limit') >= 0 || errMsg.indexOf('too many') >= 0) {
                showToast('Terlalu banyak percobaan. Tunggu 1 menit.', 'warning');
                resetButtonLoading(btn);
                return;
            } else if (errMsg.indexOf('password') >= 0) {
                showToast('Password tidak memenuhi syarat keamanan.', 'error');
                resetButtonLoading(btn);
                return;
            }
            console.error('SignUp error:', authError);
            showToast('Gagal mendaftar: ' + authError.message, 'error');
            resetButtonLoading(btn);
            return;
        }

        authId = authData && authData.user ? authData.user.id : null;

        if (authData && authData.session === null) {
            showToast('Akun dibuat! Silakan cek email untuk konfirmasi sebelum login.', 'success');
        }
    }

    if (!authId) {
        showToast('Gagal mendapatkan ID autentikasi.', 'error');
        resetButtonLoading(btn);
        return;
    }

    await new Promise(function(r) { setTimeout(r, 800); });

    var existingEmp = null;
    try {
        var empResult = await supabaseClient.from('employees').select('*').eq('id', tempRegData.email).maybeSingle();
        existingEmp = empResult.data;
    } catch (err) {
        console.error('[Verify] Fetch existing employee exception:', err);
    }

    var employees = Store.get('employees');

    if (existingEmp) {
        if (existingEmp.name === 'User Baru' || !existingEmp.name) {
            await supabaseClient.from('employees').update({ name: tempRegData.nama, auth_id: authId }).eq('id', tempRegData.email);
            existingEmp.name = tempRegData.nama;
            existingEmp.auth_id = authId;
        } else if (!existingEmp.auth_id) {
            await supabaseClient.from('employees').update({ auth_id: authId }).eq('id', tempRegData.email);
            existingEmp.auth_id = authId;
        }

        var idx = employees.findIndex(function(e) { return e.id === tempRegData.email; });
        var empObj = {
            id: existingEmp.id,
            name: existingEmp.name,
            position: existingEmp.position || 'Staff',
            role: existingEmp.role,
            atasan: existingEmp.atasan,
            status: existingEmp.status,
            deviceId: existingEmp.device_id || 'Unbound',
            auth_id: existingEmp.auth_id
        };
        if (idx >= 0) employees[idx] = empObj;
        else employees.push(empObj);

        Store.set('employees', employees.slice());

        if (existingEmp.status === 'Approved') {
            showToast('Akun sudah aktif! Silakan login.', 'success');
        } else {
            showToast('Registrasi berhasil! Akun Pending. Tunggu approval Admin.', 'success');
        }
    } else {
        showToast('Menyimpan data profil...', 'info');
        var insertResult = await supabaseClient.from('employees').insert([{
            id: tempRegData.email,
            auth_id: authId,
            name: tempRegData.nama,
            position: 'Staff',
            role: 'Karyawan / Field',
            atasan: 'Master Admin',
            status: 'Pending',
            device_id: 'Unbound'
        }]);

        if (insertResult.error) {
            console.error('Insert employee error:', insertResult.error);
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
            Store.set('employees', employees.slice());
            showToast('Registrasi berhasil! Akun Pending. Tunggu approval Admin.', 'success');
        }
    }
    function showForgotPassword() {
    var loginStep = document.getElementById('login-step');
    var regStep1 = document.getElementById('reg-step-1');
    var regStep2 = document.getElementById('reg-step-2');
    var forgotStep = document.getElementById('forgot-step');

    if (loginStep) loginStep.classList.add('hidden');
    if (regStep1) regStep1.classList.add('hidden');
    if (regStep2) regStep2.classList.add('hidden');
    if (forgotStep) forgotStep.classList.remove('hidden');
}

function backToLogin() {
    var forgotStep = document.getElementById('forgot-step');
    var loginStep = document.getElementById('login-step');
    if (forgotStep) forgotStep.classList.add('hidden');
    if (loginStep) loginStep.classList.remove('hidden');
}

async function handleForgotPassword() {
    var emailEl = document.getElementById('forgot-email');
    if (!emailEl) return;
    var email = emailEl.value.trim();

    if (!email) {
        showToast('Harap masukkan email Anda.', 'error');
        return;
    }

    var btn = document.querySelector('#forgot-step button[onclick="handleForgotPassword()"]');
    setButtonLoading(btn, 'Mengirim instruksi...');

    try {
        var { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href
        });

        if (error) {
            showToast('Gagal mengirim reset password: ' + error.message, 'error');
        } else {
            showToast('Instruksi reset password telah dikirim ke email Anda. Silakan cek inbox.', 'success');
            emailEl.value = '';
            backToLogin();
        }
    } catch (e) {
        console.error('Reset password exception:', e);
        showToast('Terjadi kesalahan saat mereset password.', 'error');
    } finally {
        resetButtonLoading(btn);
    }
}

    await fetchAllDataFromSupabase();
    renderEmployees();
    updateDashboardStats();
    populateEmailRecipients();

    Store.set('generatedOTP', null);
    Store.set('otpExpiryTime', null);
    document.getElementById('reg-otp-input').value = '';
    toggleAuthMode('login');
    resetButtonLoading(btn);
}

async function initAuth() {
    try {
        // Paksa sign out saat halaman dimuat/direfresh agar selalu kembali sebagai guest
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('[Auth] Init auth exception:', err);
    }

    // Set default session ke Guest
    Store.set('activeEmployeeSession', { name: 'Guest', id: 'guest@gmail.com', role: 'Tamu' });
    
    // Reset UI ke Guest untuk Mobile & Desktop
    var mobileTitleEl = document.getElementById('mobile-user-title');
    if (mobileTitleEl) mobileTitleEl.innerText = 'Halo, Guest';
    var mobilePosEl = document.getElementById('mobile-user-position');
    if (mobilePosEl) mobilePosEl.innerText = '-';
    var mobileInitialEl = document.getElementById('mobile-user-initial');
    if (mobileInitialEl) mobileInitialEl.innerText = 'G';

    var desktopNameEl = document.getElementById('desktop-user-name');
    if (desktopNameEl) desktopNameEl.innerText = 'Halo, Guest';
    var desktopPosEl = document.getElementById('desktop-user-position');
    if (desktopPosEl) desktopPosEl.innerText = '-';
    var desktopInitialEl = document.getElementById('desktop-user-initial');
    if (desktopInitialEl) desktopInitialEl.innerText = 'AD';

    supabaseClient.auth.onAuthStateChange(async function(event, session) {
        if (event === 'SIGNED_OUT') {
            Store.set('activeEmployeeSession', { name: 'Guest', id: 'guest@gmail.com', role: 'Tamu' });
            
            var mobileTitleEl = document.getElementById('mobile-user-title');
            if (mobileTitleEl) mobileTitleEl.innerText = 'Halo, Guest';
            var mobilePosEl = document.getElementById('mobile-user-position');
            if (mobilePosEl) mobilePosEl.innerText = '-';
            var mobileInitialEl = document.getElementById('mobile-user-initial');
            if (mobileInitialEl) mobileInitialEl.innerText = 'G';

            var desktopNameEl = document.getElementById('desktop-user-name');
            if (desktopNameEl) desktopNameEl.innerText = 'Halo, Guest';
            var desktopPosEl = document.getElementById('desktop-user-position');
            if (desktopPosEl) desktopPosEl.innerText = '-';
            var desktopInitialEl = document.getElementById('desktop-user-initial');
            if (desktopInitialEl) desktopInitialEl.innerText = 'AD';

            Store.set('employees', []);
            Store.set('rekapList', []);
            Store.set('izinList', []);
            Store.set('emailsList', []);
            populateEmailRecipients();
            updateEmailBadges();
            switchMobileTab('daftar');
            await fetchAllDataFromSupabase();
        } else if (event === 'SIGNED_IN' && session) {
            await fetchAllDataFromSupabase();
        }
    });
}
