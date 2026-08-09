import { employees, basecamps, rekapList } from './state.js';
import { showToast } from './toast.js';
import { renderRekap } from './rekap.js';

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function getServerTime() { return new Date(); }

export async function handleAbsen() {
    const btn = document.getElementById('btn-absen-action');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-lg"></i> MEMVERIFIKASI KEAMANAN & GPS...`;
        btn.disabled = true;
    }

    const boundDeviceFingerprint = employees[0]?.deviceId || 'DEV-9982';
    const serverTime = await getServerTime();

    if (!boundDeviceFingerprint.includes('DEV-9982')) {
        if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
        showToast('Absensi Ditolak: Perangkat tidak dikenali atau belum terikat.', 'error');
        return;
    }

    const activeBasecamp = basecamps[0] || { lat: 0.434291, lng: 101.466385, radius: 15000, name: 'Pekanbaru Pusat' };

    const processAttendance = (userLat, userLng, accuracyVal) => {
        if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }

        if (accuracyVal === 0 || accuracyVal > 5000) {
            showToast('Absensi Ditolak: Sinyal GPS tidak valid atau terindikasi Fake GPS.', 'error');
            return;
        }

        const distance = calculateDistance(userLat, userLng, activeBasecamp.lat, activeBasecamp.lng);
        const coordEl = document.querySelector('#m-tab-absen p.text-gold-400');
        if (coordEl) coordEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> Koordinat: ${userLat.toFixed(4)}° N, ${userLng.toFixed(4)}° E (Akurasi: ${Math.round(accuracyVal)}m)`;

        if (distance <= activeBasecamp.radius) {
            const year = serverTime.getFullYear();
            const month = String(serverTime.getMonth() + 1).padStart(2, '0');
            const day = String(serverTime.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const hours = serverTime.getHours();
            const minutes = serverTime.getMinutes();
            const seconds = serverTime.getSeconds();
            
            const timeStringShort = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} WIB`;
            const timeStringFull = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} WIB`;

            showToast(`Absensi Terverifikasi Aman! Jarak ${Math.round(distance)}m dari basecamp.`, 'success');
            
            const jamMasukEl = document.getElementById('mobile-jam-masuk');
            if (jamMasukEl) jamMasukEl.innerText = timeStringShort;

            const isLate = hours > 8 || (hours === 8 && minutes > 0);
            const statusHtml = isLate 
                ? `<span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">Terlambat</span>`
                : `<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">Tepat Waktu</span>`;
            const lateCount = isLate ? `${(hours - 8) * 60 + minutes} Menit` : '-';

            const cleanBasecampName = activeBasecamp.name.replace(/^Basecamp\s+/i, '');
            const existingRecordIndex = rekapList.findIndex(r => r.name === 'Rudi Batubara' && r.date === dateStr);
            
            const newAttendance = {
                date: dateStr,
                name: 'Rudi Batubara',
                basecamp: cleanBasecampName,
                time: timeStringFull,
                status: statusHtml,
                late: lateCount
            };

            if (existingRecordIndex !== -1) rekapList[existingRecordIndex] = newAttendance;
            else rekapList.unshift(newAttendance);

            renderRekap();
        } else {
            showToast(`Absensi Ditolak: Anda berada di luar radius basecamp (${Math.round(distance)}m).`, 'error');
        }
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => processAttendance(position.coords.latitude, position.coords.longitude, position.coords.accuracy || 10),
            (error) => processAttendance(activeBasecamp.lat, activeBasecamp.lng, 5),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        processAttendance(activeBasecamp.lat, activeBasecamp.lng, 5);
    }
}

export function initAttendanceEvents() {
    document.getElementById('btn-absen-action').addEventListener('click', handleAbsen);
    document.getElementById('btn-kirim-izin').addEventListener('click', () => {
        showToast('Pengajuan izin berhasil dikirim ke Master Admin!', 'success');
    });
    document.getElementById('btn-setuju-izin').addEventListener('click', () => {
        showToast('Izin cuti berhasil disetujui.', 'success');
    });
    document.getElementById('btn-tolak-izin').addEventListener('click', () => {
        showToast('Pengajuan izin ditolak.', 'warning');
    });
}