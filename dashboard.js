// ============================================================
// DASHBOARD: Stats, Employee of the Month, History
// ============================================================

function updateDashboardStats() {
    const todayStr = getWIBDateString();
    const employees = Store.get('employees');
    const rekapList = Store.get('rekapList');
    const izinList = Store.get('izinList');

    const karyawanOperasional = employees.filter(e => e.position && e.position.toLowerCase() !== 'administrator');
    const totalKaryawan = karyawanOperasional.length;
    const todayRekap = rekapList.filter(r => r.date === todayStr);
    const tepatWaktuCount = todayRekap.filter(r => r.status === 'Tepat Waktu').length;
    const terlambatCount = todayRekap.filter(r => r.status === 'Terlambat').length;
    const izinAlphaCount = izinList.filter(i => i.status === 'Approved' && i.start <= todayStr && i.end >= todayStr).length;

    const elTotal = document.getElementById('stat-total-karyawan');
    const elTepat = document.getElementById('stat-tepat-waktu');
    const elTerlambat = document.getElementById('stat-terlambat');
    const elIzin = document.getElementById('stat-izin-alpha');

    if (elTotal) elTotal.innerText = `${totalKaryawan} Orang`;
    if (elTepat) elTepat.innerText = `${tepatWaktuCount} Orang`;
    if (elTerlambat) elTerlambat.innerText = `${terlambatCount} Orang`;
    if (elIzin) elIzin.innerText = `${izinAlphaCount} Orang`;
}

function renderMobileMyHistory() {
    const container = document.getElementById('mobile-my-history');
    if (!container) return;

    const session = Store.get('activeEmployeeSession');
    const rekapList = Store.get('rekapList');
    const izinList = Store.get('izinList');

    const myRekap = rekapList.filter(r => r.name === session.name);
    const myIzin = izinList.filter(i => i.name === session.name);
    let html = '';

    if (myRekap.length === 0 && myIzin.length === 0) {
        html = '<p class="text-slate-500 text-center py-2">Belum ada riwayat tercatat.</p>';
    } else {
        myRekap.slice().reverse().forEach(r => {
            html += `<div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2">
                <div>
                    <p class="text-xs font-bold text-white">${escapeHtml(r.date)}</p>
                    <p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-gold-400"></i> ${escapeHtml(r.basecamp)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs font-mono text-emerald-400">${formatRekapTime(r.time)} WIB</p>
                    <p class="text-[10px] ${r.status === 'Tepat Waktu' ? 'text-emerald-500' : 'text-amber-500'} font-semibold">${escapeHtml(r.status)}</p>
                </div>
            </div>`;
        });
        myIzin.slice().reverse().forEach(i => {
            html += `<div class="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center mb-2">
                <div>
                    <p class="text-xs font-bold text-white">Izin: ${escapeHtml(i.jenis)}</p>
                    <p class="text-[10px] text-slate-400">${escapeHtml(i.start)} s/d ${escapeHtml(i.end)}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${i.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${escapeHtml(i.status)}</span>
                </div>
            </div>`;
        });
    }
    container.innerHTML = html;
}

// ============================================================
// EMPLOYEE OF THE MONTH — RANKING SYSTEM
// ============================================================
function parseLateToMinutes(lateStr) {
    if (!lateStr || lateStr === '-' || lateStr === '') return 0;
    const parts = lateStr.split(':');
    if (parts.length !== 3) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h * 60 + m + s / 60;
}

function countIzinDaysInMonth(izinList, employeeName, year, month) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const empIzin = izinList.filter(i =>
        i.name === employeeName &&
        i.status === 'Approved' &&
        i.start && i.end &&
        new Date(i.start) <= monthEnd &&
        new Date(i.end) >= monthStart
    );
    let totalDays = 0;
    empIzin.forEach(i => {
        const s = new Date(i.start);
        const e = new Date(i.end);
        const actualStart = s > monthStart ? s : monthStart;
        const actualEnd = e < monthEnd ? e : monthEnd;
        const diffMs = actualEnd - actualStart;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        totalDays += Math.max(0, diffDays);
    });
    return totalDays;
}

