// ============================================================
// KaryaOne ACM - Attendance Module (Refactored)
// Fitur: Absen Masuk + Pulang, Storage Upload, Duplikat Check
// ============================================================

// ─── State lokal modul ───
let _pendingAbsenData = null;
let _mediaStream = null;
let _capturedBlob = null;
let _checkOutMode = false;
let _checkOutRecordId = null;

// ─── Konfigurasi (di-load dari DB, fallback hardcoded) ───
let ATTENDANCE_CONFIG = {
    openTime: '07:45:00',
    maxTime: '09:40:00',
    minOutTime: '16:00:00'
};

// Load config dari DB saat init
async function loadAttendanceConfig() {
    try {
        const settings = await DB.settings.getAll();
        if (settings.absen_open) ATTENDANCE_CONFIG.openTime = settings.absen_open;
        if (settings.absen_max) ATTENDANCE_CONFIG.maxTime = settings.absen_max;
        if (settings.absen_min_out) ATTENDANCE_CONFIG.minOutTime = settings.absen_min_out;
    } catch (e) {
        console.warn('Gagal load config absen, pakai default:', e);
    }
}

// ─── Helper: Parse time ke detik ───
function timeToSeconds(timeStr) {
    const [h, m, s = 0] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

// ─── Helper: Format detik ke HH:MM:SS ───
function secondsToTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── MAIN: Handle Absen (Masuk atau Pulang) ───
async function handleAbsen() {
    if (activeEmployeeSession.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }

    AppUtils.setLoading('btn-absen-main', true);

    try {
        // 1. Cek apakah sudah absen hari ini
        const todayRecord = await DB.attendance.getTodayByName(activeEmployeeSession.name);

        if (todayRecord) {
            if (todayRecord.check_out_time) {
                showToast('Anda sudah absen masuk & pulang hari ini.', 'warning');
                AppUtils.setLoading('btn-absen-main', false);
                return;
            }
            // Sudah absen masuk, mode pulang
            _checkOutMode = true;
            _checkOutRecordId = todayRecord.id;
            const nowSec = new Date().getHours() * 3600 + new Date().getMinutes() * 60 + new Date().getSeconds();
            const minOutSec = timeToSeconds(ATTENDANCE_CONFIG.minOutTime);

            if (nowSec < minOutSec) {
                showToast(`Absen pulang dibuka mulai pukul ${ATTENDANCE_CONFIG.minOutTime} WIB.`, 'warning');
                AppUtils.setLoading('btn-absen-main', false);
                return;
            }

            showConfirm('Absen Pulang', `Anda masuk pukul ${todayRecord.time}. Konfirmasi absen pulang sekarang?`, () => {
                openSelfieModal(true);
            }, false);
            AppUtils.setLoading('btn-absen-main', false);
            return;
        }

        // 2. Mode absen masuk - cek waktu
        const now = new Date();
        const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const openSec = timeToSeconds(ATTENDANCE_CONFIG.openTime);

        if (currentSec < openSec) {
            showToast(`Absensi belum dibuka. Absen mulai pukul ${ATTENDANCE_CONFIG.openTime} WIB.`, 'warning');
            AppUtils.setLoading('btn-absen-main', false);
            return;
        }

        // 3. Deteksi GPS
        if (!navigator.geolocation) {
            showToast('Browser tidak mendukung GPS.', 'error');
            AppUtils.setLoading('btn-absen-main', false);
            return;
        }

        showToast('Mendeteksi lokasi GPS...', 'info');
        navigator.geolocation.getCurrentPosition(
            (position) => processGPSAndOpenSelfie(position),
            (err) => {
                showToast('Gagal mendeteksi GPS. Aktifkan izin lokasi.', 'error');
                AppUtils.setLoading('btn-absen-main', false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    } catch (err) {
        console.error('handleAbsen error:', err);
        showToast('Terjadi kesalahan sistem.', 'error');
        AppUtils.setLoading('btn-absen-main', false);
    }
}

function processGPSAndOpenSelfie(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    // Update UI koordinat
    const coordEl = document.getElementById('mobile-gps-coords');
    if (coordEl) coordEl.innerText = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;

    // Cek basecamp
    let validBasecamp = null;
    for (const bc of basecamps) {
        const dist = calculateDistance(userLat, userLng, parseFloat(bc.lat), parseFloat(bc.lng));
        if (dist <= parseFloat(bc.radius)) {
            validBasecamp = bc;
            break;
        }
    }

    _pendingAbsenData = {
        date: new Date().toISOString().split('T')[0],
        name: activeEmployeeSession.name,
        basecamp: validBasecamp ? validBasecamp.name : 'Dinas Luar / Lapangan (Terverifikasi GPS)',
        lat: userLat,
        lng: userLng
    };

    _checkOutMode = false;
    openSelfieModal(false);
    AppUtils.setLoading('btn-absen-main', false);
}

// ─── Selfie Modal ───
function openSelfieModal(isCheckOut) {
    const modal = document.getElementById('selfie-modal');
    const title = document.getElementById('selfie-modal-title');
    const video = document.getElementById('selfie-video');
    const canvas = document.getElementById('selfie-canvas');
    const preview = document.getElementById('selfie-preview');

    modal.classList.remove('hidden');
    video.classList.remove('hidden');
    canvas.classList.add('hidden');
    preview.classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');

    title.innerText = isCheckOut ? 'Verifikasi Wajah (Absen Pulang)' : 'Verifikasi Wajah (Absen Masuk)';

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then((stream) => {
            _mediaStream = stream;
            video.srcObject = stream;
        })
        .catch((err) => {
            showToast('Gagal akses kamera: ' + err.message, 'error');
        });
}

function captureSelfie() {
    const video = document.getElementById('selfie-video');
    const canvas = document.getElementById('selfie-canvas');
    const preview = document.getElementById('selfie-preview');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    preview.src = dataUrl;

    video.classList.add('hidden');
    preview.classList.remove('hidden');
    document.getElementById('btn-capture').classList.add('hidden');
    document.getElementById('btn-retake').classList.remove('hidden');
    document.getElementById('btn-submit-absen').classList.remove('hidden');

    canvas.toBlob((blob) => { _capturedBlob = blob; }, 'image/jpeg', 0.7);
}

function retakeSelfie() {
    const video = document.getElementById('selfie-video');
    const preview = document.getElementById('selfie-preview');
    video.classList.remove('hidden');
    preview.classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');
    _capturedBlob = null;
}

function closeSelfieModal() {
    if (_mediaStream) {
        _mediaStream.getTracks().forEach(t => t.stop());
        _mediaStream = null;
    }
    document.getElementById('selfie-modal').classList.add('hidden');
    _capturedBlob = null;
    _pendingAbsenData = null;
    _checkOutMode = false;
    _checkOutRecordId = null;
}

// ─── Submit Absen (Masuk atau Pulang) ───
async function submitAbsenWithSelfie() {
    if (!_capturedBlob) {
        showToast('Ambil foto selfie terlebih dahulu.', 'warning');
        return;
    }

    AppUtils.setLoading('btn-submit-absen', true);

    try {
        const now = new Date();
        const timeString = AppUtils.formatTime(now);
        const fileName = AppUtils.generateSelfieFileName(_pendingAbsenData.date, activeEmployeeSession.id);

        // 1. Upload selfie ke Storage
        await DB.storage.uploadSelfie(_capturedBlob, fileName);
        const selfieUrl = await DB.storage.getPublicUrl(fileName);

        if (_checkOutMode && _checkOutRecordId) {
            // ─── ABSEN PULANG ───
            const record = await DB.attendance.getTodayByName(activeEmployeeSession.name);
            const workDuration = AppUtils.calcWorkDuration(record.time, timeString);

            await DB.attendance.checkOut(_checkOutRecordId, {
                check_out_time: timeString,
                work_duration: workDuration,
                check_out_selfie_url: selfieUrl
            });

            showToast(`Absen pulang berhasil! Durasi: ${workDuration}`, 'success');

            const jamPulangEl = document.getElementById('mobile-jam-pulang');
            if (jamPulangEl) jamPulangEl.innerText = timeString + ' WIB';
            const durasiEl = document.getElementById('mobile-work-duration');
            if (durasiEl) durasiEl.innerText = workDuration;

        } else {
            // ─── ABSEN MASUK ───
            const lateInfo = AppUtils.calcLateStatus(timeString, ATTENDANCE_CONFIG.maxTime);

            const newRekap = {
                date: _pendingAbsenData.date,
                name: _pendingAbsenData.name,
                basecamp: _pendingAbsenData.basecamp,
                time: timeString,
                status: lateInfo.status,
                late: lateInfo.late,
                selfie_url: selfieUrl,
                check_out_time: null,
                work_duration: null,
                check_out_selfie_url: null
            };

            await DB.attendance.checkIn(newRekap);
            showToast(`Absen masuk berhasil! Jam: ${timeString} WIB`, 'success');

            const jamMasukEl = document.getElementById('mobile-jam-masuk');
            if (jamMasukEl) jamMasukEl.innerText = timeString + ' WIB';
        }

        // Refresh data
        await refreshAttendanceData();
        closeSelfieModal();

    } catch (err) {
        console.error('Submit absen error:', err);
        showToast('Gagal menyimpan absensi: ' + (err.message || 'Unknown error'), 'error');
    } finally {
        AppUtils.setLoading('btn-submit-absen', false);
    }
}

// ─── Refresh data setelah absen ───
async function refreshAttendanceData() {
    try {
        rekapList = await DB.attendance.getAll();
        renderRekap();
        renderMobileMyHistory();
        updateDashboardStats();
    } catch (e) {
        console.error('Refresh data error:', e);
    }
}

// ─── Update status card di mobile ───
async function updateMobileAttendanceCard() {
    if (activeEmployeeSession.name === 'Tamu') return;

    try {
        const todayRecord = await DB.attendance.getTodayByName(activeEmployeeSession.name);
        const jamMasukEl = document.getElementById('mobile-jam-masuk');
        const jamPulangEl = document.getElementById('mobile-jam-pulang');
        const durasiEl = document.getElementById('mobile-work-duration');
        const statusEl = document.getElementById('mobile-absen-status');

        if (todayRecord) {
            if (jamMasukEl) jamMasukEl.innerText = todayRecord.time + ' WIB';
            if (statusEl) {
                statusEl.innerText = todayRecord.status;
                statusEl.className = todayRecord.status === 'Tepat Waktu' 
                    ? 'text-emerald-400 font-bold' 
                    : 'text-amber-400 font-bold';
            }
            if (todayRecord.check_out_time) {
                if (jamPulangEl) jamPulangEl.innerText = todayRecord.check_out_time + ' WIB';
                if (durasiEl) durasiEl.innerText = todayRecord.work_duration || '-';
            }
        }
    } catch (e) {
        console.error('Update card error:', e);
    }
}

// ─── Export untuk global scope ───
window.handleAbsen = handleAbsen;
window.openSelfieModal = openSelfieModal;
window.captureSelfie = captureSelfie;
window.retakeSelfie = retakeSelfie;
window.closeSelfieModal = closeSelfieModal;
window.submitAbsenWithSelfie = submitAbsenWithSelfie;
window.loadAttendanceConfig = loadAttendanceConfig;
window.updateMobileAttendanceCard = updateMobileAttendanceCard;
