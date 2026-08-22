
# 6. js/auth.js
auth_js = '''// ==========================================
// AUTHENTICATION MODULE
// Login, Register, OTP, Logout
// ==========================================

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

async function processLoginValidation(email, pass, isDesktop = false) {
    if (!email || !pass) return showToast('Harap isi email dan password Anda.', 'error');

    const emp = employees.find(e => e.id === email);
    if (!emp) return showToast('Akun tidak ditemukan. Silakan daftar terlebih dahulu.', 'error');

    if (emp.status !== 'Approved') return showToast('Akun Anda masih berstatus Pending (Menunggu Approval Admin).', 'warning');

    if (emp.password !== '••••••••') {
        const hashedInput = await hashPassword(pass);
        if (hashedInput !== emp.password && pass !== emp.password) {
            return showToast('Kombinasi Email dan Password salah!', 'error');
        }
    }

    if (!isDesktop) {
        if (emp.deviceId === 'Unbound') {
            emp.deviceId = currentDeviceUUID;
            await supabaseClient.from('employees').update({ device_id: currentDeviceUUID }).eq('id', emp.id);
            showToast(`Perangkat berhasil diikat ke akun ini (ID: ${currentDeviceUUID.substring(0,8)}).`, 'success');
            renderEmployees();
        }
        else if (emp.deviceId !== currentDeviceUUID) {
            return showToast('SECURITY ALERT: Login Ditolak! Akun ini telah terikat pada perangkat lunak / HP fisik lain.', 'error');
        }
    }

    activeEmployeeSession = emp;
    document.getElementById('mobile-user-title').innerText = `Halo, ${emp.name}`;
    document.getElementById('mobile-user-initial').innerText = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    const readIds = getReadEmailIds();
    emailsList.forEach(e => {
        if (readIds.includes(e.id)) e.read = true;
    });

    renderMobileMyHistory();
    renderEmails();
    renderAdminIzin();
    updateEmailBadges();
    populateEmailRecipients();
    return true;
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    const success = await processLoginValidation(email, pass, false);
    if (success) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-pass').value = '';
        showToast('Login berhasil! Mengarahkan ke panel absensi...', 'success');
        switchMobileTab('absen');
    }
}

async function handleDesktopLogin() {
    const email = document.getElementById('d-login-email').value.trim();
    const pass = document.getElementById('d-login-pass').value.trim();

    const success = await processLoginValidation(email, pass, true);
    if (success) {
        document.getElementById('d-login-email').value = '';
        document.getElementById('d-login-pass').value = '';
        showToast('Login Enterprise berhasil!', 'success');

        document.getElementById('desktop-login-section').classList.add('hidden');
        document.getElementById('desktop-app-wrapper').classList.remove('hidden');
        applyRolePermissions();
    }
}

function handleLogout() {
    activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
    document.getElementById('mobile-user-title').innerText = `Halo, Tamu`;
    document.getElementById('mobile-user-initial').innerText = 'T';

    populateEmailRecipients();
    updateEmailBadges();
    showToast('Anda telah logout dari sistem.', 'success');
    switchMode('mobile');
    switchMobileTab('daftar');
}

function requestOTP() {
    const email = document.getElementById('reg-email').value.trim();
    const nama = document.getElementById('reg-nama').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();

    if (!email || !nama || !pass || !email.includes('@gmail.com')) {
        showToast('Harap isi semua kolom dengan benar (Gunakan Gmail)!', 'error');
        return;
    }
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
    if (!generatedOTP) { return showToast('Sesi OTP tidak valid.', 'error'); }
    if (Date.now() > otpExpiryTime) { return showToast('Kode OTP sudah kedaluwarsa!', 'error'); }
    if (otp !== generatedOTP) { return showToast('Kode OTP salah!', 'error'); }

    const hashedPassword = await hashPassword(tempRegData.pass);
    const newEmp = {
        id: tempRegData.email, name: tempRegData.nama, position: 'Staff',
        role: 'Karyawan / Field', atasan: 'Master Admin',
        password: hashedPassword, status: 'Pending', device_id: 'Unbound'
    };

    employees.push({ ...newEmp, deviceId: newEmp.device_id });
    await supabaseClient.from('employees').insert([newEmp]);

    showToast('Registrasi berhasil! Akun berstatus Pending.', 'success');
    renderEmployees();
    updateDashboardStats();

    generatedOTP = null;
    otpExpiryTime = null;
    document.getElementById('reg-otp-input').value = '';
    toggleAuthMode('login');
}
'''

with open(f"{output_dir}/js/auth.js", "w", encoding="utf-8") as f:
    f.write(auth_js)

print("✅ js/auth.js created")
