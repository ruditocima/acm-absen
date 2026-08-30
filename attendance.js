/**
 * Modul Absensi Terintegrasi (Enterprise Production Grade - Ultimate v4.3.13)
 * Pembaruan: Strict Storage Path Validation, Enhanced Name Sanitization & Robust Network Guard
 */
(function(window, document) {
    'use strict';

    var AttendanceModule = {
        isSubmittingAbsen: false,
        isDetectingLocation: false,
        captureSessionId: 0,
        currentObjectUrl: null,
        currentCapturedBlob: null,
        currentCapturedMimeType: null,
        currentMediaStream: null,
        isWebPSupportedCache: null,
        isFrontCamera: true,
        gpsWatchdogTimerId: null,
        resizeListenerBound: false,
        lastInteractionTimestamp: 0,

        init: function() {
            var self = this;
            if (typeof window.__attendanceBeforeUnloadRegistered === 'undefined') {
                window.__attendanceBeforeUnloadRegistered = true;
                window.addEventListener('beforeunload', function() {
                    self.cleanupResources();
                });
            }
            if (typeof document.hidden !== 'undefined' && typeof window.__attendanceVisibilityRegistered === 'undefined') {
                window.__attendanceVisibilityRegistered = true;
                document.addEventListener('visibilitychange', function() {
                    if (document.hidden) {
                        self.stopCurrentCameraStream();
                    } else {
                        var modal = document.getElementById('selfie-modal');
                        if (modal && !modal.classList.contains('hidden')) {
                            var preview = document.getElementById('selfie-preview');
                            if (preview && preview.classList.contains('hidden')) {
                                self.openSelfieModal();
                            }
                        }
                    }
                });
            }
            if (!self.resizeListenerBound) {
                self.resizeListenerBound = true;
                window.addEventListener('resize', function() {
                    var modal = document.getElementById('selfie-modal');
                    if (modal && !modal.classList.contains('hidden')) {
                        var video = document.getElementById('selfie-video');
                        if (video && video.style) {
                            video.style.transform = video.style.transform === 'translateZ(0)' ? 'none' : 'translateZ(0)';
                        }
                    }
                });
            }
        },

        cleanupResources: function() {
            if (this.gpsWatchdogTimerId) {
                clearTimeout(this.gpsWatchdogTimerId);
                this.gpsWatchdogTimerId = null;
            }
            if (this.currentObjectUrl) {
                try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) {}
                this.currentObjectUrl = null;
            }
            this.stopCurrentCameraStream();
            this.currentCapturedBlob = null;
            this.currentCapturedMimeType = null;
            this.isDetectingLocation = false;
            this.isSubmittingAbsen = false;

            var manualBtn = document.getElementById('btn-manual-camera-retry');
            if (manualBtn) manualBtn.remove();
        },

        safeStoreGet: function(key, fallbackValue) {
            if (typeof Store !== 'undefined' && typeof Store.get === 'function') {
                try {
                    var val = Store.get(key);
                    if (val === undefined || val === null) return fallbackValue;
                    if (key === 'rekapList' && !Array.isArray(val)) return fallbackValue;
                    if (key === 'basecamps' && !Array.isArray(val)) return fallbackValue;
                    return val;
                } catch (e) {
                    return fallbackValue;
                }
            }
            return fallbackValue;
        },

        safeStoreSet: function(key, value) {
            if (typeof Store !== 'undefined' && typeof Store.set === 'function') {
                try {
                    if (key === 'rekapList' && Array.isArray(value)) {
                        value = value.slice(-100);
                    }
                    Store.set(key, value);
                    return true;
                } catch (e) {
                    var errName = e && e.name ? String(e.name) : '';
                    var errMsg = e && e.message ? String(e.message).toLowerCase() : '';
                    var isQuotaError = errName.includes('Quota') || errMsg.includes('quota') || errMsg.includes('storage full');
                    
                    if (isQuotaError) {
                        try {
                            var activeSession = localStorage.getItem('activeEmployeeSession');
                            var basecamps = localStorage.getItem('basecamps');
                            
                            var keysToRemove = [];
                            for (var i = 0; i < localStorage.length; i++) {
                                var k = localStorage.key(i);
                                if (k && k !== 'activeEmployeeSession' && k !== 'basecamps') {
                                    keysToRemove.push(k);
                                }
                            }
                            for (var j = 0; j < keysToRemove.length; j++) {
                                localStorage.removeItem(keysToRemove[j]);
                            }

                            if (activeSession) localStorage.setItem('activeEmployeeSession', activeSession);
                            if (basecamps) localStorage.setItem('basecamps', basecamps);

                            if (key === 'rekapList' && Array.isArray(value)) {
                                Store.set(key, value.slice(-15));
                            } else {
                                Store.set(key, value);
                            }
                            return true;
                        } catch (errInner) {}
                    }
                    
                    if (typeof showToast === 'function') {
                        showToast('Penyimpanan lokal penuh. Mohon bersihkan data peramban.', 'warning');
                    }
                    return false;
                }
            }
            return false;
        },

        parseTimeStringToSeconds: function(timeStr, fallbackVal) {
            if (typeof timeToSeconds === 'function') {
                try {
                    var res = timeToSeconds(timeStr);
                    if (typeof res === 'number' && !isNaN(res)) return res;
                } catch (e) {}
            }
            if (!timeStr || typeof timeStr !== 'string') return fallbackVal;
            var parts = timeStr.trim().split(':');
            if (parts.length < 2) return fallbackVal;
            var h = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10);
            var s = parts[2] ? parseInt(parts[2], 10) : 0;
            if (isNaN(h) || isNaN(m) || isNaN(s)) return fallbackVal;
            return h * 3600 + m * 60 + s;
        },

        getSafeWIBDateString: function(dateObj) {
            var targetDate = (dateObj instanceof Date && !isNaN(dateObj.getTime())) ? dateObj : new Date();
            if (typeof getWIBDateString === 'function') {
                try {
                    var res = getWIBDateString(targetDate);
                    if (res) return String(res).trim();
                } catch (e) {}
            }
            try {
                var utcTime = targetDate.getTime() + (targetDate.getTimezoneOffset() * 60000);
                var wibTime = new Date(utcTime + (7 * 3600 * 1000));
                var y = wibTime.getUTCFullYear();
                var m = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
                var d = String(wibTime.getUTCDate()).padStart(2, '0');
                return y + '-' + m + '-' + d;
            } catch (e) {
                return targetDate.toISOString().split('T')[0];
            }
        },

        getSafeWIBTimeParts: function(dateObj) {
            var targetDate = (dateObj instanceof Date && !isNaN(dateObj.getTime())) ? dateObj : new Date();
            if (typeof getWIBTimeParts === 'function') {
                try {
                    var res = getWIBTimeParts(targetDate);
                    if (res && res.h != null) return res;
                } catch (e) {}
            }
            try {
                var utcTime = targetDate.getTime() + (targetDate.getTimezoneOffset() * 60000);
                var wibTime = new Date(utcTime + (7 * 3600 * 1000));
                return {
                    h: wibTime.getUTCHours(),
                    m: wibTime.getUTCMinutes(),
                    s: wibTime.getUTCSeconds()
                };
            } catch (e) {
                return { h: targetDate.getHours(), m: targetDate.getMinutes(), s: targetDate.getSeconds() };
            }
        },

        safeCalculateDistance: function(lat1, lon1, lat2, lon2) {
            if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
                isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2) ||
                lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90 ||
                lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
                return Infinity;
            }

            if (typeof calculateDistance === 'function') {
                try {
                    var dist = calculateDistance(lat1, lon1, lat2, lon2);
                    if (typeof dist === 'number' && !isNaN(dist) && isFinite(dist)) {
                        return dist;
                    }
                } catch (e) {}
            }

            var R = 6371e3;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLon = (lon2 - lon1) * Math.PI / 180;
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        parseCoordinateValue: function(rawVal) {
            if (rawVal == null) return NaN;
            var str = String(rawVal).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
            if (!str) return NaN;

            var dmsRegex = /^([+-]?\d+)[°º\s]+(\d+)['′\s]+([\d.]+)["″]?\s*([nNsSeEwW]?)$/;
            var dmsMatch = str.match(dmsRegex);
            if (dmsMatch) {
                var deg = parseFloat(dmsMatch[1]) || 0;
                var min = parseFloat(dmsMatch[2]) || 0;
                var sec = parseFloat(dmsMatch[3]) || 0;
                var dir = (dmsMatch[4] || '').toUpperCase();
                var decimal = Math.abs(deg) + (min / 60) + (sec / 3600);
                if (deg < 0 || dir === 'S' || dir === 'W') decimal = -decimal;
                return isNaN(decimal) ? NaN : decimal;
            }

            var ddmRegex = /^([+-]?\d+)[°º\s]+([\d.]+)['′]?\s*([nNsSeEwW]?)$/;
            var ddmMatch = str.match(ddmRegex);
            if (ddmMatch) {
                var dDeg = parseFloat(ddmMatch[1]) || 0;
                var dMin = parseFloat(ddmMatch[2]) || 0;
                var dDir = (ddmMatch[3] || '').toUpperCase();
                var dDecimal = Math.abs(dDeg) + (dMin / 60);
                if (dDeg < 0 || dDir === 'S' || dDir === 'W') dDecimal = -dDecimal;
                return isNaN(dDecimal) ? NaN : dDecimal;
            }

            var cleaned = str.replace(/[°º'"\s]/g, '');
            var upperCleaned = cleaned.toUpperCase();
            var isNegative = upperCleaned.endsWith('S') || upperCleaned.endsWith('W') || cleaned.startsWith('-');
            
            cleaned = cleaned.replace(/[sS_wWnNeE]/g, '');
            if (cleaned.includes(',') && !cleaned.includes('.')) {
                cleaned = cleaned.replace(',', '.');
            }
            
            var parsed = parseFloat(cleaned);
            if (isNaN(parsed)) return NaN;
            return isNegative ? -Math.abs(parsed) : parsed;
        },

        checkWebPSupport: function() {
            if (this.isWebPSupportedCache !== null) return this.isWebPSupportedCache;
            try {
                var dummyCanvas = document.createElement('canvas');
                dummyCanvas.width = 1;
                dummyCanvas.height = 1;
                this.isWebPSupportedCache = dummyCanvas.toDataURL('image/webp').startsWith('data:image/webp');
            } catch (e) {
                this.isWebPSupportedCache = false;
            }
            return this.isWebPSupportedCache;
        },

        stopCurrentCameraStream: function() {
            if (this.currentMediaStream && this.currentMediaStream.getTracks) {
                try {
                    this.currentMediaStream.getTracks().forEach(function(track) { 
                        if (track.readyState === 'live') track.stop(); 
                    });
                } catch (e) {}
                this.currentMediaStream = null;
            }
            
            var videoEl = document.getElementById('selfie-video');
            if (videoEl) {
                if (videoEl.srcObject && videoEl.srcObject.getTracks) {
                    try {
                        videoEl.srcObject.getTracks().forEach(function(track) { 
                            if (track.readyState === 'live') track.stop(); 
                        });
                    } catch (e) {}
                }
                videoEl.onloadedmetadata = null;
                videoEl.srcObject = null;
            }
            
            if (this.currentObjectUrl) {
                try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) {}
                this.currentObjectUrl = null;
            }
        },

        isVideoMirrored: function(videoEl) {
            if (!this.isFrontCamera) return false;
            if (!videoEl) return true;
            
            if (videoEl.classList.contains('mirror') || 
                videoEl.classList.contains('-scale-x-1') || 
                videoEl.classList.contains('scale-x-[-1]')) {
                return true;
            }
            if (videoEl.classList.contains('no-mirror')) {
                return false;
            }

            try {
                var style = window.getComputedStyle(videoEl);
                var transform = style.transform || style.webkitTransform || '';
                if (transform && transform !== 'none') {
                    if (transform.includes('matrix(-1') || transform.includes('matrix3d(-1')) {
                        return true;
                    }
                }
            } catch (e) {}
            return true;
        },

        hasAbsenToday: function(employeeName) {
            if (!employeeName) return false;
            var todayStr = this.getSafeWIBDateString(new Date());
            var rekapRaw = this.safeStoreGet('rekapList', []);
            var rekapList = Array.isArray(rekapRaw) ? rekapRaw : [];
            return rekapList.some(function(r) { 
                return r && r.name && r.date && 
                       String(r.name).trim().toLowerCase() === String(employeeName).trim().toLowerCase() && 
                       String(r.date).trim() === todayStr; 
            });
        },

        handleAbsen: function(triggerBtn) {
            var self = this;
            var nowTs = Date.now();
            if (nowTs - self.lastInteractionTimestamp < 600) return;
            self.lastInteractionTimestamp = nowTs;

            if (self.isDetectingLocation) return;

            if (typeof Store === 'undefined' || typeof CONFIG === 'undefined') {
                if (typeof showToast === 'function') showToast('Sistem belum siap. Silakan muat ulang halaman.', 'error');
                return;
            }

            var session = self.safeStoreGet('activeEmployeeSession', null);
            if (!session || !session.name || session.name === 'Tamu') {
                if (typeof showToast === 'function') showToast('Silakan login terlebih dahulu.', 'error');
                if (typeof switchMobileTab === 'function') switchMobileTab('daftar');
                return;
            }

            if (self.hasAbsenToday(session.name)) {
                if (typeof showToast === 'function') showToast('Anda sudah absen hari ini. Hanya 1 kali absen per hari.', 'warning');
                return;
            }

            var now = new Date();
            var wib = self.getSafeWIBTimeParts(now);
            var hNum = parseInt(wib.h, 10);
            var mNum = parseInt(wib.m, 10);
            var sNum = parseInt(wib.s, 10);
            var currentTimeInSeconds = (isNaN(hNum) ? 0 : hNum) * 3600 + (isNaN(mNum) ? 0 : mNum) * 60 + (isNaN(sNum) ? 0 : sNum);
            
            var openTimeStr = (CONFIG.ATTENDANCE && CONFIG.ATTENDANCE.OPEN_TIME) ? CONFIG.ATTENDANCE.OPEN_TIME : '00:00:00';
            var limitOpenInSeconds = self.parseTimeStringToSeconds(openTimeStr, 0);

            if (currentTimeInSeconds < limitOpenInSeconds) {
                if (typeof showToast === 'function') showToast('Absensi belum dibuka. Mulai ' + openTimeStr + ' WIB.', 'warning');
                return;
            }

            if (!navigator.geolocation) {
                if (typeof showToast === 'function') showToast('Browser tidak mendukung GPS.', 'error');
                return;
            }

            var btn = triggerBtn || document.querySelector('#m-tab-absen button[onclick*="handleAbsen"]') || document.querySelector('button[onclick*="handleAbsen"]');
            if (!btn && document.activeElement && document.activeElement.tagName === 'BUTTON') {
                btn = document.activeElement;
            }

            self.isDetectingLocation = true;
            if (btn && typeof setButtonLoading === 'function') {
                setButtonLoading(btn, 'Mendeteksi lokasi...');
            }

            var watchResolved = false;

            if (self.gpsWatchdogTimerId) clearTimeout(self.gpsWatchdogTimerId);
            self.gpsWatchdogTimerId = setTimeout(function() {
                if (!watchResolved) {
                    watchResolved = true;
                    self.isDetectingLocation = false;
                    if (btn && typeof resetButtonLoading === 'function') resetButtonLoading(btn);
                    if (typeof showToast === 'function') showToast('Waktu deteksi GPS habis. Periksa pengaturan lokasi perangkat.', 'error');
                }
            }, 18000);

            var processPositionSuccess = function(position) {
                if (watchResolved) return;
                watchResolved = true;
                if (self.gpsWatchdogTimerId) {
                    clearTimeout(self.gpsWatchdogTimerId);
                    self.gpsWatchdogTimerId = null;
                }

                self.isDetectingLocation = false;
                if (btn && typeof resetButtonLoading === 'function') resetButtonLoading(btn);

                if (!position || !position.coords) {
                    if (typeof showToast === 'function') showToast('Gagal membaca data koordinat GPS.', 'error');
                    return;
                }

                var accuracy = (typeof position.coords.accuracy === 'number') ? position.coords.accuracy : 999;
                var maxAccuracy = (CONFIG.GPS && CONFIG.GPS.MAX_ACCURACY) ? CONFIG.GPS.MAX_ACCURACY : 150;

                if (accuracy > maxAccuracy) {
                    if (typeof showToast === 'function') showToast('Akurasi GPS terlalu rendah (' + Math.round(accuracy) + 'm). Coba lagi di lokasi terbuka.', 'warning');
                    return;
                }

                var userLat = position.coords.latitude;
                var userLng = position.coords.longitude;

                if (userLat == null || userLng == null || isNaN(userLat) || isNaN(userLng) || userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
                    if (typeof showToast === 'function') showToast('Koordinat GPS perangkat tidak valid.', 'error');
                    return;
                }

                var koordEl = document.getElementById('koordinat-display');
                if (koordEl) {
                    koordEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> Koordinat: ' + userLat.toFixed(5) + ', ' + userLng.toFixed(5);
                }

                var basecampsRaw = self.safeStoreGet('basecamps', []);
                var basecamps = Array.isArray(basecampsRaw) ? basecampsRaw : [];
                var defaultRadius = (CONFIG.GPS && CONFIG.GPS.DEFAULT_RADIUS) ? parseFloat(CONFIG.GPS.DEFAULT_RADIUS) : 100;
                
                var validBasecamp = null;
                var minDistance = Infinity;

                for (var i = 0; i < basecamps.length; i++) {
                    var bc = basecamps[i];
                    if (!bc || bc.lat == null) continue;
                    
                    var rawLatInput = String(bc.lat).trim();
                    var rawLngInput = bc.lng != null ? String(bc.lng).trim() : '';

                    if (!rawLngInput && (rawLatInput.includes(';') || rawLatInput.includes(','))) {
                        var delim = rawLatInput.includes(';') ? ';' : ',';
                        var parts = rawLatInput.split(delim);
                        if (parts.length >= 2) {
                            rawLatInput = parts[0].trim();
                            rawLngInput = parts[1].trim();
                        }
                    }

                    var bcLat = self.parseCoordinateValue(rawLatInput);
                    var bcLng = self.parseCoordinateValue(rawLngInput);
                    
                    var parsedRadius = parseFloat(bc.radius);
                    var bcRadius = !isNaN(parsedRadius) && parsedRadius > 0 ? parsedRadius : defaultRadius;

                    if (isNaN(bcLat) || isNaN(bcLng) || bcLat < -90 || bcLat > 90 || bcLng < -180 || bcLng > 180) continue;

                    var dist = self.safeCalculateDistance(userLat, userLng, bcLat, bcLng);
                    if (!isNaN(dist) && isFinite(dist) && dist <= bcRadius) {
                        if (dist < minDistance) {
                            minDistance = dist;
                            validBasecamp = bc;
                        }
                    }
                }

                var strictGeofence = (CONFIG.GPS && CONFIG.GPS.STRICT_GEOFENCE === true);
                if (!validBasecamp && strictGeofence) {
                    if (typeof showToast === 'function') showToast('Anda berada di luar radius basecamp resmi yang diizinkan.', 'error');
                    return;
                }

                var dateStr = self.getSafeWIBDateString(now);

                var savedOk = self.safeStoreSet('pendingAbsenData', {
                    timestamp: Date.now(),
                    date: dateStr,
                    name: String(session.name).trim(),
                    basecamp: validBasecamp ? String(validBasecamp.name).trim() : 'Dinas Luar / Lapangan (Terverifikasi GPS)',
                    lat: userLat,
                    lng: userLng,
                    accuracy: accuracy
                });

                if (!savedOk) return;
                self.openSelfieModal();
            };

            var processPositionError = function() {
                if (watchResolved) return;
                
                navigator.geolocation.getCurrentPosition(
                    processPositionSuccess,
                    function(fallbackErr) {
                        if (watchResolved) return;
                        watchResolved = true;
                        if (self.gpsWatchdogTimerId) {
                            clearTimeout(self.gpsWatchdogTimerId);
                            self.gpsWatchdogTimerId = null;
                        }

                        self.isDetectingLocation = false;
                        if (btn && typeof resetButtonLoading === 'function') resetButtonLoading(btn);

                        var errMsg = 'Gagal mendeteksi GPS.';
                        if (fallbackErr && fallbackErr.code === fallbackErr.PERMISSION_DENIED) errMsg = 'Izin akses lokasi ditolak.';
                        else if (fallbackErr && fallbackErr.code === fallbackErr.POSITION_UNAVAILABLE) errMsg = 'Sinyal GPS tidak tersedia.';
                        else if (fallbackErr && fallbackErr.code === fallbackErr.TIMEOUT) errMsg = 'Waktu deteksi GPS habis. Periksa sinyal lokasi.';
                        if (typeof showToast === 'function') showToast(errMsg, 'error');
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                );
            };

            navigator.geolocation.getCurrentPosition(
                processPositionSuccess,
                processPositionError,
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
            );
        },

        openSelfieModal: function() {
            var self = this;
            var pendingData = self.safeStoreGet('pendingAbsenData', null);
            if (!pendingData) {
                if (typeof showToast === 'function') showToast('Data lokasi belum terverifikasi. Silakan klik tombol Absen kembali.', 'warning');
                return;
            }

            var manualBtnExisting = document.getElementById('btn-manual-camera-retry');
            if (manualBtnExisting) manualBtnExisting.remove();

            self.stopCurrentCameraStream();
            self.captureSessionId++;
            var activeSession = self.captureSessionId;

            var modal = document.getElementById('selfie-modal');
            var video = document.getElementById('selfie-video');
            var canvas = document.getElementById('selfie-canvas');
            var preview = document.getElementById('selfie-preview');
            var frameGuide = document.getElementById('selfie-frame-guide');
            
            var btnCapture = document.getElementById('btn-capture');
            var btnRetake = document.getElementById('btn-retake');
            var btnSubmit = document.getElementById('btn-submit-absen');

            if (modal) modal.classList.remove('hidden');
            if (video) {
                video.classList.remove('hidden');
                video.setAttribute('playsinline', 'true');
                video.setAttribute('autoplay', 'true');
                video.setAttribute('muted', 'true');
                video.muted = true;
            }
            if (canvas) canvas.classList.add('hidden');
            if (preview) {
                preview.classList.add('hidden');
                preview.src = '';
            }
            if (frameGuide) frameGuide.classList.remove('hidden');

            if (btnCapture) btnCapture.classList.remove('hidden');
            if (btnRetake) btnRetake.classList.add('hidden');
            if (btnSubmit) {
                btnSubmit.classList.add('hidden');
                btnSubmit.disabled = true;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (typeof showToast === 'function') showToast('Browser Anda tidak mendukung akses kamera.', 'error');
                return;
            }

            self.isFrontCamera = true;
            var constraints = {
                video: {
                    facingMode: { ideal: 'user' },
                    width: { ideal: 720 },
                    height: { ideal: 960 }
                }
            };

            function handleStreamSuccess(stream) {
                var currentModal = document.getElementById('selfie-modal');
                if (activeSession !== self.captureSessionId || !currentModal || currentModal.classList.contains('hidden')) {
                    if (stream && stream.getTracks) {
                        stream.getTracks().forEach(function(t) { t.stop(); });
                    }
                    return;
                }

                self.currentMediaStream = stream;

                if (video) {
                    video.onloadedmetadata = function() {
                        if (activeSession === self.captureSessionId) {
                            var playPromise = video.play();
                            if (playPromise && typeof playPromise.catch === 'function') {
                                playPromise.catch(function() {});
                            }
                        }
                    };
                    video.srcObject = stream;
                    if (video.readyState >= 1) {
                        var playPromise2 = video.play();
                        if (playPromise2 && typeof playPromise2.catch === 'function') {
                            playPromise2.catch(function() {});
                        }
                    }
                }
            }

            navigator.mediaDevices.getUserMedia(constraints)
                .then(handleStreamSuccess)
                .catch(function() {
                    if (activeSession !== self.captureSessionId) return;
                    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                        .then(handleStreamSuccess)
                        .catch(function() {
                            if (activeSession !== self.captureSessionId) return;
                            self.isFrontCamera = false;
                            navigator.mediaDevices.getUserMedia({ video: true })
                                .then(handleStreamSuccess)
                                .catch(function(finalErr) {
                                    if (activeSession === self.captureSessionId) {
                                        if (video) video.classList.add('hidden');
                                        if (frameGuide) frameGuide.classList.add('hidden');
                                        if (btnCapture) btnCapture.classList.add('hidden');
                                        
                                        var manualBtn = document.getElementById('btn-manual-camera-retry');
                                        if (!manualBtn && modal) {
                                            manualBtn = document.createElement('button');
                                            manualBtn.id = 'btn-manual-camera-retry';
                                            manualBtn.type = 'button';
                                            manualBtn.className = 'mt-4 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition';
                                            manualBtn.innerHTML = '<i class="fa-solid fa-camera mr-2"></i> Ketuk untuk Mengaktifkan Kamera';
                                            manualBtn.onclick = function() {
                                                manualBtn.remove();
                                                self.openSelfieModal();
                                            };
                                            var modalContent = modal.querySelector('.modal-content, div > div') || modal.firstElementChild;
                                            if (modalContent) modalContent.appendChild(manualBtn);
                                        }
                                        if (typeof showToast === 'function') {
                                            showToast('Akses kamera memerlukan izin manual. Silakan ketuk tombol aktifkan.', 'warning');
                                        }
                                    }
                                });
                        });
                });
        },

        captureSelfie: function() {
            var self = this;
            var nowTs = Date.now();
            if (nowTs - self.lastInteractionTimestamp < 600) return;
            self.lastInteractionTimestamp = nowTs;

            var video = document.getElementById('selfie-video');
            var canvas = document.getElementById('selfie-canvas');
            var preview = document.getElementById('selfie-preview');
            var frameGuide = document.getElementById('selfie-frame-guide');
            var btnSubmit = document.getElementById('btn-submit-absen');
            var btnCapture = document.getElementById('btn-capture');
            var btnRetake = document.getElementById('btn-retake');

            if (!video || !canvas || !preview) return;

            if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
                if (typeof showToast === 'function') showToast('Kamera belum siap sepenuhnya, silakan tunggu sejenak.', 'warning');
                return;
            }

            if (self.currentMediaStream && self.currentMediaStream.getTracks) {
                var hasLiveTrack = self.currentMediaStream.getTracks().some(function(t) { return t.readyState === 'live' && t.muted === false; });
                if (!hasLiveTrack) {
                    if (typeof showToast === 'function') showToast('Kamera terputus atau tidak aktif. Silakan ambil ulang.', 'error');
                    return;
                }
            }

            var rawW = (video.videoWidth > 0) ? video.videoWidth : 720;
            var rawH = (video.videoHeight > 0) ? video.videoHeight : 960;
            var containerW = (video.clientWidth > 0) ? video.clientWidth : rawW;
            var containerH = (video.clientHeight > 0) ? video.clientHeight : rawH;
            if (containerH <= 0) containerH = 1;
            if (rawH <= 0) rawH = 1;

            var containerAspect = containerW / containerH;
            var rawAspect = rawW / rawH;
            var sx = 0, sy = 0, sW = rawW, sH = rawH;

            if (rawAspect > containerAspect) {
                sW = rawH * containerAspect;
                sx = Math.max(0, (rawW - sW) / 2);
            } else if (rawAspect < containerAspect) {
                sH = rawW / containerAspect;
                sy = Math.max(0, (rawH - sH) / 2);
            }

            var MAX_DIM = 1280;
            var targetW = sW;
            var targetH = sH;

            if (sW > MAX_DIM || sH > MAX_DIM) {
                if (sW > sH) {
                    targetW = MAX_DIM;
                    targetH = Math.max(1, Math.round((sH * MAX_DIM) / sW));
                } else {
                    targetH = MAX_DIM;
                    targetW = Math.max(1, Math.round((sW * MAX_DIM) / sH));
                }
            }

            canvas.width = Math.max(1, Math.round(targetW));
            canvas.height = Math.max(1, Math.round(targetH));
            
            var ctx = null;
            try {
                ctx = canvas.getContext('2d', { willReadFrequently: true });
            } catch (e) {
                try {
                    ctx = canvas.getContext('2d');
                } catch (err2) {}
            }

            if (!ctx) {
                if (typeof showToast === 'function') showToast('Gagal menginisialisasi konteks gambar.', 'error');
                return;
            }

            try {
                ctx.save();
                if (self.isVideoMirrored(video)) {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(video, sx, sy, sW, sH, 0, 0, canvas.width, canvas.height);
                ctx.restore();
            } catch (e) {
                if (typeof showToast === 'function') showToast('Gagal memproses bingkai video.', 'error');
                return;
            }

            video.classList.add('hidden');
            if (frameGuide) frameGuide.classList.add('hidden');
            if (btnCapture) btnCapture.classList.add('hidden');
            if (btnRetake) btnRetake.classList.remove('hidden');

            if (btnSubmit) {
                btnSubmit.classList.remove('hidden');
                btnSubmit.disabled = true;
            }

            var supportsWebP = self.checkWebPSupport();
            var mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
            var quality = supportsWebP ? 0.8 : 0.7;

            self.captureSessionId++;
            var currentSession = self.captureSessionId;

            function processBlob(blob) {
                if (currentSession !== self.captureSessionId) return;

                if (!blob) {
                    if (typeof showToast === 'function') showToast('Gagal memproses foto. Silakan ambil ulang.', 'error');
                    return;
                }

                if (blob.size > 5 * 1024 * 1024) {
                    if (typeof showToast === 'function') showToast('Ukuran foto terlalu besar. Silakan ambil ulang.', 'warning');
                    return;
                }

                self.currentCapturedBlob = blob;
                self.currentCapturedMimeType = blob.type || mimeType;

                if (self.currentObjectUrl) {
                    try { URL.revokeObjectURL(self.currentObjectUrl); } catch(e) {}
                }
                
                try {
                    self.currentObjectUrl = URL.createObjectURL(blob);
                    preview.src = self.currentObjectUrl;
                    preview.classList.remove('hidden');
                    if (btnSubmit) btnSubmit.disabled = false;
                } catch (e) {
                    if (typeof showToast === 'function') showToast('Gagal merender pratinjau gambar.', 'error');
                }
            }

            if (canvas.toBlob) {
                canvas.toBlob(processBlob, mimeType, quality);
            } else {
                try {
                    var dataUrl = canvas.toDataURL(mimeType, quality);
                    var arr = dataUrl.split(',');
                    if (arr.length < 2) throw new Error('Format Data URL tidak valid');
                    
                    var headerMatches = dataUrl.match(/^data:(.*?);base64,/);
                    var actualMime = (headerMatches && headerMatches[1]) ? headerMatches[1] : mimeType;
                    
                    var cleanBase64 = arr[1].replace(/[^A-Za-z0-9+/=]/g, '');
                    while (cleanBase64.length % 4 !== 0) {
                        cleanBase64 += '=';
                    }
                    
                    var bstr = atob(cleanBase64);
                    var len = bstr.length;
                    var u8arr = new Uint8Array(len);
                    for (var i = 0; i < len; i++) {
                        u8arr[i] = bstr.charCodeAt(i);
                    }
                    var fallbackBlob = new Blob([u8arr], { type: actualMime });
                    processBlob(fallbackBlob);
                } catch (e) {
                    if (typeof showToast === 'function') showToast('Gagal memproses gambar pada peramban ini.', 'error');
                    self.retakeSelfie();
                }
            }
        },

        retakeSelfie: function() {
            var self = this;
            var nowTs = Date.now();
            if (nowTs - self.lastInteractionTimestamp < 400) return;
            self.lastInteractionTimestamp = nowTs;

            self.captureSessionId++;
            
            var video = document.getElementById('selfie-video');
            var preview = document.getElementById('selfie-preview');
            var frameGuide = document.getElementById('selfie-frame-guide');

            if (self.currentObjectUrl) {
                try { URL.revokeObjectURL(self.currentObjectUrl); } catch(e) {}
                self.currentObjectUrl = null;
            }

            var manualBtn = document.getElementById('btn-manual-camera-retry');
            if (manualBtn) manualBtn.remove();

            if (video) video.classList.remove('hidden');
            if (preview) {
                preview.classList.add('hidden');
                preview.src = '';
            }
            if (frameGuide) frameGuide.classList.remove('hidden');

            var btnCapture = document.getElementById('btn-capture');
            var btnRetake = document.getElementById('btn-retake');
            var btnSubmit = document.getElementById('btn-submit-absen');

            if (btnCapture) btnCapture.classList.remove('hidden');
            if (btnRetake) btnRetake.classList.add('hidden');
            if (btnSubmit) {
                btnSubmit.classList.add('hidden');
                btnSubmit.disabled = true;
            }

            self.currentCapturedBlob = null;
            self.currentCapturedMimeType = null;
            self.openSelfieModal();
        },

        closeSelfieModal: function(forceClose) {
            var self = this;
            if (self.isSubmittingAbsen && !forceClose) {
                if (typeof showToast === 'function') showToast('Proses pengiriman absensi sedang berlangsung, mohon tunggu.', 'info');
                return;
            }

            self.captureSessionId++;
            self.stopCurrentCameraStream();
            
            self.currentCapturedBlob = null;
            self.currentCapturedMimeType = null;
            self.safeStoreSet('pendingAbsenData', null);

            var modal = document.getElementById('selfie-modal');
            var frameGuide = document.getElementById('selfie-frame-guide');
            var preview = document.getElementById('selfie-preview');
            var canvas = document.getElementById('selfie-canvas');
            var manualBtn = document.getElementById('btn-manual-camera-retry');
            if (manualBtn) manualBtn.remove();

            if (preview) preview.src = '';
            if (frameGuide) frameGuide.classList.add('hidden');
            if (modal) modal.classList.add('hidden');
            if (canvas) {
                try {
                    canvas.width = 1;
                    canvas.height = 1;
                    var ctx = canvas.getContext('2d');
                    if (ctx) ctx.clearRect(0, 0, 1, 1);
                } catch (e) {}
            }
        },

        fetchWithTimeout: function(asyncFn, ms) {
            return new Promise(function(resolve, reject) {
                var timerId = null;

                var timeoutPromise = new Promise(function(_, rej) {
                    timerId = setTimeout(function() {
                        rej(new Error('Waktu koneksi server habis (Timeout ' + Math.round(ms / 1000) + ' detik).'));
                    }, ms);
                });

                var targetPromise;
                try {
                    targetPromise = Promise.resolve(asyncFn());
                } catch (err) {
                    if (timerId) clearTimeout(timerId);
                    return reject(err);
                }

                Promise.race([
                    targetPromise.then(function(res) {
                        if (timerId) clearTimeout(timerId);
                        resolve(res);
                    }).catch(function(err) {
                        if (timerId) clearTimeout(timerId);
                        reject(err);
                    }),
                    timeoutPromise
                ]);
            });
        },

        parseSupabaseError: function(err, defaultMsg) {
            if (!err) return defaultMsg;
            if (typeof err === 'string') return err;
            if (err.name === 'AbortError' || (err.message && err.message.toLowerCase().includes('aborted'))) {
                return 'Koneksi terputus atau waktu permintaan habis.';
            }
            var parts = [];
            if (err.message) parts.push(err.message);
            if (err.details) parts.push(err.details);
            if (err.hint) parts.push('Hint: ' + err.hint);
            if (parts.length > 0) return parts.join(' - ');
            if (err.error_description) return err.error_description;
            return defaultMsg;
        },

        submitAbsenWithSelfie: async function() {
            var self = this;
            var nowTs = Date.now();
            if (nowTs - self.lastInteractionTimestamp < 1000) return;
            self.lastInteractionTimestamp = nowTs;

            if (self.isSubmittingAbsen) return;

            if (navigator.onLine === false) {
                if (typeof showToast === 'function') showToast('Tidak ada koneksi internet. Periksa jaringan Anda.', 'error');
                return;
            }

            if (typeof Store === 'undefined' || typeof supabaseClient === 'undefined') {
                if (typeof showToast === 'function') showToast('Koneksi sistem belum siap.', 'error');
                return;
            }

            if (!supabaseClient.storage || typeof supabaseClient.storage.from !== 'function' || typeof supabaseClient.from !== 'function') {
                if (typeof showToast === 'function') showToast('SDK Supabase belum terinisialisasi dengan benar.', 'error');
                return;
            }

            var pendingAbsenData = self.safeStoreGet('pendingAbsenData', null);
            if (!pendingAbsenData) {
                if (typeof showToast === 'function') showToast('Data absensi tidak ditemukan. Silakan ulangi.', 'error');
                return;
            }

            var session = self.safeStoreGet('activeEmployeeSession', null);
            if (!session || !session.id || !session.name) {
                if (typeof showToast === 'function') showToast('Sesi pengguna tidak valid. Silakan login kembali.', 'error');
                return;
            }

            var blob = self.currentCapturedBlob;
            if (!blob) {
                if (typeof showToast === 'function') showToast('Foto belum diambil.', 'error');
                return;
            }

            var btn = document.getElementById('btn-submit-absen');
            self.isSubmittingAbsen = true;

            if (btn) {
                btn.disabled = true;
                if (typeof setButtonLoading === 'function') setButtonLoading(btn, 'Mengunggah foto...');
            }

            var selfieUrl = null;
            var fileName = null;
            var bucketName = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE && CONFIG.STORAGE.BUCKET) ? CONFIG.STORAGE.BUCKET : 'attendance';

            try {
                var mimeType = self.currentCapturedMimeType || blob.type || 'image/jpeg';
                if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg';

                var ext = 'jpg';
                if (mimeType.includes('webp')) ext = 'webp';
                else if (mimeType.includes('png')) ext = 'png';
                else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';

                var cleanSessionId = String(session.id).replace(/[^a-zA-Z0-9_-]/g, '_');
                
                var rawFolder = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE && CONFIG.STORAGE.FOLDER) ? CONFIG.STORAGE.FOLDER : 'selfies';
                var cleanFolder = rawFolder.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_/-]/g, '');
                var folderPrefix = cleanFolder.length > 0 ? cleanFolder + '/' : '';
                
                var now = new Date();
                var fallbackDate = self.getSafeWIBDateString(now);
                var rawDate = pendingAbsenData.date || fallbackDate;
                var safeDate = String(rawDate).replace(/[^0-9-]/g, '') || fallbackDate;

                var uploadResult = null;
                var maxRetries = 2;
                var uploadAttemptError = null;

                for (var attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        var randomSuffix = Math.random().toString(36).substring(2, 8) + '_' + attempt;
                        fileName = (folderPrefix + safeDate + '_' + cleanSessionId + '_' + Date.now() + '_' + randomSuffix + '.' + ext).replace(/\/+/g, '/');

                        uploadResult = await self.fetchWithTimeout(function() {
                            return supabaseClient
                                .storage
                                .from(bucketName)
                                .upload(fileName, blob, {
                                    contentType: mimeType,
                                    cacheControl: '3600',
                                    upsert: false
                                });
                        }, 18000);

                        if (uploadResult && !uploadResult.error && uploadResult.data && uploadResult.data.path) break;
                        uploadAttemptError = uploadResult && uploadResult.error ? uploadResult.error : new Error('Gagal mengunggah foto ke server.');
                        if (attempt === maxRetries) throw uploadAttemptError;
                    } catch (netErr) {
                        uploadAttemptError = netErr;
                        if (attempt === maxRetries) throw netErr;
                        await new Promise(function(r) { setTimeout(r, 1500); });
                    }
                }

                if (!uploadResult || uploadResult.error || !uploadResult.data || !uploadResult.data.path) {
                    throw (uploadAttemptError || new Error('Gagal mengunggah foto ke server.'));
                }

                var urlData = null;
                try {
                    var urlResult = supabaseClient.storage.from(bucketName).getPublicUrl(fileName);
                    if (urlResult) {
                        if (urlResult.data && urlResult.data.publicUrl) {
                            urlData = urlResult.data.publicUrl;
                        } else if (urlResult.publicUrl) {
                            urlData = urlResult.publicUrl;
                        } else if (urlResult.publicURL) {
                            urlData = urlResult.publicURL;
                        } else if (typeof urlResult === 'string') {
                            urlData = urlResult;
                        }
                    }
                } catch (urlErr) {
                    console.error('Error generating public URL:', urlErr);
                }

                selfieUrl = urlData;
                if (!selfieUrl) {
                    if (fileName) {
                        try {
                            await self.fetchWithTimeout(function() {
                                return supabaseClient.storage.from(bucketName).remove([fileName]);
                            }, 10000);
                        } catch (cleanupErr) {
                            console.error('Storage rollback error:', cleanupErr);
                        }
                    }
                    throw new Error('Gagal mendapatkan tautan publik foto absensi.');
                }

                var wib = self.getSafeWIBTimeParts(now);
                var safeH = String(wib.h != null ? wib.h : 0).padStart(2, '0');
                var safeM = String(wib.m != null ? wib.m : 0).padStart(2, '0');
                var safeS = String(wib.s != null ? wib.s : 0).padStart(2, '0');
                var timeString = safeH + ':' + safeM + ':' + safeS;
                                 
                var dateStr = safeDate;

                var status = 'Tepat Waktu';
                var lateStr = '-';
                var maxTimeStr = (typeof CONFIG !== 'undefined' && CONFIG.ATTENDANCE && CONFIG.ATTENDANCE.MAX_TIME) ? CONFIG.ATTENDANCE.MAX_TIME : '08:00:00';
                var limitMaxInSeconds = self.parseTimeStringToSeconds(maxTimeStr, 28800);
                
                var parsedH = parseInt(safeH, 10);
                var parsedM = parseInt(safeM, 10);
                var parsedS = parseInt(safeS, 10);
                var currentS = (isNaN(parsedH) ? 0 : parsedH) * 3600 + (isNaN(parsedM) ? 0 : parsedM) * 60 + (isNaN(parsedS) ? 0 : parsedS);

                if (!isNaN(limitMaxInSeconds) && currentS > limitMaxInSeconds) {
                    status = 'Terlambat';
                    var diff = currentS - limitMaxInSeconds;
                    var dh = Math.floor(diff / 3600);
                    var dm = Math.floor((diff % 3600) / 60);
                    var ds = diff % 60;
                    lateStr = String(dh).padStart(2, '0') + ':' + 
                              String(dm).padStart(2, '0') + ':' + 
                              String(ds).padStart(2, '0');
                }

                var newRekap = {
                    date: dateStr,
                    name: String(pendingAbsenData.name).trim(),
                    basecamp: String(pendingAbsenData.basecamp).trim(),
                    time: timeString,
                    status: status,
                    late: lateStr,
                    selfie_url: selfieUrl,
                    lat: pendingAbsenData.lat || null,
                    lng: pendingAbsenData.lng || null,
                    accuracy: pendingAbsenData.accuracy || null
                };

                var insertResult = await self.fetchWithTimeout(function() {
                    return supabaseClient.from('rekap_list').insert([newRekap]).select();
                }, 15000);
                
                if (!insertResult || insertResult.error) {
                    if (fileName) {
                        try {
                            await self.fetchWithTimeout(function() {
                                return supabaseClient.storage.from(bucketName).remove([fileName]);
                            }, 10000);
                        } catch (cleanupErr) {
                            console.error('Storage rollback error:', cleanupErr);
                        }
                    }
                    throw (insertResult ? insertResult.error : new Error('Gagal menyimpan ke database.'));
                }

                var rekapRaw = self.safeStoreGet('rekapList', []);
                var rekapList = Array.isArray(rekapRaw) ? rekapRaw : [];
                
                if (insertResult.data && Array.isArray(insertResult.data) && insertResult.data.length > 0 && insertResult.data[0]) {
                    rekapList.push(insertResult.data[0]);
                } else {
                    rekapList.push(newRekap);
                }
                
                self.safeStoreSet('rekapList', rekapList.slice());

                if (typeof showToast === 'function') showToast('Absen berhasil! Jam: ' + timeString + ' WIB', 'success');

                var jamMasukEl = document.getElementById('mobile-jam-masuk');
                if (jamMasukEl) jamMasukEl.innerText = timeString + ' WIB';

                self.closeSelfieModal(true);

                if (typeof renderRekap === 'function') renderRekap();
                if (typeof renderMobileMyHistory === 'function') renderMobileMyHistory();
                if (typeof updateDashboardStats === 'function') updateDashboardStats();

            } catch (err) {
                console.error('Error submit absensi:', err);
                var message = self.parseSupabaseError(err, 'Gagal menyimpan absensi.');
                if (typeof showToast === 'function') showToast(message, 'error');
            } finally {
                self.isSubmittingAbsen = false;
                if (btn) {
                    btn.disabled = false;
                    if (typeof resetButtonLoading === 'function') resetButtonLoading(btn);
                }
            }
        }
    };

    AttendanceModule.init();

    window.handleAbsen = function(btn) { AttendanceModule.handleAbsen(btn); };
    window.openSelfieModal = function() { AttendanceModule.openSelfieModal(); };
    window.captureSelfie = function() { AttendanceModule.captureSelfie(); };
    window.retakeSelfie = function() { AttendanceModule.retakeSelfie(); };
    window.closeSelfieModal = function(f) { AttendanceModule.closeSelfieModal(f); };
    window.submitAbsenWithSelfie = function() { AttendanceModule.submitAbsenWithSelfie(); };

})(window, document);