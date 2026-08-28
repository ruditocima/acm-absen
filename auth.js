
# ============================================================
# FILE 4: auth.js — Authentication, OTP, Device Binding
# ============================================================
auth_js = r'''// ============================================================
// AUTH: Login, Register, OTP, Logout, Device Binding
// ============================================================

// --------------------------------------------------------
// SUPABASE CONNECTION CHECK
// --------------------------------------------------------
async function checkSupabaseConnection(retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            const { data, error } = await supabaseClient.from('roles').select('id').limit(1);
            if (error) {
                console.warn(`[Supabase] Connection check attempt ${i + 1} failed:`, error.message);
                if (i < retries) await new Promise(r => setTimeout(r, 800));
                continue;
            }
            Store.set('supabaseConnected', true);
            return true;
        } catch (err) {
            console.error(`[Supabase] Connection check attempt ${i + 1} exception:`, err);
            if (i < retries) await new Promise(r => setTimeout(r, 800));
        }
    }
    Store.set('supabaseConnected', false);
    return false;
}

// --------------------------------------------------------
// DEVICE BINDING
// --------------------------------------------------------
async function initializeDeviceBinding() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
            const info = await window.Capacitor.Plugins.Device.getId();
            Store.set('currentDeviceUUID', info.uuid);
        } else {
            throw new Error("Capacitor Native Plugin not found.");
        }
    } catch (error) {
        let localUUID = localStorage.getItem('hybrid_device_uuid');
        if (!localUUID) {
            localUUID = 'WEB-' + Math.random().toString(36).substring(2, 12).toUpperCase();
            localStorage.setItem('hybrid_device_uuid', localUUID);
        }
        Store.set('currentDeviceUUID', localUUID);
    }
    const deviceStatusEl = document.getElementById('mobile-device-status');
    if (deviceStatusEl) {
        const uuid = Store.get('currentDeviceUUID');
        deviceStatusEl.innerHTML = `<i class="fa-solid fa-shield-check"></i> ID: ${escapeHtml(uuid.substring(0, 8))}...`;
        deviceStatusEl.className = "text-emerald-400 font-semibold text-[11px]";
    }
}

// --------------------------------------------------------
// LOGIN VALIDATION (DEV BYPASS REMOVED!)
// --------------------------------------------------------
async function processLoginValidation(email, pass, isDesktop) {
    // SECURITY: DEV BYPASS DIHAPUS — tidak ada lagi hardcoded credential

    if (!email || !pass) {
        showToast('Harap isi email dan password Anda.', 'error');
        return false;
    }

    let authData, authError;
    try {
        const result = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
        authData = result.data;
        authError = result.error;
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

    // Cari employee by auth_id
    let { data: empData, error: empErr } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();

    if (empErr) console.warn('[Auth] Fetch employee by auth_id error:', empErr.message);

    // Fallback: cari by email dan link auth_id
    if (!empData) {
        const { data: fallbackData, error: fallbackErr } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('id', email)
            .maybeSingle();
        if (fallbackErr) console.warn('[Auth] Fetch employee by email error:', fallbackErr.message);
        if (fallbackData) {
            await supabaseClient.from('employees').update({ auth_id: authUser.id }).eq('id', email);
            empData = fallbackData;
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

    // Device binding (hanya untuk mobile/non-desktop)
    if (!isDesktop) {
        const currentDeviceUUID = Store.get('currentDeviceUUID');
        if (empData.device_id === 'Unbound' || !empData.device_id) {
            await supabaseClient.from('employees').update({ device_id: currentDeviceUUID }).eq('id', empData.id);
            empData.device_id = currentDeviceUUID;
            showToast('Perangkat berhasil diikat ke akun ini.', 'success');
            renderEmployees();
        } else if (empData.device_id !== currentDeviceUUID) {
            await supabaseClient.auth.signOut();
            return showToast('SECURITY ALERT: Login Ditolak! Akun ini telah terikat pada perangkat lain.', 'error');
        }
    }

    // Set session
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

    document.getElementById('mobile-user-title').innerText = `Halo, ${escapeHtml(empData.name)}`;
    document.getElementById('mobile-user-initial').innerText = empData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    await fetchAllDataFromSupabase();

    const readIds = getReadEmailIds();
    Store.get('emailsList').forEach(e => { if (readIds.includes(e.id)) e.read = true; });

    renderMobileMyHistory();
    renderEmails();
    renderAdminIzin();
    updateEmailBadges();
    populateEmailRecipients();

    return true;
}

async function handleLogin() {
    const btn = document.querySelector('#login-step button[onclick="handleLogin()"]');
    setButtonLoading(btn, 'Memproses login...');

    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const success = await processLoginValidation(email, pass, false);

    resetButtonLoading(btn);
    if (success) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-pass').value = '';
        showToast('Login berhasil!', 'success');
        switchMobileTab('absen');
    }
}

async function handleDesktopLogin() {
    const btn = document.querySelector('#desktop-login-section button[onclick="handleDesktopLogin()"]');
    setButtonLoading(btn, 'Memproses login...');

    const email = document.getElementById('d-login-email').value.trim();
    const pass = document.getElementById('d-login-pass').value.trim();
    const success = await processLoginValidation(email, pass, true);

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

async function handleLogout(skipModeSwitch = false) {
    await supabaseClient.auth.signOut();
    Store.set('activeEmployeeSession', { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' });
    document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
    document.getElementById('mobile-user-initial').innerText = 'T';
    populateEmailRecipients();
    updateEmailBadges();
    showToast('Anda telah logout.', 'success');
    if (!skipModeSwitch) {
        switchMode('mobile');
        switchMobileTab('daftar');
    }
}

// --------------------------------------------------------
// OTP REGISTRATION
// --------------------------------------------------------
async function requestOTP() {
    const btn = document.querySelector('#reg-step-1 button[onclick="requestOTP()"]');
    setButtonLoading(btn, 'Mengirim OTP...');

    const email = document.getElementById('reg-email').value.trim();
    const nama = document.getElementById('reg-nama').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();

    if (!email || !nama || !pass || !email.includes('@')) {
        showToast('Harap isi semua kolom dengan benar!', 'error');
        resetButtonLoading(btn);
        return;
    }
    if (pass.length < 6) {
        showToast('Password minimal 6 karakter!', 'error');
        resetButtonLoading(btn);
        return;
    }

    // Cek email sudah terdaftar
    showToast('Memeriksa ketersediaan email...', 'info');
    try {
        const { data: existingEmp } = await supabaseClient
            .from('employees')
            .select('id, name, status, auth_id')
            .eq('id', email)
            .maybeSingle();

        if (existingEmp && existingEmp.status === 'Approved') {
            showToast('Email sudah terdaftar dan aktif. Silakan login.', 'warning');
            const loginEmail = document.getElementById('login-email');
            if (loginEmail) loginEmail.value = email;
            toggleAuthMode('login');
            resetButtonLoading(btn);
            return;
        }

        const { data: signInCheck } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if (signInCheck && signInCheck.user) {
            showToast('Email sudah terdaftar. Login otomatis...', 'success');
            await processLoginValidation(email, pass, false);
            resetButtonLoading(btn);
            return;
        }
    } catch (e) {
        // abaikan error pengecekan
    }

    Store.set('tempRegData', { email, nama, pass });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    Store.set('generatedOTP', otp);
    Store.set('otpExpiryTime', Date.now() + (CONFIG.OTP.EXPIRY_MINUTES * 60 * 1000));

    const proceedToStep2 = (instructionHtml, toastType, toastMsg) => {
        const instElem = document.getElementById('otp-instruction-text');
        if (instElem) instElem.innerHTML = instructionHtml;
        showToast(toastMsg, toastType);
        document.getElementById('reg-step-1').classList.add('hidden');
        document.getElementById('reg-step-2').classList.remove('hidden');
        resetButtonLoading(btn);
    };

    if (typeof emailjs === 'undefined' || !emailjsReady) {
        proceedToStep2(
            `<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">
                <p class="text-amber-400 font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Layanan Email Belum Siap</p>
                <p class="text-slate-300 text-[11px]">Gunakan kode OTP berikut untuk verifikasi:</p>
                <div class="text-3xl font-mono font-bold text-gold-400 tracking-[0.2em] my-2 text-center bg-slate-950 py-2 rounded-lg border border-slate-800">${otp}</div>
                <p class="text-[10px] text-slate-400">Kode berlaku ${CONFIG.OTP.EXPIRY_MINUTES} menit.</p>
            </div>`,
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
                message: `Kode OTP Anda adalah: ${otp}. Berlaku ${CONFIG.OTP.EXPIRY_MINUTES} menit.`
            },
            CONFIG.EMAILJS.PUBLIC_KEY
        );

        proceedToStep2(
            `Kode OTP telah dikirimkan ke email <b class="text-gold-400">${escapeHtml(email)}</b>. Silakan cek inbox/spam folder Anda.`,
            'success',
            'Kode OTP berhasil dikirim ke email Anda!'
        );
    } catch (error) {
        console.error('EmailJS Error:', error);
        const errorMsg = (error && error.text) ? error.text : (error && error.message ? error.message : 'Unknown error');
        proceedToStep2(
            `<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">
                <p class="text-amber-400 font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Gagal Mengirim Email</p>
                <p class="text-slate-300 text-[11px]">Email tidak dapat dikirim. Gunakan kode OTP di bawah ini:</p>
                <div class="text-3xl font-mono font-bold text-gold-400 tracking-[0.2em] my-2 text-center bg-slate-950 py-2 rounded-lg border border-slate-800">${otp}</div>
                <p class="text-[10px] text-slate-400">Error: ${escapeHtml(errorMsg)} | Kode berlaku ${CONFIG.OTP.EXPIRY_MINUTES} menit.</p>
            </div>`,
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
    const btn = document.querySelector('#reg-step-2 button[onclick="verifyOTP()"]');
    setButtonLoading(btn, 'Mendaftarkan akun...');

    const otp = document.getElementById('reg-otp-input').value.trim();
    const generatedOTP = Store.get('generatedOTP');
    const otpExpiryTime = Store.get('otpExpiryTime');
    const tempRegData = Store.get('tempRegData');

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

    // Cek user sudah ada di auth
    let existingAuthUser = null;
    try {
        const { data: signInData } = await supabaseClient.auth.signInWithPassword({
            email: tempRegData.email,
            password: tempRegData.pass
        });
        if (signInData && signInData.user) {
            existingAuthUser = signInData.user;
            showToast('Email sudah terdaftar. Login otomatis...', 'info');
        }
    } catch (e) { /* abaikan */ }

    let authId = null;

    if (existingAuthUser) {
        authId = existingAuthUser.id;
    } else {
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
            resetButtonLoading(btn);
            return;
        }

        if (authError) {
            const errMsg = (authError.message || '').toLowerCase();
            const errStatus = authError.status || 0;
            if (errStatus === 422 || errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
                showToast('Email sudah terdaftar. Silakan login.', 'warning');
                const loginEmail = document.getElementById('login-email');
                if (loginEmail && tempRegData) loginEmail.value = tempRegData.email;
                toggleAuthMode('login');
                Store.set('generatedOTP', null);
                Store.set('otpExpiryTime', null);
                document.getElementById('reg-otp-input').value = '';
                resetButtonLoading(btn);
                return;
            } else if (errMsg.includes('rate limit') || errMsg.includes('too many')) {
                showToast('Terlalu banyak percobaan. Tunggu 1 menit.', 'warning');
                resetButtonLoading(btn);
                return;
            } else if (errMsg.includes('password')) {
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

    await new Promise(r => setTimeout(r, 800));

    let existingEmp = null;
    try {
        const { data } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('id', tempRegData.email)
            .maybeSingle();
        existingEmp = data;
    } catch (err) {
        console.error('[Verify] Fetch existing employee exception:', err);
    }

    const employees = Store.get('employees');

    if (existingEmp) {
        if (existingEmp.name === 'User Baru' || !existingEmp.name) {
            await supabaseClient.from('employees').update({ name: tempRegData.nama, auth_id: authId }).eq('id', tempRegData.email);
            existingEmp.name = tempRegData.nama;
            existingEmp.auth_id = authId;
        } else if (!existingEmp.auth_id) {
            await supabaseClient.from('employees').update({ auth_id: authId }).eq('id', tempRegData.email);
            existingEmp.auth_id = authId;
        }

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
        if (idx >= 0) employees[idx] = empObj;
        else employees.push(empObj);

        Store.set('employees', [...employees]);

        if (existingEmp.status === 'Approved') {
            showToast('Akun sudah aktif! Silakan login.', 'success');
        } else {
            showToast('Registrasi berhasil! Akun Pending. Tunggu approval Admin.', 'success');
        }
    } else {
        showToast('Menyimpan data profil...', 'info');
        const { error: insertErr } = await supabaseClient.from('employees').insert([{
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
            Store.set('employees', [...employees]);
            showToast('Registrasi berhasil! Akun Pending. Tunggu approval Admin.', 'success');
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

// --------------------------------------------------------
// INIT AUTH ON STARTUP
// --------------------------------------------------------
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
                document.getElementById('mobile-user-title').innerText = `Halo, ${escapeHtml(empData.name)}`;
                document.getElementById('mobile-user-initial').innerText = empData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                await fetchAllDataFromSupabase();
                const readIds = getReadEmailIds();
                Store.get('emailsList').forEach(e => { if (readIds.includes(e.id)) e.read = true; });
                renderMobileMyHistory();
                renderEmails();
                renderAdminIzin();
                updateEmailBadges();
                populateEmailRecipients();
            }
        }
    } catch (err) {
        console.error('[Auth] Init auth exception:', err);
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            Store.set('activeEmployeeSession', { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' });
            document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
            document.getElementById('mobile-user-initial').innerText = 'T';
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
'''

with open('/mnt/agents/output/auth.js', 'w', encoding='utf-8') as f:
    f.write(auth_js)

print("✅ auth.js created")
