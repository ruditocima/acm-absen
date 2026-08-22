
# 11. js/rekap.js
rekap_js = '''// ==========================================
// REKAP / REPORT MODULE
// Rekap Absensi, Filter, Export Excel
// ==========================================

function renderRekap() {
    renderRekapDataToTable(rekapList);
}

function renderRekapDataToTable(dataList) {
    const tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;

    tbody.innerHTML = dataList.map((r, i) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 text-white">${r.date}</td>
            <td class="p-3 font-semibold text-white">${r.name}</td>
            <td class="p-3 text-slate-300">${r.basecamp}</td>
            <td class="p-3 font-mono text-emerald-400">${r.time}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Tepat Waktu' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
                    ${r.status}
                </span>
            </td>
            <td class="p-3 text-rose-400 font-mono">${r.late}</td>
            <td class="p-3">
                ${r.selfie_url ? `<button onclick="openImageZoom('${r.selfie_url}')" class="px-2 py-1 bg-slate-800 text-gold-400 border border-slate-700 hover:bg-slate-700 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-image"></i> Lihat</button>` : '-'}
            </td>
        </tr>
    `).join('');
}

function renderMobileMyHistory() {
    const container = document.getElementById('mobile-my-history');
    if (!container) return;

    const myRekap = rekapList.filter(r => r.name === activeEmployeeSession.name);
    const myIzin = izinList.filter(i => i.name === activeEmployeeSession.name);

    let html = '';

    if (myRekap.length === 0 && myIzin.length === 0) {
        html = '<p class="text-slate-500 text-center py-2">Belum ada riwayat tercatat.</p>';
    } else {
        myRekap.slice().reverse().forEach(r => {
            html += `
                <div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2">
                    <div>
                        <p class="text-xs font-bold text-white">${r.date}</p>
                        <p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-gold-400"></i> ${r.basecamp}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-mono text-emerald-400">${r.time} WIB</p>
                        <p class="text-[10px] ${r.status === 'Tepat Waktu' ? 'text-emerald-500' : 'text-amber-500'} font-semibold">${r.status}</p>
                    </div>
                </div>
            `;
        });

        myIzin.slice().reverse().forEach(i => {
            html += `
                <div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2">
                    <div>
                        <p class="text-xs font-bold text-white">Izin: ${i.jenis}</p>
                        <p class="text-[10px] text-slate-400">${i.start} s/d ${i.end}</p>
                    </div>
                    <div class="text-right">
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${i.status}</span>
                    </div>
                </div>
            `;
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

    const filtered = rekapList.filter(r => r.date >= start && r.date <= end);
    renderRekapDataToTable(filtered);
    showToast('Filter rekap berhasil diterapkan.', 'success');
}

function resetRekapData() {
    if (!isMasterAdmin()) { return showToast('Akses Ditolak! Hanya Master Admin.', 'error'); }
    showConfirm('Reset Data Rekap', 'Hapus seluruh data rekap absensi?', async () => {
        await supabaseClient.from('rekap_list').delete().neq('id', 0);
        rekapList = [];
        renderRekap();
        updateDashboardStats();
        showToast('Data rekap berhasil di-reset.', 'success');
    });
}

function exportToExcel() {
    if (rekapList.length === 0) { return showToast('Tidak ada data rekap untuk diexport.', 'warning'); }
    const worksheet = XLSX.utils.json_to_sheet(rekapList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    XLSX.writeFile(workbook, "Rekap_Absensi_Enterprise.xlsx");
    showToast('File Excel berhasil di-download.', 'success');
}
'''

with open(f"{output_dir}/js/rekap.js", "w", encoding="utf-8") as f:
    f.write(rekap_js)

# 12. js/dashboard.js
dashboard_js = '''// ==========================================
// DASHBOARD MODULE
// Statistics & Overview
// ==========================================

function updateDashboardStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    const totalKaryawan = employees.length;

    const todayRekap = rekapList.filter(r => r.date === todayStr);
    const tepatWaktuCount = todayRekap.filter(r => r.status === 'Tepat Waktu').length;
    const terlambatCount = todayRekap.filter(r => r.status === 'Terlambat').length;

    const izinAlphaCount = izinList.filter(i => {
        return i.status === 'Approved' && i.start <= todayStr && i.end >= todayStr;
    }).length;

    const elTotal = document.getElementById('stat-total-karyawan');
    const elTepat = document.getElementById('stat-tepat-waktu');
    const elTerlambat = document.getElementById('stat-terlambat');
    const elIzin = document.getElementById('stat-izin-alpha');

    if (elTotal) elTotal.innerText = `${totalKaryawan} Orang`;
    if (elTepat) elTepat.innerText = `${tepatWaktuCount} Orang`;
    if (elTerlambat) elTerlambat.innerText = `${terlambatCount} Orang`;
    if (elIzin) elIzin.innerText = `${izinAlphaCount} Orang`;
}
'''

with open(f"{output_dir}/js/dashboard.js", "w", encoding="utf-8") as f:
    f.write(dashboard_js)

print("✅ js/rekap.js created")
print("✅ js/dashboard.js created")
