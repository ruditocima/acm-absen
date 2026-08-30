function hasAbsenToday(employeeName) {
    var todayStr = getWIBDateString();
    var rekapList = Store.get('rekapList');
    return rekapList.some(function(r) { return r.name === employeeName && r.date === todayStr; });
}

async function handleAbsen() {
    var session = Store.get('activeEmployeeSession');
    if (session.name === 'Tamu') {
        showToast('Silakan login terlebih dahulu.', 'error');
        switchMobileTab('daftar');
        return;
    }

    if (hasAbsenToday(session.name)) {
        showToast('Anda sudah absen hari ini. Hanya 1 kali absen per hari.', 'warning');
        return;
    }

    var now = new Date();
    var wib = getWIBTimeParts(now);
    var currentTimeInSeconds = parseInt(wib.h) * 3600 + parseInt(wib.m) * 60 + parseInt(wib.s);
    var limitOpenInSeconds = timeToSeconds(CONFIG.ATTENDANCE.OPEN_TIME);

    if (currentTimeInSeconds < limitOpenInSeconds) {
        showToast('Absensi belum dibuka. Mulai ' + CONFIG.ATTENDANCE.OPEN_TIME + ' WIB.', 'warning');
        return;
    }

    if (!navigator.geolocation) {
        showToast('Browser tidak mendukung GPS.', 'error');
        return;
    }

    var btn = document.querySelector('#m-tab-absen button[onclick="handleAbsen()"]');
    setButtonLoading(btn, 'Mendeteksi lokasi...');

    navigator.geolocation.getCurrentPosition(
        function(position) {
            resetButtonLoading(btn);

            if (position.coords.accuracy > CONFIG.GPS.MAX_ACCURACY) {
                showToast('Akurasi GPS terlalu rendah (' + Math.round(position.coords.accuracy) + 'm). Coba lagi di lokasi terbuka.', 'warning');
                return;
            }

            var userLat = position.coords.latitude;
            var userLng = position.coords.longitude;
            // --- KODE TAMBAHAN UNTUK MENGUBAH TEKS DI LAYAR ---
            var koordEl = document.getElementById('koordinat-display');
            if (koordEl) {
                koordEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> Koordinat: ' + userLat.toFixed(5) + ', ' + userLng.toFixed(5);
            }
            // --------------------------------------------------
            var basecamps = Store.get('basecamps');
            var validBasecamp = null;

            for (var i = 0; i < basecamps.length; i++) {
                var bc = basecamps[i];
                var dist = calculateDistance(userLat, userLng, parseFloat(bc.lat), parseFloat(bc.lng));
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
        function(err) {
            resetButtonLoading(btn);
            showToast('Gagal mendeteksi GPS. Aktifkan izin lokasi.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function openSelfieModal() {
    document.getElementById('selfie-modal').classList.remove('hidden');
    var video = document.getElementById('selfie-video');
    video.classList.remove('hidden');
    document.getElementById('selfie-canvas').classList.add('hidden');
    document.getElementById('selfie-preview').classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(function(stream) {
            Store.set('mediaStream', stream);
            video.srcObject = stream;
        })
        .catch(function(err) {
            showToast('Gagal mengakses kamera: ' + err.message, 'error');
        });
}

function captureSelfie() {
    var video = document.getElementById('selfie-video');
    var canvas = document.getElementById('selfie-canvas');
    var preview = document.getElementById('selfie-preview');
    
    // Batasi resolusi maksimum untuk mempercepat upload
    var maxWidth = 640;
    var maxHeight = 480;
    var width = video.videoWidth || 640;
    var height = video.videoHeight || 480;

    if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
    }
    if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;
    
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    var supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    var mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
    var quality = supportsWebP ? 0.7 : 0.5;
    var dataUrl = canvas.toDataURL(mimeType, quality);
    preview.src = dataUrl;

    video.classList.add('hidden');
    preview.classList.remove('hidden');
    document.getElementById('btn-capture').classList.add('hidden');
    document.getElementById('btn-retake').classList.remove('hidden');
    document.getElementById('btn-submit-absen').classList.remove('hidden');

    canvas.toBlob(function(blob) {
        Store.set('capturedBlob', blob);
    }, mimeType, quality);
}

function retakeSelfie() {
    var video = document.getElementById('selfie-video');
    var preview = document.getElementById('selfie-preview');
    video.classList.remove('hidden');
    preview.classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-retake').classList.add('hidden');
    document.getElementById('btn-submit-absen').classList.add('hidden');
    Store.set('capturedBlob', null);
}

function closeSelfieModal() {
    var mediaStream = Store.get('mediaStream');
    if (mediaStream) {
        mediaStream.getTracks().forEach(function(track) { track.stop(); });
        Store.set('mediaStream', null);
    }
    Store.set('capturedBlob', null);
    document.getElementById('selfie-modal').classList.add('hidden');
}

async function submitAbsenWithSelfie() {
    var pendingAbsenData = Store.get('pendingAbsenData');
    if (!pendingAbsenData) {
        showToast('Data absensi tidak ditemukan.', 'error');
        return;
    }

    var btn = document.getElementById('btn-submit-absen');
    setButtonLoading(btn, 'Mengunggah foto...');

    var canvas = document.getElementById('selfie-canvas');
    var blob = Store.get('capturedBlob');

    if (!blob) {
        showToast('Foto belum diambil.', 'error');
        resetButtonLoading(btn);
        return;
    }

    var selfieUrl = null;

    try {
        var session = Store.get('activeEmployeeSession');
        var fileName = CONFIG.STORAGE.FOLDER + '/' + pendingAbsenData.date + '_' + session.id.replace(/[@.]/g, '_') + '_' + Date.now() + '.jpg';

        var uploadResult = await supabaseClient
            .storage
            .from(CONFIG.STORAGE.BUCKET)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadResult.error) {
            console.error('Storage upload error:', uploadResult.error);
            showToast('Gagal mengunggah foto ke server.', 'error');
            resetButtonLoading(btn);
            return;
        }

        var urlResult = supabaseClient.storage.from(CONFIG.STORAGE.BUCKET).getPublicUrl(fileName);
        selfieUrl = urlResult.data.publicUrl;
    } catch (err) {
        console.error('Storage exception:', err);
        showToast('Gagal mengunggah foto.', 'error');
        resetButtonLoading(btn);
        return;
    }

    var now = new Date();
    var wib = getWIBTimeParts(now);
    var timeString = wib.h + ':' + wib.m + ':' + wib.s;
    var dateStr = getWIBDateString(now);

    var status = 'Tepat Waktu';
    var lateStr = '-';
    var limitMaxInSeconds = timeToSeconds(CONFIG.ATTENDANCE.MAX_TIME);
    var currentS = parseInt(wib.h) * 3600 + parseInt(wib.m) * 60 + parseInt(wib.s);

    if (currentS > limitMaxInSeconds) {
        status = 'Terlambat';
        var diff = currentS - limitMaxInSeconds;
        var dh = Math.floor(diff / 3600);
        var dm = Math.floor((diff % 3600) / 60);
        var ds = diff % 60;
        lateStr = dh + ':' + dm.toString().padStart(2, '0') + ':' + ds.toString().padStart(2, '0');
    }

    var newRekap = {
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
        var insertResult = await supabaseClient.from('rekap_list').insert([newRekap]).select();
        if (insertResult.error) throw insertResult.error;

        var rekapList = Store.get('rekapList');
        if (insertResult.data && insertResult.data.length > 0) rekapList.push(insertResult.data[0]);
        else rekapList.push(newRekap);
        Store.set('rekapList', rekapList.slice());

        showToast('Absen berhasil! Jam: ' + timeString + ' WIB', 'success');

        var jamMasukEl = document.getElementById('mobile-jam-masuk');
        if (jamMasukEl) jamMasukEl.innerText = timeString + ' WIB';

        closeSelfieModal();
        renderRekap();
        renderMobileMyHistory();
        updateDashboardStats();
    } catch (err) {
        console.error('Error:', err);
        showToast('Gagal menyimpan absensi.', 'error');
    } finally {
        resetButtonLoading(btn);
    }
}
