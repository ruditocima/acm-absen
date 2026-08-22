function updateDashboardStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    const totalKaryawan = employees.length;
    const todayRekap = rekapList.filter(function(r) { return r.date === todayStr; });
    const tepatWaktuCount = todayRekap.filter(function(r) { return r.status === 'Tepat Waktu'; }).length;
    const terlambatCount = todayRekap.filter(function(r) { return r.status === 'Terlambat'; }).length;
    const izinAlphaCount = izinList.filter(function(i) {
        return i.status === 'Approved' && i.start <= todayStr && i.end >= todayStr;
    }).length;
    const elTotal = document.getElementById('stat-total-karyawan');
    const elTepat = document.getElementById('stat-tepat-waktu');
    const elTerlambat = document.getElementById('stat-terlambat');
    const elIzin = document.getElementById('stat-izin-alpha');
    if (elTotal) elTotal.innerText = totalKaryawan + ' Orang';
    if (elTepat) elTepat.innerText = tepatWaktuCount + ' Orang';
    if (elTerlambat) elTerlambat.innerText = terlambatCount + ' Orang';
    if (elIzin) elIzin.innerText = izinAlphaCount + ' Orang';
}