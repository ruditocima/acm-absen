async function submitMobileIzin() {
    if (activeEmployeeSession.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }
    const jenis = document.getElementById('m-izin-jenis').value;
    const start = document.getElementById('m-izin-start').value;
    const end = document.getElementById('m-izin-end').value;
    const desc = document.getElementById('m-izin-desc').value.trim();
    if (!start || !end || !desc) {
        showToast('Harap lengkapi semua data pengajuan!', 'error');
        return;
    }
    const atasanName = activeEmployeeSession.atasan || 'Master Admin';
    const newIzin = {
        id: Date.now(),
        name: activeEmployeeSession.name,
        jenis: jenis,
        start: start,
        end: end,
        desc: desc,
        atasan: atasanName,
        status: 'Pending'
    };
    izinList.push(newIzin);
    await supabaseClient.from('izin_list').insert([newIzin]);
    renderAdminIzin();
    renderMobileMyHistory();
    updateDashboardStats();
    showToast('Permohonan izin berhasil diajukan ke menu Persetujuan Izin atasan.', 'success');
    document.getElementById('m-izin-start').value = '';
    document.getElementById('m-izin-end').value = '';
    document.getElementById('m-izin-desc').value = '';
}

function renderAdminIzin() {
    const container = document.getElementById('admin-izin-container');
    const badge = document.getElementById('sidebar-izin-badge');
    const counterBadge = document.getElementById('tab-izin-counter-badge');
    if (!container) return;
    const pendingIzins = izinList.filter(function(i) {
        return i.status === 'Pending' && (isMasterAdmin() || i.atasan === activeEmployeeSession.name);
    });
    if (badge) {
        if (pendingIzins.length > 0) { badge.innerText = pendingIzins.length; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    }
    if (counterBadge) {
        if (pendingIzins.length > 0) { counterBadge.innerText = pendingIzins.length + ' Pengajuan Pending'; counterBadge.classList.remove('hidden'); }
        else { counterBadge.classList.add('hidden'); }
    }
    if (izinList.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-4 text-xs">Belum ada pengajuan izin.</p>';
        return;
    }
    container.innerHTML = izinList.map(function(i, index) {
        const statusClass = i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : i.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400';
        const buttons = i.status === 'Pending'
            ? `<button onclick="updateIzinStatus(${i.id}, 'Approved')" class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shadow hover:opacity-90">Setujui</button><button onclick="updateIzinStatus(${i.id}, 'Rejected')" class="px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs shadow hover:opacity-90">Tolak</button>`
            : '';
        return `
            <div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <div>
                    <div class="flex items-center gap-2">
                        <h5 class="text-xs font-bold text-white">${i.name}</h5>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${statusClass}">${i.status}</span>
                    </div>
                    <p class="text-xs text-gold-400 font-semibold mt-0.5">Jenis: ${i.jenis}</p>
                    <p class="text-[11px] text-slate-300">Tanggal: ${i.start} s/d ${i.end}</p>
                    <p class="text-[11px] text-slate-400 mt-1">Alasan: "${i.desc}"</p>
                </div>
                <div class="flex items-center gap-2">${buttons}</div>
            </div>`;
    }).join('');
}

async function updateIzinStatus(id, newStatus) {
    const izin = izinList.find(function(i) { return i.id === id; });
    if (izin) {
        izin.status = newStatus;
        await supabaseClient.from('izin_list').update({ status: newStatus }).eq('id', id);
        renderAdminIzin();
        renderMobileMyHistory();
        updateDashboardStats();
        showToast('Status izin berhasil diubah menjadi ' + newStatus + '.', 'success');
    }
}