function calculateEmployeeOfTheMonth(year, month) {
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    const monthlyRekap = Store.get('rekapList').filter(r => r.date >= startStr && r.date <= endStr);
    const employees = Store.get('employees');
    const izinList = Store.get('izinList');
    const results = [];

    for (const emp of employees) {
        if (emp.status !== 'Approved') continue;
        if (emp.position && emp.position.toLowerCase() === 'administrator') continue;

        const empRekap = monthlyRekap.filter(r => r.name === emp.name);
        const uniqueDays = new Set(empRekap.map(r => r.date)).size;
        const tepatWaktu = empRekap.filter(r => r.status === 'Tepat Waktu').length;

        let totalLateMinutes = 0;
        empRekap.forEach(r => { totalLateMinutes += parseLateToMinutes(r.late); });

        const izinDays = countIzinDaysInMonth(izinList, emp.name, year, month);
        const attendanceScore = Math.min((uniqueDays / CONFIG.ATTENDANCE.WORK_DAYS_PER_MONTH) * 35, 35);
        const punctualityScore = uniqueDays > 0 ? (tepatWaktu / uniqueDays) * 35 : 0;
        const latePenalty = Math.min(totalLateMinutes / 30, 20);
        const disciplineScore = Math.max(20 - latePenalty, 0);
        const perfectBonus = (uniqueDays >= CONFIG.ATTENDANCE.WORK_DAYS_PER_MONTH && totalLateMinutes === 0) ? 10 : 0;
        const alphaDays = Math.max(CONFIG.ATTENDANCE.WORK_DAYS_PER_MONTH - uniqueDays - izinDays, 0);
        const alphaPenalty = alphaDays * 3;
        const totalScore = attendanceScore + punctualityScore + disciplineScore + perfectBonus - alphaPenalty;

        results.push({
            rank: 0,
            name: emp.name,
            position: emp.position || '-',
            role: emp.role,
            uniqueDays,
            tepatWaktu,
            totalLateMinutes: Math.round(totalLateMinutes),
            izinDays,
            alphaDays,
            attendanceScore: +attendanceScore.toFixed(2),
            punctualityScore: +punctualityScore.toFixed(2),
            disciplineScore: +disciplineScore.toFixed(2),
            perfectBonus,
            alphaPenalty,
            totalScore: +Math.max(totalScore, 0).toFixed(2)
        });
    }

    results.sort((a, b) => b.totalScore - a.totalScore);
    results.forEach((r, i) => r.rank = i + 1);
    return results;
}

