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

// Menyimpan data libur baru
function saveLibur() {
    var date = document.getElementById('inp-libur-date').value;
    var desc = document.getElementById('inp-libur-desc').value;

    if (!date || !desc) {
        if (typeof showToast === 'function') showToast('Harap isi tanggal dan keterangan libur!', 'error');
        return;
    }

    var holidays = Store.get('holidays') || [];
    holidays.push({ date: date, description: desc });
    
    // Urutkan berdasarkan tanggal
    holidays.sort(function(a, b) {
        return new Date(a.date) - new Date(b.date);
    });

    Store.set('holidays', holidays);
    
    if (typeof showToast === 'function') showToast('Hari libur berhasil ditambahkan.', 'success');
    
    closeLiburModal();
    renderLibur(); // Render ulang tabel
}

// Menampilkan data di tabel tab libur
function renderLibur() {
    var tbody = document.getElementById('libur-tbody');
    if (!tbody) return;

    var holidays = Store.get('holidays') || [];
    var html = '';

    if (holidays.length === 0) {
        html = '<tr><td colspan="3" class="p-3 text-center text-slate-500">Belum ada data hari libur</td></tr>';
    } else {
        holidays.forEach(function(h, index) {
            // Asumsi fungsi escapeHtml sudah ada di utils.js
            var safeDate = typeof escapeHtml === 'function' ? escapeHtml(h.date) : h.date;
            var safeDesc = typeof escapeHtml === 'function' ? escapeHtml(h.desc) : h.desc;
            
            html += '<tr class="hover:bg-slate-800/50">' +
                '<td class="p-3">' + safeDate + '</td>' +
                '<td class="p-3">' + safeDesc + '</td>' +
                '<td class="p-3 text-right">' +
                    '<button onclick="deleteLibur(' + index + ')" class="px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-trash"></i> Hapus</button>' +
                '</td>' +
                '</tr>';
        });
    }
    tbody.innerHTML = html;
}

// Menghapus data libur
function deleteLibur(index) {
    var holidays = Store.get('holidays') || [];
    holidays.splice(index, 1);
    Store.set('holidays', holidays);
    renderLibur();
    if (typeof showToast === 'function') showToast('Hari libur berhasil dihapus.', 'info');
}
