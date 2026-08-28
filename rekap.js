
# ============================================================
# FILE 8: rekap.js — Rekap Absensi dengan Pagination
# ============================================================
rekap_js = r'''// ============================================================
// REKAP: Render Tabel, Filter, Export, Reset (dengan Pagination)
// ============================================================

function renderRekapDataToTable(dataList) {
    const tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;

    tbody.innerHTML = dataList.map((r) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 text-white">${escapeHtml(r.date)}</td>
            <td class="p-3 font-semibold text-white">${escapeHtml(r.name)}</td>
            <td class="p-3 text-slate-300">${escapeHtml(r.basecamp)}</td>
            <td class="p-3 font-mono text-emerald-400">${formatRekapTime(r.time)}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Tepat Waktu' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${escapeHtml(r.status)}</span></td>
            <td class="p-3 text-rose-400 font-mono">${escapeHtml(r.late)}</td>
            <td class="p-3">${r.selfie_url ? `<button onclick="openImageZoom('${escapeHtml(r.selfie_url)}')" class="px-2 py-1 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-image"></i> Lihat</button>` : '-'}</td>
        </tr>
    `).join('');
}

function renderRekap() {
    let dataToRender = Store.get('rekapList');
    const session = Store.get('activeEmployeeSession');

    if (session.role === 'Karyawan / Field') {
        dataToRender = dataToRender.filter(r => r.name === session.name);
    }

    renderRekapDataToTable(dataToRender);

    // Tambahkan tombol "Load More" jika masih ada data
    const tbody = document.getElementById('rekap-tbody');
    const totalCount = Store.get('rekapTotalCount');
    const currentCount = dataToRender.length;

    if (tbody && currentCount < totalCount) {
        const loadMoreRow = document.createElement('tr');
        loadMoreRow.innerHTML = `
            <td colspan="7" class="p-4 text-center">
                <button onclick="loadMoreRekap()" class="px-4 py-2 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-semibold transition">
                    <i class="fa-solid fa-chevron-down"></i> Muat ${CONFIG.PAGINATION.REKAP_PER_PAGE} Data Lagi (${currentCount} / ${totalCount})
                </button>
            </td>
        `;
        tbody.appendChild(loadMoreRow);
    }
}

function filterRekap() {
    const start = document.getElementById('rekap-start-date').value;
    const end = document.getElementById('rekap-end-date').value;
    let filtered = Store.get('rekapList');
    const session = Store.get('activeEmployeeSession');

    if (session.role === 'Karyawan / Field') {
        filtered = filtered.filter(r => r.name === session.name);
    }
    if (start && end) {
        filtered = filtered.filter(r => r.date >= start && r.date <= end);
    }
    renderRekapDataToTable(filtered);
    showToast('Filter rekap berhasil.', 'success');
}

function resetRekapData() {
    if (Store.get('activeEmployeeSession').role !== 'Master Admin') {
        return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    }
    showConfirm('Reset Data Rekap', 'Hapus seluruh data rekap absensi?', async () => {
        await supabaseClient.from('rekap_list').delete().neq('id', 0);
        Store.set('rekapList', []);
        Store.set('rekapPage', 0);
        Store.set('rekapTotalCount', 0);
        renderRekap();
        updateDashboardStats();
        showToast('Data rekap berhasil di-reset.', 'success');
    });
}

function exportToExcel() {
    let dataToExport = Store.get('rekapList');
    const session = Store.get('activeEmployeeSession');

    if (session.role === 'Karyawan / Field') {
        dataToExport = dataToExport.filter(r => r.name === session.name);
    }
    if (dataToExport.length === 0) return showToast('Tidak ada data rekap.', 'warning');

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    XLSX.writeFile(workbook, "Rekap_Absensi_Enterprise.xlsx");
    showToast('File Excel berhasil di-download.', 'success');
}
'''

with open('/mnt/agents/output/rekap.js', 'w', encoding='utf-8') as f:
    f.write(rekap_js)

print("✅ rekap.js created")
