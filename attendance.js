
# ============================================================
# FILE 5: attendance.js — Absensi, Selfie, GPS, Storage Upload
# ============================================================
attendance_js = r'''// ============================================================
// ATTENDANCE: Absen, Selfie, GPS, Upload ke Supabase Storage
// ============================================================

// --------------------------------------------------------
// CHECK DAILY DUPLICATE ABSEN
// --------------------------------------------------------
function hasAbsenToday(employeeName) {
    const todayStr = getWIBDateString();
    const rekapList = Store.get('rekapList');
    return rekapList.some(r => r.name === employeeName && r.date === todayStr);
}

// --------------------------------------------------------
// HANDLE ABSEN (dengan anti-duplikat & accuracy check)
// --------------------------------------------------------
async function handleAbsen() {
    const session = Store.get('activeEmployeeSession');
    if (session.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }

    // Cek duplikat absen harian
    if (hasAbsenToday(session.name)) {
        showToast('Anda sudah absen hari ini. Hanya 1 kali absen per hari.', 'warning');
        return;
    }

    const now = new Date();
    const wib = getWIBTimeParts(now);
    const currentTimeInSeconds = parseInt(wib.h) * 3600 + parseInt(wib.m) * 60 + parseInt(wib.s);
    const limitOpenInSeconds = timeToSeconds(CONFIG.ATTENDANCE.OPEN_TIME);

    if (currentTimeInSeconds < limitOpenInSeconds) {
        showToast(`Absensi belum dibuka. Mulai ${CONFIG.ATTENDANCE.OPEN_TIME} WIB.`, 'warning');
        return;
    }

    if (!navigator.geolocation) {
        showToast('Browser tidak mendukung GPS.', 'error');
        return;
    }

    const btn = document.querySelector('#m-tab-absen button[onclick="handleAbsen()"]');
    setButtonLoading(btn, 'Mendeteksi lokasi...');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            resetButtonLoading(btn);

            // Validasi akurasi GPS
            if (position.coords.accuracy > CONFIG.GPS.MAX_ACCURACY) {
                showToast(`Akurasi GPS terlalu rendah (${Math.round(position.coords.accuracy)}m). Coba lagi di lokasi terbuka.`, 'warning');
                return;
            }

            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            const basecamps = Store.get('basecamps');
            let validBasecamp = null;

            for (let bc of basecamps) {
                const dist = calculateDistance(userLat, userLng, parseFloat(bc.lat), parseFloat(bc.lng));
                if (dist <= parseFloat(bc.radius)) {
                    validBasecamp = bc;
                    break;
                }
            }

            Store.set('pendingAbsenData', {
                date: getWIBDateString(),
                name: session.name,
                basecamp: validBasecamp ? validBasecamp.name : 'Dinas Luar / Lapangan (Terverifikasi GPS)',
                lat: userLat,
                lng: userLng,
                accuracy: position.coords.accuracy
            });

            openSelfieModal();
        },
        (err) => {
            resetButtonLoading(btn);
            showToast('Gagal mendeteksi GPS. Aktifkan izin lokasi.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// --------------------------------------------------------
// SELFIE MODAL & CAPTURE
// --------------------------------------------------------
function openSelfieModal() {
    document.getElementById('selfie-modal').classList.remove('hidden');
    const video = document.getElementById('selfie-video');
    video.classList.remove('hidden');
    document.getElementById('selfie-canvas').classList.add('hidden');
    document.getElementById('selfie-preview').classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            Store.set('mediaStream', stream);
            video.srcObject = stream;
        })
        .catch(err => {
            showToast('Gagal mengakses kamera: ' + err.message, 'error');
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

    const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
    const quality = supportsWebP ? 0.75 : 0.6;
    const dataUrl = canvas.toDataURL(mimeType, quality);
    preview.src = dataUrl;

    video.classList.add('hidden');
    preview.classList.remove('hidden');
    document.getElementById('btn-capture').classList.add('hidden');
    document.getElementById('btn-retake').classList.remove('hidden');
    document.getElementById('btn-submit-absen').classList.remove('hidden');

    canvas.toBlob((blob) => {
        Store.set('capturedBlob', blob);
    }, mimeType, quality);
}

function retakeSelfie() {
    const video = document.getElementById('selfie-video');
    const preview = document.getElementById('selfie-preview');
    video.classList.remove('hidden');
    preview.classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');
    Store.set('capturedBlob', null);
}

function closeSelfieModal() {
    const mediaStream = Store.get('mediaStream');
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        Store.set('mediaStream', null);
    }
    Store.set('capturedBlob', null);
    document.getElementById('selfie-modal').classList.add('hidden');
}

// --------------------------------------------------------
// SUBMIT ABSEN (dengan upload ke Supabase Storage)
// --------------------------------------------------------
async function submitAbsenWithSelfie() {
    const pendingAbsenData = Store.get('pendingAbsenData');
    if (!pendingAbsenData) {
        showToast('Data absensi tidak ditemukan.', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-absen');
    setButtonLoading(btn, 'Mengunggah foto...');

    const canvas = document.getElementById('selfie-canvas');
    const blob = Store.get('capturedBlob');

    if (!blob) {
        showToast('Foto belum diambil.', 'error');
        resetButtonLoading(btn);
        return;
    }

    let selfieUrl = null;

    // Upload ke Supabase Storage
    try {
        const session = Store.get('activeEmployeeSession');
        const fileName = `${CONFIG.STORAGE.FOLDER}/${pendingAbsenData.date}_${session.id.replace(/[@.]/g, '_')}_${Date.now()}.jpg`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from(CONFIG.STORAGE.BUCKET)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            showToast('Gagal mengunggah foto ke server.', 'error');
            resetButtonLoading(btn);
            return;
        }

        const { data: { publicUrl } } = supabaseClient
            .storage
            .from(CONFIG.STORAGE.BUCKET)
            .getPublicUrl(fileName);

        selfieUrl = publicUrl;
    } catch (err) {
        console.error('Storage exception:', err);
        showToast('Gagal mengunggah foto.', 'error');
        resetButtonLoading(btn);
        return;
    }

    const now = new Date();
    const wib = getWIBTimeParts(now);
    const timeString = `${wib.h}:${wib.m}:${wib.s}`;
    const dateStr = getWIBDateString(now);

    let status = 'Tepat Waktu';
    let lateStr = '-';
    const limitMaxInSeconds = timeToSeconds(CONFIG.ATTENDANCE.MAX_TIME);
    const currentS = parseInt(wib.h) * 3600 + parseInt(wib.m) * 60 + parseInt(wib.s);

    if (currentS > limitMaxInSeconds) {
        status = 'Terlambat';
        const diff = currentS - limitMaxInSeconds;
        const dh = Math.floor(diff / 3600);
        const dm = Math.floor((diff % 3600) / 60);
        const ds = diff % 60;
        lateStr = `${dh}:${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')}`;
    }

    const newRekap = {
        date: dateStr,
        name: pendingAbsenData.name,
        basecamp: pendingAbsenData.basecamp,
        time: timeString,
        status: status,
        late: lateStr,
        selfie_url: selfieUrl,
        lat: pendingAbsenData.lat,
        lng: pendingAbsenData.lng,
        accuracy: pendingAbsenData.accuracy
    };

    try {
        const { data, error } = await supabaseClient.from('rekap_list').insert([newRekap]).select();
        if (error) throw error;

        const rekapList = Store.get('rekapList');
        if (data && data.length > 0) rekapList.push(data[0]);
        else rekapList.push(newRekap);
        Store.set('rekapList', [...rekapList]);

        showToast(`Absen berhasil! Jam: ${timeString} WIB`, 'success');

        const jamMasukEl = document.getElementById('mobile-jam-masuk');
        if (jamMasukEl) jamMasukEl.innerText = `${timeString} WIB`;

        closeSelfieModal();
        renderRekap();
        renderMobileMyHistory();
        updateDashboardStats();
    } catch (err) {
        console.error("Error:", err);
        showToast('Gagal menyimpan absensi.', 'error');
    } finally {
        resetButtonLoading(btn);
    }
}
'''

with open('/mnt/agents/output/attendance.js', 'w', encoding='utf-8') as f:
    f.write(attendance_js)

print("✅ attendance.js created")
