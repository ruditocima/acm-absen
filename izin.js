
# ============================================================
# FILE 9: izin.js — Izin Management
# ============================================================
izin_js = r'''// ============================================================
// IZIN: Submit, Render, Update Status
// ============================================================

async function submitMobileIzin() {
    const session = Store.get('activeEmployeeSession');
    if (session.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }

    const btn = document.querySelector('#m-tab-izin button[onclick="submitMobileIzin()"]');
    setButtonLoading(btn, 'Mengajukan...');

    const jenis = document.getElementById('m-izin-jenis').value;
    const start = document.getElementById('m-izin-start').value;
    const end = document.getElementById('m-izin-end').value;
    const desc = document.getElementById('m-izin-desc').value.trim();

    if (!start || !end || !desc) {
        showToast('Harap lengkapi semua data pengajuan!', 'error');
        resetButtonLoading(btn);
        return;
    }

    // Validasi tanggal
    if (new Date(start) > new Date(end)) {
        showToast('Tanggal selesai tidak boleh sebelum tanggal mulai!', 'error');
        resetButtonLoading(btn);
        return;
    }

    const atasanName = session.atasan || 'Master Admin';
    const newIzin = {
        id: Date.now(),
        name: session.name,
        jenis: jenis,
        start: start,
        end: end,
        desc: desc,
        atasan: atasanName,
        status: 'Pending'
    };

    const izinList = Store.get('izinList');
    izinList.push(newIzin);
    Store.set('izinList', [...izinList]);

    await supabaseClient.from('izin_list').insert([newIzin]);
    renderAdminIzin();
    renderMobileMyHistory();
    updateDashboardStats();
    showToast('Permohonan izin berhasil diajukan.', 'success');

    document.getElementById('m-izin-start').value = '';
    document.getElementById('m-izin-end').value = '';
    document.getElementById('m-izin-desc').value = '';
    resetButtonLoading(btn);
}

async function updateIzinStatus(id, newStatus) {
    const izinList = Store.get('izinList');
    const izin = izinList.find(i => i.id === id);
    if (izin) {
        izin.status = newStatus;
        await supabaseClient.from('izin_list').update({ status: newStatus }).eq('id', id);
        Store.set('izinList', [...izinList]);
        renderAdminIzin();
        renderMobileMyHistory();
        updateDashboardStats();
        showToast(`Status izin diubah menjadi ${newStatus}.`, 'success');
    }
}

function renderAdminIzin() {
    const container = document.getElementById('admin-izin-container');
    const badge = document.getElementById('sidebar-izin-badge');
    const counterBadge = document.getElementById('tab-izin-counter-badge');
    if (!container) return;

    const session = Store.get('activeEmployeeSession');
    const roleName = session.role;
    const izinList = Store.get('izinList');
    let visibleIzins = [];

    if (roleName === 'Master Admin') {
        visibleIzins = izinList;
    } else if (roleName === 'Supervisor Field') {
        visibleIzins = izinList.filter(i => i.atasan === session.name);
    } else if (roleName === 'Admin') {
        visibleIzins = izinList;
    } else {
        visibleIzins = [];
    }

    const pendingIzins = visibleIzins.filter(i => i.status === 'Pending');

    if (badge) {
        if (pendingIzins.length > 0) {
            badge.innerText = pendingIzins.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    if (counterBadge) {
        if (pendingIzins.length > 0) {
            counterBadge.innerText = `${pendingIzins.length} Pengajuan Pending`;
            counterBadge.classList.remove('hidden');
        } else {
            counterBadge.classList.add('hidden');
        }
    }

    if (visibleIzins.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-4 text-xs">Belum ada pengajuan izin.</p>';
        return;
    }

    container.innerHTML = visibleIzins.map((i) => {
        let actionButtons = '';
        if ((roleName === 'Master Admin' || roleName === 'Supervisor Field') && i.status === 'Pending') {
            actionButtons = `
                <div class="flex items-center gap-2">
                    <button onclick="updateIzinStatus(${i.id}, 'Approved')" class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shadow hover:opacity-90">Setujui</button>
                    <button onclick="updateIzinStatus(${i.id}, 'Rejected')" class="px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs shadow hover:opacity-90">Tolak</button>
                </div>
            `;
        }

        return `
        <div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
            <div>
                <div class="flex items-center gap-2">
                    <h5 class="text-xs font-bold text-white">${escapeHtml(i.name)}</h5>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : i.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}">${escapeHtml(i.status)}</span>
                </div>
                <p class="text-xs text-gold-400 font-semibold mt-0.5">Jenis: ${escapeHtml(i.jenis)}</p>
                <p class="text-[11px] text-slate-300">Tanggal: ${escapeHtml(i.start)} s/d ${escapeHtml(i.end)}</p>
                <p class="text-[11px] text-slate-400 mt-1">Alasan: "${escapeHtml(i.desc)}"</p>
            </div>
            ${actionButtons}
        </div>
        `;
    }).join('');
}
'''

with open('/mnt/agents/output/izin.js', 'w', encoding='utf-8') as f:
    f.write(izin_js)

print("✅ izin.js created")
