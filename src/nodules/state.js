export let roles = [
    { id: 'ROL-01', name: 'Master Admin', access: 'Semua Akses Modul' },
    { id: 'ROL-02', name: 'Supervisor Field', access: 'Dashboard, Rekap, Izin' },
    { id: 'ROL-03', name: 'Karyawan / Field', access: 'Absensi, Riwayat Saya' }
];

export let employees = [
    { id: 'USR-001', name: 'Rudi Batubara', role: 'Karyawan / Field', atasan: '-', password: '••••••••', deviceId: 'DEV-9982 (Locked)' },
    { id: 'USR-002', name: 'Budi Santoso', role: 'Supervisor Field', atasan: 'Rudi Batubara', password: '••••••••', deviceId: 'DEV-1022 (Locked)' },
    { id: 'USR-003', name: 'Siti Aminah', role: 'Karyawan / Field', atasan: 'Budi Santoso', password: '••••••••', deviceId: 'DEV-4411 (Locked)' }
];

export let basecamps = [
    { id: 1, name: 'Basecamp Pekanbaru Pusat', lat: 0.434291, lng: 101.466385, radius: 15000 },
    { id: 2, name: 'Palembang Field', lat: -2.990934, lng: 104.756554, radius: 10000 },
    { id: 3, name: 'Padang Branch', lat: -0.947083, lng: 100.417181, radius: 12000 }
];

export let rekapList = [
    { date: '2026-08-08', name: 'Rudi Batubara', basecamp: 'Pekanbaru Pusat', time: '07:45 WIB', status: '<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">Tepat Waktu</span>', late: '-' },
    { date: '2026-08-09', name: 'Budi Santoso', basecamp: 'Palembang Field', time: '08:25 WIB', status: '<span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">Terlambat</span>', late: '25 Menit' },
    { date: '2026-08-09', name: 'Siti Aminah', basecamp: 'Padang Branch', time: '08:40 WIB', status: '<span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">Terlambat</span>', late: '40 Menit' }
];

export function setRekapList(newList) {
    rekapList = newList;
}