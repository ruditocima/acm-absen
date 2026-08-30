function dataURItoBlob(dataURI) {
    try {
        var parts = dataURI.split(',');
        var byteString = atob(parts[1]);
        var mimeString = parts[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    } catch (e) {
        console.error('Error converting DataURI to Blob:', e);
        return null;
    }
}

async function handleAbsen() {
    try {
        var session = Store.get('activeEmployeeSession');
        if (!session || !session.name || session.name === 'Tamu') {
            showToast('Silakan login terlebih dahulu.', 'error');
            if (typeof switchMobileTab === 'function') switchMobileTab('daftar');
            return;
        }

        // 1. Ambil waktu server resmi WIB (Kebal manipulasi jam HP)
        var { data: timeData, error: timeErr } = await supabaseClient.rpc('get_current_wib_time');
        if (timeErr || !timeData || timeData.length === 0) {
            showToast('Gagal memvalidasi waktu server. Periksa koneksi.', 'error');
            return;
        }

        var serverTime = timeData[0];
        var serverDateStr = serverTime.wib_date;
        var currentTimeInSeconds = parseInt(serverTime.total_seconds);

        // 2. Cek absen hari ini berdasarkan tanggal server WIB
        var rekapList = Store.get('rekapList') || [];
        var alreadyAbsen = rekapList.some(function(r) { 
            return r.name === session.name && r.date === serverDateStr; 
        });

        if (alreadyAbsen) {
            showToast('Anda sudah absen hari ini. Hanya 1 kali absen per hari.', 'warning');
            return;
        }

        var limitOpenInSeconds = typeof timeToSeconds === 'function' ? timeToSeconds(CONFIG.ATTENDANCE.OPEN_TIME) : 0;
        if (currentTimeInSeconds < limitOpenInSeconds) {
            showToast('Absensi belum dibuka. Mulai ' + CONFIG.ATTENDANCE.OPEN_TIME + ' WIB.', 'warning');
            return;
        }

        if (!navigator.geolocation) {
            showToast('Browser tidak mendukung GPS.', 'error');
            return;
        }

        var btn = document.querySelector('#m-tab-absen button[onclick*="handleAbsen"]');
        if (typeof setButtonLoading === 'function' && btn) {
            setButtonLoading(btn, 'Mendeteksi lokasi...');
        }

        navigator.geolocation.getCurrentPosition(
            function(position) {
                if (typeof resetButtonLoading === 'function' && btn) {
                    resetButtonLoading(btn);
                }

                if (position.coords.accuracy > (CONFIG.GPS ? CONFIG.GPS.MAX_ACCURACY : 100)) {
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
                    var dist = typeof calculateDistance === 'function' ? calculateDistance(userLat, userLng, parseFloat(bc.lat), parseFloat(bc.lng)) : 0;
                    if (dist <= parseFloat(bc.radius)) {
                        validBasecamp = bc;
                        break;
                    }
                }

                Store.set('pendingAbsenData', {
                    date: serverDateStr,
                    name: session.name,
                    basecamp: validBasecamp ? validBasecamp.name : 'Dinas Luar / Lapangan (Terverifikasi GPS)',
                    lat: userLat,
                    lng: userLng,
                    accuracy: position.coords.accuracy
                });

                openSelfieModal();
            },
            function(err) {
                if (typeof resetButtonLoading === 'function' && btn) {
                    resetButtonLoading(btn);
                }
                showToast('Gagal mendeteksi GPS. Aktifkan izin lokasi.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } catch (err) {
        console.error('Error in handleAbsen:', err);
        showToast('Terjadi kesalahan sistem saat memproses lokasi.', 'error');
    }
}

function openSelfieModal() {
    var modal = document.getElementById('selfie-modal');
    if (modal) modal.classList.remove('hidden');
    
    var video = document.getElementById('selfie-video');
    if (video) video.classList.remove('hidden');
    
    var canvas = document.getElementById('selfie-canvas');
    if (canvas) canvas.classList.add('hidden');
    
    var preview = document.getElementById('selfie-preview');
    if (preview) preview.classList.add('hidden');
    
    var btnCapture = document.getElementById('btn-capture');
    if (btnCapture) btnCapture.classList.remove('hidden');
    
    var btnRetake = document.getElementById('btn-retake');
    if (btnRetake) btnRetake.classList.add('hidden');
    
    var btnSubmit = document.getElementById('btn-submit-absen');
    if (btnSubmit) btnSubmit.classList.add('hidden');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(function(stream) {
            Store.set('mediaStream', stream);
            if (video) video.srcObject = stream;
        })
        .catch(function(err) {
            showToast('Gagal mengakses kamera: ' + err.message, 'error');
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
    
    var btnCapture = document.getElementById('btn-capture');
    var btnRetake = document.getElementById('btn-retake');
    var btnSubmit = document.getElementById('btn-submit-absen');
    
    if (btnCapture) btnCapture.classList.add('hidden');
    if (btnRetake) btnRetake.classList.remove('hidden');
    if (btnSubmit) btnSubmit.classList.remove('hidden');

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
    var btn = document.getElementById('btn-submit-absen');
    if (typeof setButtonLoading === 'function' && btn) {
        setButtonLoading(btn, 'Mengunggah foto...');
    }

    try {
        var pendingAbsenData = Store.get('pendingAbsenData');
        if (!pendingAbsenData) {
            showToast('Data absensi tidak ditemukan. Silakan ulangi proses dari awal.', 'error');
            if (typeof resetButtonLoading === 'function' && btn) resetButtonLoading(btn);
            return;
        }

        var blob = Store.get('capturedBlob');
        if (!blob) {
            var preview = document.getElementById('selfie-preview');
            if (preview && preview.src && preview.src.startsWith('data:')) {
                blob = dataURItoBlob(preview.src);
                Store.set('capturedBlob', blob);
            }
        }

        if (!blob) {
            showToast('Foto selfie belum diambil atau tidak valid.', 'error');
            if (typeof resetButtonLoading === 'function' && btn) resetButtonLoading(btn);
            return;
        }

        // Penanganan fallback ID sesi login yang aman
        var session = Store.get('activeEmployeeSession') || {};
        var userId = session.id || session.email || session.name || 'user_' + Date.now();
        var cleanId = String(userId).replace(/[@.\s]/g, '_');
        var fileName = CONFIG.STORAGE.FOLDER + '/' + pendingAbsenData.date + '_' + cleanId + '_' + Date.now() + '.jpg';

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
            showToast('Gagal mengunggah foto: ' + (uploadResult.error.message || 'Kesalahan storage'), 'error');
            if (typeof resetButtonLoading === 'function' && btn) resetButtonLoading(btn);
            return;
        }

        var urlResult = supabaseClient.storage.from(CONFIG.STORAGE.BUCKET).getPublicUrl(fileName);
        var selfieUrl = urlResult.data.publicUrl;

        var newRekap = {
            date: pendingAbsenData.date, // Tanggal resmi server WIB
            name: pendingAbsenData.name,
            basecamp: pendingAbsenData.basecamp,
            selfie_url: selfieUrl,
            lat: pendingAbsenData.lat,
            lng: pendingAbsenData.lng,
            accuracy: pendingAbsenData.accuracy
        };

        var insertResult = await supabaseClient.from('rekap_list').insert([newRekap]).select();
        if (insertResult.error) {
            console.error('Database insert error:', insertResult.error);
            showToast('Gagal menyimpan ke database: ' + insertResult.error.message, 'error');
            if (typeof resetButtonLoading === 'function' && btn) resetButtonLoading(btn);
            return;
        }

        var savedRecord = insertResult.data && insertResult.data.length > 0 ? insertResult.data[0] : newRekap;
        var timeString = savedRecord.time || '00:00:00';

        var rekapList = Store.get('rekapList') || [];
        rekapList.push(savedRecord);
        Store.set('rekapList', rekapList.slice());

        showToast('Absen berhasil! Jam: ' + timeString + ' WIB', 'success');

        var jamMasukEl = document.getElementById('mobile-jam-masuk');
        if (jamMasukEl) jamMasukEl.innerText = timeString + ' WIB';

        closeSelfieModal();
        if (typeof renderRekap === 'function') renderRekap();
        if (typeof renderMobileMyHistory === 'function') renderMobileMyHistory();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();

    } catch (err) {
        console.error('Exception during submit:', err);
        showToast('Terjadi kesalahan sistem saat mengirim absen.', 'error');
    } finally {
        if (typeof resetButtonLoading === 'function' && btn) {
            resetButtonLoading(btn);
        }
    }
}

// Bind fungsi ke window agar dapat dipanggil dari event handler HTML
window.handleAbsen = handleAbsen;
window.openSelfieModal = openSelfieModal;
window.captureSelfie = captureSelfie;
window.retakeSelfie = retakeSelfie;
window.closeSelfieModal = closeSelfieModal;
window.submitAbsenWithSelfie = submitAbsenWithSelfie;
