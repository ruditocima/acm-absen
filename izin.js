async function submitMobileIzin() {
    var session = Store.get('activeEmployeeSession');
    if (session.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }

    var btn = document.querySelector('#m-tab-izin button[onclick="submitMobileIzin()"]');
    setButtonLoading(btn, 'Mengajukan...');

    var jenis = document.getElementById('m-izin-jenis').value;
    var start = document.getElementById('m-izin-start').value;
    var end = document.getElementById('m-izin-end').value;
    var desc = document.getElementById('m-izin-desc').value.trim();

    if (!start || !end || !desc) {
        showToast('Harap lengkapi semua data pengajuan!', 'error');
        resetButtonLoading(btn);
        return;
    }

    if (new Date(start) > new Date(end)) {
        showToast('Tanggal selesai tidak boleh sebelum tanggal mulai!', 'error');
        resetButtonLoading(btn);
        return;
    }

    var atasanName = session.atasan || 'Master Admin';
    var newIzin = {
        id: Date.now(),
        name: session.name,
        jenis: jenis,
        start: start,
        end: end,
        desc: desc,
        atasan: atasanName,
        status: 'Pending'
    };

    var izinList = Store.get('izinList');
    izinList.push(newIzin);
    Store.set('izinList', izinList.slice());

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

// Helper untuk menghasilkan rentang tanggal (Array of Dates)
// Helper untuk menghasilkan rentang tanggal (Array of Dates)
function getDatesInRange(startDate, endDate) {
    var dates = [];
    var curr = new Date(startDate);
    var last = new Date(endDate);
    while (curr <= last) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

async function updateIzinStatus(id, newStatus) {
    var izinList = Store.get('izinList') || [];
    var izin = izinList.find(function(i) { return i.id === id; });
    if (!izin) {
        showToast('Data izin tidak ditemukan!', 'error');
        return;
    }

    // 1. Update status di local store dan langsung render UI agar instan
    izin.status = newStatus;
    Store.set('izinList', izinList.slice());

    renderAdminIzin();
    renderMobileMyHistory();
    if (typeof updateDashboardStats === 'function') {
        updateDashboardStats();
    }

    // 2. Update status izin di Supabase
    var updateIzinRes = await supabaseClient.from('izin_list').update({ status: newStatus }).eq('id', id);
    if (updateIzinRes.error) {
        var errMessage = updateIzinRes.error.message || JSON.stringify(updateIzinRes.error);
        console.error('Supabase Error (izin_list):', errMessage);
        showToast('Gagal update izin ke Supabase: ' + errMessage, 'error');
        return;
    }
    
    // 3. JIKA STATUS DISETUJUI (APPROVED), CATAT OTOMATIS KE REKAP ABSENSI & SUPABASE
    if (newStatus === 'Approved') {
        var dates = getDatesInRange(izin.start, izin.end);
        var employeesList = Store.get('employeesList') || [];
        var emp = employeesList.find(function(e) { return e.name === izin.name; });
        var basecampName = emp ? (emp.basecamp || '-') : '-';

        var rekapList = Store.get('rekapList') || [];

        for (var i = 0; i < dates.length; i++) {
            var dateStr = dates[i];

            var rekapData = {
                date: dateStr,
                name: izin.name,
                basecamp: basecampName,
                time: '-',
                status: izin.jenis, // Contoh: Cuti Tahunan, Sakit, dll
                late: '-',
                selfie_url: null
            };

            // Cek apakah data rekap untuk tanggal & nama tersebut sudah ada di Supabase
            var checkRes = await supabaseClient.from('rekap_list')
                .select('id, date, name')
                .eq('date', dateStr)
                .eq('name', izin.name);

            if (checkRes.error) {
                var checkErr = checkRes.error.message || JSON.stringify(checkRes.error);
                console.error('Supabase Error (Check rekap_list):', checkErr);
                showToast('Gagal mengecek rekap database: ' + checkErr, 'error');
                return;
            }

            if (checkRes.data && checkRes.data.length > 0) {
                // Jika sudah ada, ambil ID barisnya untuk melakukan Update secara aman
                var existingRecordId = checkRes.data[0].id;
                var updateQuery = supabaseClient.from('rekap_list')
                    .update({ status: izin.jenis, time: '-', late: '-', basecamp: basecampName });

                if (existingRecordId) {
                    updateQuery = updateQuery.eq('id', existingRecordId);
                } else {
                    updateQuery = updateQuery.eq('date', dateStr).eq('name', izin.name);
                }

                var updateRekapRes = await updateQuery;

                if (updateRekapRes.error) {
                    var upErr = updateRekapRes.error.message || JSON.stringify(updateRekapRes.error);
                    console.error('Supabase Error (Update rekap_list):', upErr);
                    showToast('Gagal update rekap ke database: ' + upErr, 'error');
                    return;
                }
            } else {
                // Jika belum ada, lakukan Insert data baru
                var insertRekapRes = await supabaseClient.from('rekap_list').insert([rekapData]);
                
                if (insertRekapRes.error) {
                    var insErr = insertRekapRes.error.message || JSON.stringify(insertRekapRes.error);
                    console.error('Supabase Error (Insert rekap_list):', insErr);
                    showToast('Gagal menyimpan rekap ke database: ' + insErr, 'error');
                    return;
                }
            }

            // Sinkronisasi data ke local rekapList array
            var existingIndex = rekapList.findIndex(function(r) {
                return r.date === dateStr && r.name === izin.name;
            });

            if (existingIndex !== -1) {
                rekapList[existingIndex].status = izin.jenis;
                rekapList[existingIndex].time = '-';
                rekapList[existingIndex].late = '-';
                rekapList[existingIndex].basecamp = basecampName;
            } else {
                rekapList.push(rekapData);
            }
        }

        Store.set('rekapList', rekapList.slice());
        
        // Panggil fungsi render ulang rekap jika ada
        if (typeof renderRekap === 'function') {
            renderRekap();
        }
    }
    
    showToast('Status izin diubah menjadi ' + newStatus + (newStatus === 'Approved' ? ' & Rekap Absensi berhasil disimpan.' : '.'), 'success');
}

function renderAdminIzin() {
    var container = document.getElementById('admin-izin-container');
    var badge = document.getElementById('sidebar-izin-badge');
    var counterBadge = document.getElementById('tab-izin-counter-badge');
    if (!container) return;

    var session = Store.get('activeEmployeeSession');
    var roleName = session.role;
    var izinList = Store.get('izinList');
    var visibleIzins = [];

    if (roleName === 'Master Admin') {
        visibleIzins = izinList;
    } else if (roleName === 'Supervisor Field') {
        visibleIzins = izinList.filter(function(i) { return i.atasan === session.name; });
    } else if (roleName === 'Admin') {
        visibleIzins = izinList;
    } else {
        visibleIzins = [];
    }

    var pendingIzins = visibleIzins.filter(function(i) { return i.status === 'Pending'; });

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
            counterBadge.innerText = pendingIzins.length + ' Pengajuan Pending';
            counterBadge.classList.remove('hidden');
        } else {
            counterBadge.classList.add('hidden');
        }
    }

    if (visibleIzins.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-4 text-xs">Belum ada pengajuan izin.</p>';
        return;
    }

    container.innerHTML = visibleIzins.map(function(i) {
        var actionButtons = '';
        if ((roleName === 'Master Admin' || roleName === 'Supervisor Field') && i.status === 'Pending') {
            actionButtons = '<div class="flex items-center gap-2">' +
                '<button onclick="updateIzinStatus(' + i.id + ', \'Approved\')" class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shadow hover:opacity-90">Setujui</button>' +
                '<button onclick="updateIzinStatus(' + i.id + ', \'Rejected\')" class="px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs shadow hover:opacity-90">Tolak</button>' +
                '</div>';
        }

        return '<div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">' +
            '<div>' +
            '<div class="flex items-center gap-2"><h5 class="text-xs font-bold text-white">' + escapeHtml(i.name) + '</h5>' +
            '<span class="px-2 py-0.5 rounded text-[9px] font-bold ' + (i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : i.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400') + '">' + escapeHtml(i.status) + '</span></div>' +
            '<p class="text-xs text-gold-400 font-semibold mt-0.5">Jenis: ' + escapeHtml(i.jenis) + '</p>' +
            '<p class="text-[11px] text-slate-300">Tanggal: ' + escapeHtml(i.start) + ' s/d ' + escapeHtml(i.end) + '</p>' +
            '<p class="text-[11px] text-slate-400 mt-1">Alasan: "' + escapeHtml(i.desc) + '"</p>' +
            '</div>' + actionButtons + '</div>';
    }).join('');
}
