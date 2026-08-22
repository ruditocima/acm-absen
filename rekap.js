function renderRekap() {
    renderRekapDataToTable(rekapList);
}

function renderRekapDataToTable(dataList) {
    const tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;
    tbody.innerHTML = dataList.map(function(r, i) {
        const statusBadge = r.status === 'Tepat Waktu'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        const selfieBtn = r.selfie_url
            ? `<button onclick="openImageZoom('${r.selfie_url}')" class="px-2 py-1 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-image"></i> Lihat</button>`
            : '-';
        return `
            <tr class="hover:bg-slate-900/50">
                <td class="p-3 text-white">${r.date}</td>
                <td class="p-3 font-semibold text-white">${r.name}</td>
                <td class="p-3 text-slate-300">${r.basecamp}</td>
                <td class="p-3 font-mono text-emerald-400">${r.time}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge}">${r.status}</span>
                </td>
                <td class="p-3 text-rose-400 font-mono">${r.late}</td>
                <td class="p-3">${selfieBtn}</td>
            </tr>`;
    }).join('');
}

function renderMobileMyHistory() {
    const container = document.getElementById('mobile-my-history');
    if (!container) return;
    const myRekap = rekapList.filter(function(r) { return r.name === activeEmployeeSession.name; });
    const myIzin = izinList.filter(function(i) { return i.name === activeEmployeeSession.name; });
    let html = '';
    if (myRekap.length === 0 && myIzin.length === 0) {
        html = '<p class="text-slate-500 text-center py-2">Belum ada riwayat tercatat.</p>';
    } else {
        myRekap.slice().reverse().forEach(function(r) {
            const statusColor = r.status === 'Tepat Waktu' ? 'text-emerald-500' : 'text-amber-500';
            html += `
                <div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2">
                    <div>
                        <p class="text-xs font-bold text-white">${r.date}</p>
                        <p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-gold-400"></i> ${r.basecamp}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-mono text-emerald-400">${r.time} WIB</p>
                        <p class="text-[10px] ${statusColor} font-semibold">${r.status}</p>
                    </div>
                </div>`;
        });
        myIzin.slice().reverse().forEach(function(i) {
            const izinStatusClass = i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400';
            html += `
                <div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2">
                    <div>
                        <p class="text-xs font-bold text-white">Izin: ${i.jenis}</p>
                        <p class="text-[10px] text-slate-400">${i.start} s/d ${i.end}</p>
                    </div>
                    <div class="text-right">
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${izinStatusClass}">${i.status}</span>
                    </div>
                </div>`;
        });
    }
    container.innerHTML = html;
}

function filterRekap() {
    const start = document.getElementById('rekap-start-date').value;
    const end = document.getElementById('rekap-end-date').value;
    if (!start || !end) {
        renderRekapDataToTable(rekapList);
        return;
    }
    const filtered = rekapList.filter(function(r) { return r.date >= start && r.date <= end; });
    renderRekapDataToTable(filtered);
    showToast('Filter rekap berhasil diterapkan.', 'success');
}

function resetRekapData() {
    if (!isMasterAdmin()) { showToast('Akses Ditolak! Hanya Master Admin.', 'error'); return; }
    showConfirm('Reset Data Rekap', 'Hapus seluruh data rekap absensi?', async function() {
        await supabaseClient.from('rekap_list').delete().neq('id', 0);
        rekapList = [];
        renderRekap();
        updateDashboardStats();
        showToast('Data rekap berhasil di-reset.', 'success');
    });
}

function exportToExcel() {
    if (rekapList.length === 0) { showToast('Tidak ada data rekap untuk diexport.', 'warning'); return; }
    const worksheet = XLSX.utils.json_to_sheet(rekapList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    XLSX.writeFile(workbook, "Rekap_Absensi_Enterprise.xlsx");
    showToast('File Excel berhasil di-download.', 'success');
}