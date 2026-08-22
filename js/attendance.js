async function handleAbsen() {
    if (activeEmployeeSession.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentS = now.getSeconds();
    const currentTimeInSeconds = currentH * 3600 + currentM * 60 + currentS;
    const limitOpenInSeconds = 7 * 3600 + 45 * 60;
    const limitMaxInSeconds = 9 * 3600 + 40 * 60;
    if (currentTimeInSeconds < limitOpenInSeconds) {
        showToast('Absensi belum dibuka. Absen hanya dapat dilakukan mulai pukul 07:45:00 WIB.', 'warning');
        return;
    }
    if (!navigator.geolocation) {
        showToast('Browser Anda tidak mendukung GPS.', 'error');
        return;
    }
    showToast('Mendeteksi lokasi GPS real-time...', 'info');
    navigator.geolocation.getCurrentPosition(function(position) {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        let validBasecamp = null;
        for (let i = 0; i < basecamps.length; i++) {
            const bc = basecamps[i];
            const dist = calculateDistance(userLat, userLng, parseFloat(bc.lat), parseFloat(bc.lng));
            if (dist <= parseFloat(bc.radius)) { validBasecamp = bc; break; }
        }
        pendingAbsenData = {
            date: new Date().toISOString().split('T')[0],
            name: activeEmployeeSession.name,
            basecamp: validBasecamp ? validBasecamp.name : 'Dinas Luar / Lapangan (Terverifikasi GPS)'
        };
        openSelfieModal();
    }, function(err) {
        showToast('Gagal mendeteksi GPS. Pastikan izin lokasi diaktifkan.', 'error');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

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
        .then(function(stream) {
            mediaStream = stream;
            video.srcObject = stream;
        })
        .catch(function(err) {
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    preview.src = dataUrl;
    video.classList.add('hidden');
    preview.classList.remove('hidden');
    document.getElementById('btn-capture').classList.add('hidden');
    document.getElementById('btn-retake').classList.remove('hidden');
    document.getElementById('btn-submit-absen').classList.remove('hidden');
    canvas.toBlob(function(blob) { capturedBlob = blob; }, 'image/jpeg', 0.6);
}

function retakeSelfie() {
    const video = document.getElementById('selfie-video');
    const preview = document.getElementById('selfie-preview');
    video.classList.remove('hidden');
    preview.classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');
    capturedBlob = null;
}

function closeSelfieModal() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(function(track) { track.stop(); });
        mediaStream = null;
    }
    document.getElementById('selfie-modal').classList.add('hidden');
}

async function submitAbsenWithSelfie() {
    if (!pendingAbsenData) {
        showToast('Data absensi tidak ditemukan. Silakan coba lagi.', 'error');
        return;
    }
    const canvas = document.getElementById('selfie-canvas');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const timeString = h + ':' + m + ':' + s;
    let status = 'Tepat Waktu';
    let lateStr = '-';
    const limitMaxInSeconds = 9 * 3600 + 40 * 60;
    const currentS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    if (currentS > limitMaxInSeconds) {
        status = 'Terlambat';
        const diff = currentS - limitMaxInSeconds;
        const dh = Math.floor(diff / 3600);
        const dm = Math.floor((diff % 3600) / 60);
        const ds = diff % 60;
        lateStr = dh.toString().padStart(1, '0') + ':' + dm.toString().padStart(2, '0') + ':' + ds.toString().padStart(2, '0');
    }
    const newRekap = {
        date: pendingAbsenData.date,
        name: pendingAbsenData.name,
        basecamp: pendingAbsenData.basecamp,
        time: timeString,
        status: status,
        late: lateStr,
        selfie_url: dataUrl
    };
    try {
        const result = await supabaseClient.from('rekap_list').insert([newRekap]).select();
        if (result.error) throw result.error;
        if (result.data && result.data.length > 0) {
            rekapList.push(result.data[0]);
        } else {
            rekapList.push(newRekap);
        }
        showToast('Absen berhasil! Jam: ' + timeString + ' WIB', 'success');
        const jamMasukEl = document.getElementById('mobile-jam-masuk');
        if (jamMasukEl) jamMasukEl.innerText = timeString + ' WIB';
        closeSelfieModal();
        renderRekap();
        renderMobileMyHistory();
        updateDashboardStats();
    } catch (err) {
        console.error("Error saving absen:", err);
        showToast('Gagal menyimpan absensi ke server database.', 'error');
    }
}