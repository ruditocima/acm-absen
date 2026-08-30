// Membuka modal tambah libur
function openAddLiburModal() {
    document.getElementById('libur-modal').classList.remove('hidden');
}

// Menutup modal tambah libur dan mereset form
function closeLiburModal() {
    document.getElementById('libur-modal').classList.add('hidden');
    document.getElementById('inp-libur-date').value = '';
    document.getElementById('inp-libur-desc').value = '';
}

// Menyimpan data libur baru ke Supabase
async function saveLibur() {
    var date = document.getElementById('inp-libur-date').value;
    var desc = document.getElementById('inp-libur-desc').value;

    if (!date || !desc) {
        if (typeof showToast === 'function') showToast('Harap isi tanggal dan keterangan libur!', 'error');
        return;
    }

    var { error } = await supabase
        .from('holidays')
        .insert([{ date: date, description: desc }]);

    if (error) {
        if (typeof showToast === 'function') showToast('Gagal menyimpan hari libur: ' + error.message, 'error');
        return;
    }

    if (typeof showToast === 'function') showToast('Hari libur berhasil ditambahkan.', 'success');
    
    closeLiburModal();
    renderLibur(); // Render ulang tabel dari Supabase
}

// Menampilkan data di tabel tab libur dari Supabase
async function renderLibur() {
    var tbody = document.getElementById('libur-tbody');
    if (!tbody) return;

    var { data: holidays, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

    if (error) {
        if (typeof showToast === 'function') showToast('Gagal memuat data hari libur: ' + error.message, 'error');
        return;
    }

    var html = '';

    if (!holidays || holidays.length === 0) {
        html = '<tr><td colspan="3" class="p-3 text-center text-slate-500">Belum ada data hari libur</td></tr>';
    } else {
        holidays.forEach(function(h) {
            var safeDate = typeof escapeHtml === 'function' ? escapeHtml(h.date) : h.date;
            // Menyesuaikan dengan nama kolom 'description' di skema Supabase
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
    var { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

    if (error) {
        if (typeof showToast === 'function') showToast('Gagal menghapus hari libur: ' + error.message, 'error');
        return;
    }

    renderLibur();
    if (typeof showToast === 'function') showToast('Hari libur berhasil dihapus.', 'info');
}
