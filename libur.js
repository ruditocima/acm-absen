// Helper untuk memastikan koneksi Supabase client sudah siap
function getSupabaseClient() {
    // Jika supabase sudah berupa instance client (memiliki method .from)
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        return supabase;
    }
    // Jika window.supabase memuat createClient dan variabel URL/KEY tersedia di global scope
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
            window._supaInstance = window._supaInstance || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return window._supaInstance;
        }
    }
    return window.supabase;
}

// Membuka modal tambah libur
function openAddLiburModal() {
    var modal = document.getElementById('libur-modal');
    if (modal) modal.classList.remove('hidden');
}

// Menutup modal tambah libur dan mereset form
function closeLiburModal() {
    var modal = document.getElementById('libur-modal');
    if (modal) modal.classList.add('hidden');
    var dateInput = document.getElementById('inp-libur-date');
    var descInput = document.getElementById('inp-libur-desc');
    if (dateInput) dateInput.value = '';
    if (descInput) descInput.value = '';
}

// Menyimpan data libur baru ke Supabase
async function saveLibur() {
    var dateEl = document.getElementById('inp-libur-date');
    var descEl = document.getElementById('inp-libur-desc');

    if (!dateEl || !descEl) return;

    var date = dateEl.value;
    var desc = descEl.value;

    if (!date || !desc) {
        if (typeof showToast === 'function') showToast('Harap isi tanggal dan keterangan libur!', 'error');
        return;
    }

    var db = getSupabaseClient();
    if (!db || typeof db.from !== 'function') {
        if (typeof showToast === 'function') showToast('Koneksi Supabase belum terinisialisasi dengan benar di config.js', 'error');
        console.error('Supabase client not initialized properly.');
        return;
    }

    var { data, error } = await db
        .from('holidays')
        .insert([{ date: date, description: desc }]);

    if (error) {
        console.error('Supabase Insert Error:', error);
        if (typeof showToast === 'function') showToast('Gagal menyimpan: ' + error.message, 'error');
        return;
    }

    if (typeof showToast === 'function') showToast('Hari libur berhasil ditambahkan.', 'success');
    
    closeLiburModal();
    renderLibur();
}

// Menampilkan data di tabel tab libur dari Supabase
async function renderLibur() {
    var tbody = document.getElementById('libur-tbody');
    if (!tbody) return;

    var db = getSupabaseClient();
    if (!db || typeof db.from !== 'function') {
        tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-rose-400">Koneksi Database Supabase Belum Terhubung</td></tr>';
        return;
    }

    var { data: holidays, error } = await db
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

    if (error) {
        console.error('Supabase Select Error:', error);
        if (typeof showToast === 'function') showToast('Gagal memuat data: ' + error.message, 'error');
        return;
    }

    var html = '';

    if (!holidays || holidays.length === 0) {
        html = '<tr><td colspan="3" class="p-3 text-center text-slate-500">Belum ada data hari libur</td></tr>';
    } else {
        holidays.forEach(function(h) {
            var safeDate = typeof escapeHtml === 'function' ? escapeHtml(h.date) : h.date;
            var safeDesc = typeof escapeHtml === 'function' ? escapeHtml(h.description) : h.description;
            
            html += '<tr class="hover:bg-slate-800/50">' +
                '<td class="p-3">' + safeDate + '</td>' +
                '<td class="p-3">' + safeDesc + '</td>' +
                '<td class="p-3 text-right">' +
                    '<button onclick="deleteLibur(\x27' + h.id + '\x27)" class="px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-trash"></i> Hapus</button>' +
                '</td>' +
                '</tr>';
        });
    }
    tbody.innerHTML = html;
}

// Menghapus data libur dari Supabase berdasarkan ID (UUID)
async function deleteLibur(id) {
    var db = getSupabaseClient();
    if (!db || typeof db.from !== 'function') {
        if (typeof showToast === 'function') showToast('Koneksi database belum siap', 'error');
        return;
    }

    var { error } = await db
        .from('holidays')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Supabase Delete Error:', error);
        if (typeof showToast === 'function') showToast('Gagal menghapus: ' + error.message, 'error');
        return;
    }

    renderLibur();
    if (typeof showToast === 'function') showToast('Hari libur berhasil dihapus.', 'info');
}
