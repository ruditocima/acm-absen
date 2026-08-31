function getStatusBadgeClass(status) {
    if (status === 'Tepat Waktu') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (status === 'Sakit') return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    if (status === 'Cuti Tahunan') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    if (status === 'Dinas Luar') return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
}

function renderRekapDataToTable(dataList) {
    var tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;

    tbody.innerHTML = dataList.map(function(r) {
        return '<tr class="hover:bg-slate-900/50">' +
            '<td class="p-3 text-white">' + escapeHtml(r.date) + '</td>' +
            '<td class="p-3 font-semibold text-white">' + escapeHtml(r.name) + '</td>' +
            '<td class="p-3 text-slate-300">' + escapeHtml(r.basecamp) + '</td>' +
            '<td class="p-3 font-mono text-emerald-400">' + escapeHtml(r.time) + ' WIB</td>' +
            '<td class="p-3"><span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ' + getStatusBadgeClass(r.status) + '">' + escapeHtml(r.status) + '</span></td>' +
            '<td class="p-3 text-rose-400 font-mono">' + escapeHtml(r.late) + '</td>' +
            '<td class="p-3">' + (r.selfie_url ? '<button onclick="openImageZoom(\'' + escapeHtml(r.selfie_url) + '\')" class="px-2 py-1 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-image"></i> Lihat</button>' : '-') + '</td>' +
            '</tr>';
    }).join('');
}

function renderRekap() {
    var dataToRender = Store.get('rekapList');
    var session = Store.get('activeEmployeeSession');

    if (session.role === 'Karyawan / Field') {
        dataToRender = dataToRender.filter(function(r) { return r.name === session.name; });
    }

    renderRekapDataToTable(dataToRender);

    var tbody = document.getElementById('rekap-tbody');
    var totalCount = Store.get('rekapTotalCount');
    var currentCount = dataToRender.length;

    if (tbody && currentCount < totalCount) {
        var loadMoreRow = document.createElement('tr');
        loadMoreRow.innerHTML = '<td colspan="7" class="p-4 text-center"><button onclick="loadMoreRekap()" class="px-4 py-2 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-semibold transition"><i class="fa-solid fa-chevron-down"></i> Muat ' + CONFIG.PAGINATION.REKAP_PER_PAGE + ' Data Lagi (' + currentCount + ' / ' + totalCount + ')</button></td>';
        tbody.appendChild(loadMoreRow);
    }
}

function filterRekap() {
    var start = document.getElementById('rekap-start-date').value;
    var end = document.getElementById('rekap-end-date').value;
    var filtered = Store.get('rekapList');
    var session = Store.get('activeEmployeeSession');

    if (session.role === 'Karyawan / Field') {
        filtered = filtered.filter(function(r) { return r.name === session.name; });
    }
    if (start && end) {
        filtered = filtered.filter(function(r) { return r.date >= start && r.date <= end; });
    }
    renderRekapDataToTable(filtered);
    showToast('Filter rekap berhasil.', 'success');
}

function resetRekapData() {
    if (Store.get('activeEmployeeSession').role !== 'Master Admin') {
        return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    }
    showConfirm('Reset Data Rekap', 'Hapus seluruh data rekap absensi?', async function() {
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
    var dataToExport = Store.get('rekapList');
    var session = Store.get('activeEmployeeSession');

    if (session.role === 'Karyawan / Field') {
        dataToExport = dataToExport.filter(function(r) { return r.name === session.name; });
    }
    if (dataToExport.length === 0) return showToast('Tidak ada data rekap.', 'warning');

    var worksheet = XLSX.utils.json_to_sheet(dataToExport);
    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Absensi');
    XLSX.writeFile(workbook, 'Rekap_Absensi_Enterprise.xlsx');
    showToast('File Excel berhasil di-download.', 'success');
}
