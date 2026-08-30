function initSupabaseRealtime() {
    if (typeof supabaseClient === 'undefined') return;

    supabaseClient.channel('realtime-leaves-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'izin_list' }, function() {
            if (typeof renderAdminIzin === 'function') renderAdminIzin();
            if (typeof showToast === 'function') showToast('Data izin diperbarui real-time.', 'info');
        }).subscribe();

    supabaseClient.channel('realtime-messages-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, function() {
            if (typeof renderEmails === 'function') renderEmails();
            if (typeof showToast === 'function') showToast('Pesan baru diterima!', 'success');
        }).subscribe();
}

// Implementasi fungsi initAuth untuk memisahkan error akun tidak terdaftar dan password salah
function initAuth() {
    const loginForm = document.getElementById('login-form'); // Sesuaikan dengan ID form login Anda
    if (!loginForm) return;

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim(); // Input nomor HP / email
        const password = document.getElementById('login-password').value;

        if (typeof supabaseClient === 'undefined') return;

        try {
            // 1. Validasi apakah akun terdaftar di database terlebih dahulu
            const { data: userCheck, error: checkError } = await supabaseClient
                .from('users') // Sesuaikan dengan nama tabel pengguna Anda
                .select('*')
                .or(`phone.eq.${identifier},email.eq.${identifier}`)
                .maybeSingle();

            if (checkError || !userCheck) {
                alert('Akun belum terdaftar di sistem. Silakan daftar via menu Mobile (HP).');
                return;
            }

            // 2. Jika akun ditemukan, lanjutkan autentikasi password
            const { data, error: loginError } = await supabaseClient.auth.signInWithPassword({
                email: userCheck.email, // Pastikan menggunakan email dari data yang ditemukan
                password: password
            });

            if (loginError) {
                alert('Password yang Anda masukkan salah.');
                return;
            }

            // Jika login berhasil
            if (typeof showToast === 'function') {
                showToast('Login berhasil!', 'success');
            }
            
            // Lihkan ke halaman dashboard atau muat ulang data
            if (typeof fetchAllDataFromSupabase === 'function') {
                fetchAllDataFromSupabase();
            }

        } catch (err) {
            console.error('Terjadi kesalahan sistem saat login:', err);
            alert('Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.');
        }
    });
}

setInterval(function() {
    var el = document.getElementById('live-clock');
    if (el) el.innerText = new Date().toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour12: false
    }) + ' WIB';
}, 1000);

document.addEventListener('DOMContentLoaded', function() {
    initializeDeviceBinding();
    fetchAllDataFromSupabase();
    initAuth();
    initSupabaseRealtime();
});
