// Helper yang aman untuk mendeteksi atau menginisialisasi Supabase client
function getSupabaseClient() {
    // 1. Jika variable 'supabase' global sudah berupa instance client (memiliki method .from)
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        return supabase;
    }
    // 2. Jika tersimpan di window.supabaseClient
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && typeof window.supabaseClient.from === 'function') {
        return window.supabaseClient;
    }
    // 3. Jika window.supabase adalah CDN library, coba buat instance otomatis jika config URL & KEY tersedia
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        var url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : (window.SUPABASE_URL || '');
        var key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : (window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || '');
        
        if (url && key) {
            if (!window._supaInstance) {
                window._supaInstance = window.supabase.createClient(url, key);
            }
            return window._supaInstance;
        }
    }
    return null;
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
        else alert('Harap isi tanggal dan keterangan libur!');
        return;
    }

    var db = getSupabaseClient();
    if (!db || typeof db.from !== 'function') {
        var errMsg = 'Koneksi Supabase belum siap. Periksa urutan script di index.html!';
        console.error(errMsg);
        if (typeof showToast === 'function') showToast(errMsg, 'error');
        else alert(errMsg);
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
        console.warn('Supabase client belum terinisialisasi pada renderLibur.');
        tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-rose-400">Koneksi Database Belum Siap (Periksa Urutan Script HTML)</td></tr>';
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
