import { getMapInstance, updateMapData, initMap } from './basecamp.js';

export function switchMode(mode) {
    const viewMobile = document.getElementById('view-mobile');
    const viewDesktop = document.getElementById('view-desktop');
    const btnMobile = document.getElementById('btn-mobile');
    const btnDesktop = document.getElementById('btn-desktop');

    if (mode === 'mobile') {
        viewMobile.classList.remove('hidden');
        viewDesktop.classList.add('hidden');
        btnMobile.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2";
        btnDesktop.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2";
    } else {
        viewMobile.classList.add('hidden');
        viewDesktop.classList.remove('hidden');
        btnDesktop.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-gold-500 text-slate-950 transition-all shadow-md flex items-center gap-2";
        btnMobile.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2";
        
        const mapInstance = getMapInstance();
        if (!document.getElementById('d-tab-basecamp').classList.contains('hidden') && mapInstance) {
            setTimeout(() => { mapInstance.invalidateSize(); }, 200);
        }
    }
}

export function switchDesktopTab(tab) {
    const tabs = ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin'];
    tabs.forEach(t => {
        document.getElementById(`d-tab-${t}`).classList.add('hidden');
        document.getElementById(`d-nav-${t}`).className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white";
    });
    document.getElementById(`d-tab-${tab}`).classList.remove('hidden');
    document.getElementById(`d-nav-${tab}`).className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20";
    
    const titles = {
        'dashboard': 'Dashboard & Statistik',
        'rekap': 'Rekapitulasi Absensi & Keterlambatan',
        'role': 'Manajemen Data Role Akses',
        'karyawan': 'Manajemen Data Karyawan',
        'basecamp': 'Pengaturan Basecamp & Radius GPS',
        'izin': 'Persetujuan Pengajuan Izin'
    };
    document.getElementById('desktop-title').innerText = titles[tab];

    if (tab === 'basecamp') {
        setTimeout(() => {
            const mapInstance = getMapInstance();
            if (!mapInstance) {
                initMap();
                updateMapData();
            } else {
                mapInstance.invalidateSize();
                updateMapData();
            }
        }, 200);
    }
}

export function switchMobileTab(tab) {
    ['absen', 'izin', 'riwayat'].forEach(t => {
        document.getElementById(`m-tab-${t}`).classList.add('hidden');
        document.getElementById(`m-nav-${t}`).className = "text-slate-400 hover:text-white flex flex-col items-center text-xs space-y-1";
    });
    document.getElementById(`m-tab-${tab}`).classList.remove('hidden');
    document.getElementById(`m-nav-${tab}`).className = "text-gold-400 flex flex-col items-center text-xs space-y-1";
}

export function initNavigationEvents() {
    document.getElementById('btn-mobile').addEventListener('click', () => switchMode('mobile'));
    document.getElementById('btn-desktop').addEventListener('click', () => switchMode('desktop'));

    const desktopTabs = ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin'];
    desktopTabs.forEach(t => {
        const btn = document.getElementById(`d-nav-${t}`);
        if (btn) btn.addEventListener('click', () => switchDesktopTab(t));
    });

    const mobileTabs = ['absen', 'izin', 'riwayat'];
    mobileTabs.forEach(t => {
        const btn = document.getElementById(`m-nav-${t}`);
        if (btn) btn.addEventListener('click', () => switchMobileTab(t));
    });

    setInterval(() => {
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        const clockEl = document.getElementById('live-clock');
        if(clockEl) clockEl.innerText = timeString;
    }, 1000);
}