function renderEmployeeOfTheMonth() {
    const container = document.getElementById('eom-container');
    const now = new Date();
    const scores = calculateEmployeeOfTheMonth(now.getFullYear(), now.getMonth());

    if (!container) return;
    if (scores.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-4 text-xs">Belum ada data karyawan untuk dinilai.</p>';
        return;
    }

    const top5 = scores.slice(0, 5);
    const winner = top5[0];
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const currentMonthName = monthNames[now.getMonth()];

    let html = `
        <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-bold text-gold-400 uppercase tracking-wider">
                <i class="fa-solid fa-trophy"></i> Karyawan Terbaik — ${currentMonthName} ${now.getFullYear()}
            </h4>
            <span class="text-[10px] text-slate-500">Berdasarkan ${CONFIG.ATTENDANCE.WORK_DAYS_PER_MONTH} hari kerja</span>
        </div>
    `;

    if (winner) {
        html += `
        <div class="bg-gradient-to-r from-gold-500/10 to-transparent border border-gold-500/30 rounded-2xl p-4 mb-4 flex items-center gap-4">
            <div class="w-14 h-14 rounded-full gold-gradient flex items-center justify-center text-slate-950 text-2xl font-black shadow-lg shrink-0">
                <i class="fa-solid fa-crown"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <h5 class="text-sm font-bold text-white truncate">${escapeHtml(winner.name)}</h5>
                    <span class="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-[9px] font-bold border border-gold-500/30">#1</span>
                </div>
                <p class="text-[11px] text-slate-400">${escapeHtml(winner.position)} · ${escapeHtml(winner.role)}</p>
                <div class="flex gap-3 mt-1.5 text-[10px]">
                    <span class="text-emerald-400 font-semibold"><i class="fa-solid fa-check"></i> ${winner.uniqueDays} Hadir</span>
                    <span class="text-gold-400 font-semibold"><i class="fa-solid fa-clock"></i> ${winner.tepatWaktu} Tepat Waktu</span>
                    <span class="text-rose-400 font-semibold"><i class="fa-solid fa-xmark"></i> ${winner.alphaDays} Alpha</span>
                </div>
            </div>
            <div class="text-right shrink-0">
                <span class="text-2xl font-black text-gold-400">${winner.totalScore}</span>
                <p class="text-[9px] text-slate-500 uppercase">Skor</p>
            </div>
        </div>
        `;
    }

    html += `<div class="space-y-2">`;
    top5.forEach((s, idx) => {
        if (idx === 0) return;
        const medalColor = idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500';
        const barWidth = Math.min((s.totalScore / 100) * 100, 100);
        html += `
        <div class="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <span class="w-5 text-center font-black ${medalColor} text-sm">${s.rank}</span>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-white truncate">${escapeHtml(s.name)}</p>
                <div class="w-full bg-slate-800 rounded-full h-1.5 mt-1.5">
                    <div class="bg-gold-500 h-1.5 rounded-full transition-all" style="width: ${barWidth}%"></div>
                </div>
            </div>
            <span class="text-xs font-bold text-gold-400 shrink-0">${s.totalScore}</span>
        </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

function renderMobileEOM() {
    const container = document.getElementById('mobile-eom-section');
    if (!container) return;

    const now = new Date();
    const scores = calculateEmployeeOfTheMonth(now.getFullYear(), now.getMonth());

    if (scores.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    const winner = scores[0];
    const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

    container.innerHTML = `
        <div class="glass-card p-4 rounded-2xl border border-gold-500/20 mb-4">
            <div class="flex items-center gap-2 mb-2">
                <i class="fa-solid fa-trophy text-gold-400"></i>
                <span class="text-[10px] font-bold text-gold-400 uppercase">Terbaik ${monthNames[now.getMonth()]} ${now.getFullYear()}</span>
            </div>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-slate-950 font-bold text-sm">🏆</div>
                <div class="flex-1">
                    <p class="text-sm font-bold text-white">${escapeHtml(winner.name)}</p>
                    <p class="text-[10px] text-slate-400">${escapeHtml(winner.position)}</p>
                </div>
                <div class="text-right">
                    <p class="text-lg font-black text-gold-400">${winner.totalScore}</p>
                    <p class="text-[9px] text-slate-500">skor</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-3 text-center">
                <div class="bg-slate-950/50 rounded-lg py-1.5">
                    <p class="text-emerald-400 font-bold text-xs">${winner.uniqueDays}</p>
                    <p class="text-[9px] text-slate-500">Hadir</p>
                </div>
                <div class="bg-slate-950/50 rounded-lg py-1.5">
                    <p class="text-gold-400 font-bold text-xs">${winner.tepatWaktu}</p>
                    <p class="text-[9px] text-slate-500">Tepat</p>
                </div>
                <div class="bg-slate-950/50 rounded-lg py-1.5">
                    <p class="text-rose-400 font-bold text-xs">${winner.alphaDays}</p>
                    <p class="text-[9px] text-slate-500">Alpha</p>
                </div>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}