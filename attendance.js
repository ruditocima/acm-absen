// Helper sinkron untuk mengubah DataURL menjadi Blob (menghindari race condition toBlob)
function dataURItoBlob(dataURI) {
    var splitData = dataURI.split(',');
    var byteString = atob(splitData[1]);
    var mimeString = splitData[0].split(':')[1].split(';')[0];
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

function hasAbsenToday(employeeName) {
    var todayStr = getWIBDateString();
    var rekapList = Store.get('rekapList') || [];
    return rekapList.some(function(r) { return r.name === employeeName && r.date === todayStr; });
}

async function handleAbsen(buttonElement) {
    var session = Store.get('activeEmployeeSession');
    if (!session || session.name === 'Tamu') {
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
    var currentTimeInSeconds = parseInt(wib.h, 10) * 3600 + parseInt(wib.m, 10) * 60 + parseInt(wib.s, 10);
    var limitOpenInSeconds = timeToSeconds(CONFIG.ATTENDANCE.OPEN_TIME);

    if (currentTimeInSeconds < limitOpenInSeconds) {
        showToast('Absensi belum dibuka. Mulai ' + CONFIG.ATTENDANCE.OPEN_TIME + ' WIB.', 'warning');
        return;
    }

    if (!navigator.geolocation) {
        showToast('Browser tidak mendukung GPS.', 'error');
        return;
    }

    var btn = buttonElement || document.querySelector('#m-tab-absen button[onclick*="handleAbsen"]');
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
            
            var koordEl = document.getElementById('koordinat-display');
            if (koordEl) {
                koordEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> Koordinat: ' + userLat.toFixed(5) + ', ' + userLng.toFixed(5);
            }

            var basecamps = Store.get('basecamps') || [];
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
            var errorMsg = 'Gagal mendeteksi GPS.';
            if (err.code === 1) errorMsg = 'Izin GPS ditolak. Aktifkan izin lokasi.';
            else if (err.code === 2) errorMsg = 'Lokasi tidak tersedia.';
            else if (err.code === 3) errorMsg = 'Waktu permintaan GPS habis.';
            showToast(errorMsg, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function openSelfieModal() {
    var modal = document.getElementById('selfie-modal');
    if (modal) modal.classList.remove('hidden');
    
    var video = document.getElementById('selfie-video');
    if (video) video.classList.remove('hidden');
    
    var canvas = document.getElementById('selfie-canvas');
    var preview = document.getElementById('selfie-preview');
    if (canvas) canvas.classList.add('hidden');
    if (preview) preview.classList.add('hidden');
    
    var btnCapture = document.getElementById('btn-capture');
    var btnRetake = document.getElementById('btn-retake');
    var btnSubmit = document.getElementById('btn-submit-absen');
    if (btnCapture) btnCapture.classList.remove('hidden');
    if (btnRetake) btnRetake.classList.add('hidden');
    if (btnSubmit) btnSubmit.classList.add('hidden');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Browser tidak mendukung akses kamera.', 'error');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(function(stream) {
            Store.set('mediaStream', stream);
            if (video) video.srcObject = stream;
        })
        .catch(function(err) {
            showToast('Gagal mengakses kamera: ' + (err.message || 'Izin ditolak'), 'error');
        });
}

function captureSelfie() {
    var video = document.getElementById('selfie-video');
    var canvas = document.getElementById('selfie-canvas');
    var preview = document.getElementById('selfie-preview');
    
    if (!video || !canvas || !preview) return;

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

    // Menggunakan helper sinkron untuk menghindari race condition toBlob
    var blob = dataURItoBlob(dataUrl);
    Store.set('capturedBlob', blob);
}

function retakeSelfie() {
    var video = document.getElementById('selfie-video');
    var preview = document.getElementById('selfie-preview');
    if (video) video.classList.remove('hidden');
    if (preview) preview.classList.add('hidden');
    
    var btnCapture = document.getElementById('btn-capture');
    var btnRetake = document.getElementById('btn-retake');
    var btnSubmit = document.getElementById('btn-submit-absen');
    if (btnCapture) btnCapture.classList.remove('hidden');
    if (btnRetake) btnRetake.classList.add('hidden');
    if (btnSubmit) btnSubmit.classList.add('hidden');
    
    Store.set('capturedBlob', null);
}

function closeSelfieModal() {
    var mediaStream = Store.get('mediaStream');
    if (mediaStream) {
        mediaStream.getTracks().forEach(function(track) { track.stop(); });
        Store.set('mediaStream', null);
    }
    Store.set('capturedBlob', null);
    var modal = document.getElementById('selfie-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitAbsenWithSelfie() {
    var pendingAbsenData = Store.get('pendingAbsenData');
    if (!pendingAbsenData) {
        showToast('Data absensi tidak ditemukan.', 'error');
        return;
    }

    var blob = Store.get('capturedBlob');
    if (!blob) {
        showToast('Foto belum diambil atau belum selesai diproses.', 'error');
        return;
    }

    var btn = document.getElementById('btn-submit-absen');
    setButtonLoading(btn, 'Mengunggah foto...');

    try {
        var session = Store.get('activeEmployeeSession') || {};
        var identifier = session.id ? session.id.toString().replace(/[@.]/g, '_') : 'user';
        var fileName = (CONFIG.STORAGE.FOLDER || 'attendance') + '/' + pendingAbsenData.date + '_' + identifier + '_' + Date.now() + '.jpg';

        var uploadResult = await supabaseClient
            .storage
            .from(CONFIG.STORAGE.BUCKET)
            .upload(fileName, blob, {
                contentType: blob.type || 'image/jpeg',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadResult.error) {
            console.error('Storage upload error:', uploadResult.error);
            showToast('Gagal mengunggah foto ke server.', 'error');
            return;
        }

        var urlResult = supabaseClient.storage.from(CONFIG.STORAGE.BUCKET).getPublicUrl(fileName);
        var selfieUrl = urlResult.data.publicUrl;

        var now = new Date();
        var wib = getWIBTimeParts(now);
        var timeString = wib.h + ':' + wib.m + ':' + wib.s;
        var dateStr = getWIBDateString(now);

        var status = 'Tepat Waktu';
        var lateStr = '-';
        var limitMaxInSeconds = timeToSeconds(CONFIG.ATTENDANCE.MAX_TIME);
        var currentS = parseInt(wib.h, 10) * 3600 + parseInt(wib.m, 10) * 60 + parseInt(wib.s, 10);

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

        var insertResult = await supabaseClient.from('rekap_list').insert([newRekap]).select();
        if (insertResult.error) throw insertResult.error;

        var rekapList = Store.get('rekapList') || [];
        if (insertResult.data && insertResult.data.length > 0) {
            rekapList.push(insertResult.data[0]);
        } else {
            rekapList.push(newRekap);
        }
        Store.set('rekapList', rekapList.slice());

        showToast('Absen berhasil! Jam: ' + timeString + ' WIB', 'success');

        var jamMasukEl = document.getElementById('mobile-jam-masuk');
        if (jamMasukEl) jamMasukEl.innerText = timeString + ' WIB';

        closeSelfieModal();
        if (typeof renderRekap === 'function') renderRekap();
        if (typeof renderMobileMyHistory === 'function') renderMobileMyHistory();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();

    } catch (err) {
        console.error('Error saat menyimpan absensi:', err);
        showToast('Gagal menyimpan absensi: ' + (err.message || 'Kesalahan sistem'), 'error');
    } finally {
        resetButtonLoading(btn);
    }
}
