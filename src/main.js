// Fungsi Generator Browser Fingerprint yang Stabil & Mendukung Hybrid App (Capacitor/Cordova)
async function getOrCreateStableDeviceIdentifier() {
    let deviceId = localStorage.getItem('bc_device_uuid');
    if (deviceId) return deviceId;

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
        try {
            const info = await window.Capacitor.Plugins.Device.getId();
            if (info && info.identifier) {
                deviceId = 'NATIVE-' + info.identifier;
                localStorage.setItem('bc_device_uuid', deviceId);
                return deviceId;
            }
        } catch (e) {
            console.warn('Native device bridge not accessible, falling back to browser fingerprint.');
        }
    }

    const fingerprintComponents = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown'
    ].join('|||');

    let hash = 0;
    for (let i = 0; i < fingerprintComponents.length; i++) {
        const char = fingerprintComponents.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }

    deviceId = 'FP-' + Math.abs(hash).toString(36).toUpperCase() + '-' + Math.abs(screen.width * screen.height).toString(36).toUpperCase();
    localStorage.setItem('bc_device_uuid', deviceId);
    document.cookie = `bc_device_uuid=${deviceId}; max-age=31536000; path=/; SameSite=Strict`;

    return deviceId;
}

// Fungsi Deteksi Mock Location / Fake GPS secara Native (Capacitor / Cordova) & Web Properti
async function checkIsMockLocation(coords) {
    if (coords && coords.isMocked === true) {
        return true;
    }

    if (window.Capacitor && window.Capacitor.Plugins) {
        try {
            if (window.Capacitor.Plugins.Location && typeof window.Capacitor.Plugins.Location.isMocked === 'function') {
                const res = await window.Capacitor.Plugins.Location.isMocked();
                if (res && (res.isMocked || res.value === true)) {
                    return true;
                }
            }
            if (window.Capacitor.Plugins.MockLocation && typeof window.Capacitor.Plugins.MockLocation.check === 'function') {
                const res = await window.Capacitor.Plugins.MockLocation.check();
                if (res && res.isMocked) {
                    return true;
                }
            }
        } catch (e) {
            console.warn('Native mock location plugin check warning:', e);
        }
    }

    return false;
}

// Simulasi Sisi Server (Backend API Simulation) dengan Server-Side Timestamp Enforcement
async function simulateServerSideValidation(payload) {
    return new Promise((resolve) => {
        setTimeout(async () => {
            const { loginId, loginPass, currentCoords, gpsAccuracy, simulationMode, deviceId } = payload;
            
            const serverEmployees = JSON.parse(localStorage.getItem('bc_employees')) || [];
            const serverBasecamps = JSON.parse(localStorage.getItem('bc_basecamps')) || [];
            const serverAttendance = JSON.parse(localStorage.getItem('bc_attendance')) || [];

            const emp = serverEmployees.find(e => e.id === loginId && e.password === loginPass);
            if (!emp) {
                resolve({ success: false, message: 'ID Karyawan atau Password salah!' });
                return;
            }

            if (!emp.deviceId) {
                emp.deviceId = deviceId;
                localStorage.setItem('bc_employees', JSON.stringify(serverEmployees));
            } else if (emp.deviceId !== deviceId && !simulationMode) {
                resolve({ success: false, message: 'Akses ditolak! Akun ini sudah terikat dengan perangkat HP lain. Hubungi Administrator.' });
                return;
            }

            // GENERASI WAKTU DARI SERVER (Mencegah manipulasi jam klien)
            const serverNow = new Date();
            const serverDateToday = serverNow.toISOString().split('T')[0];
            const serverTimestampFormatted = serverNow.toLocaleString('id-ID');

            const alreadyCheckedIn = serverAttendance.some(log => log.empId === emp.id && log.date === serverDateToday);
            if (alreadyCheckedIn) {
                resolve({ success: false, message: 'Anda sudah melakukan check-in hari ini. Hanya diizinkan 1 kali sehari.' });
                return;
            }

            const isMockDetected = await checkIsMockLocation(currentCoords);
            if ((gpsAccuracy > 50 || isMockDetected) && !simulationMode) {
                resolve({ success: false, message: 'Check-in gagal (Server Validation): Terdeteksi penggunaan Fake GPS / Mock Location atau akurasi GPS buruk!' });
                return;
            }

            let verifiedBasecamp = null;
            if (simulationMode) {
                verifiedBasecamp = { name: 'Simulasi Basecamp (Admin)' };
            } else if (currentCoords) {
                for (let bc of serverBasecamps) {
                    const R = 6371e3;
                    const φ1 = currentCoords.lat * Math.PI/180;
                    const φ2 = bc.lat * Math.PI/180;
                    const Δφ = (bc.lat - currentCoords.lat) * Math.PI/180;
                    const Δλ = (bc.lng - currentCoords.lng) * Math.PI/180;
                    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                              Math.cos(φ1) * Math.cos(φ2) *
                              Math.sin(Δλ/2) * Math.sin(Δλ/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distance = R * c;

                    if (distance <= bc.radius) {
                        verifiedBasecamp = bc;
                        break;
                    }
                }
            }

            if (!verifiedBasecamp && !simulationMode) {
                resolve({ success: false, message: 'Validasi Server Gagal: Koordinat Anda berada di luar radius Basecamp manapun!' });
                return;
            }

            const basecampName = verifiedBasecamp ? verifiedBasecamp.name : 'Simulasi Basecamp (Admin)';

            const newLog = {
                id: Date.now(),
                empId: emp.id,
                name: emp.name,
                role: emp.role,
                basecamp: basecampName,
                timestamp: serverTimestampFormatted,
                date: serverDateToday,
                accuracy: gpsAccuracy || 5
            };

            serverAttendance.unshift(newLog);
            localStorage.setItem('bc_attendance', JSON.stringify(serverAttendance));

            resolve({ success: true, message: `Berhasil Check-in! Selamat bekerja, ${emp.name} di ${basecampName}.` });
        }, 400);
    });
}

// Daftarkan komponen menggunakan Alpine.init agar aman dari race-condition module Vite
document.addEventListener('alpine:init', () => {
    Alpine.data('absensiApp', () => ({
        isAdminView: false,
        isAdminLoggedIn: false,
        adminLoginUser: '',
        adminLoginPass: '',
        adminTab: 'rekap',
        simulationMode: false,
        isDesktopDevice: window.innerWidth >= 1024,
        
        employeeTab: 'checkin',

        loginId: '',
        loginPass: '',
        gpsStatus: 'Mendeteksi GPS...',
        gpsAccuracy: null,
        currentCoords: null,
        detectedBasecamp: null,

        leaveForm: {
            empId: '',
            type: 'Sakit',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            reason: ''
        },

        filterStartDate: new Date().toISOString().split('T')[0],
        filterEndDate: new Date().toISOString().split('T')[0],

        map: null,
        marker: null,
        circle: null,

        showBasecampModal: false,
        editBasecampIndex: null,
        basecampForm: { name: '', lat: -2.990934, lng: 104.756554, radius: 100 },

        showEmployeeModal: false,
        editEmployeeIndex: null,
        employeeForm: { id: '', name: '', role: '', password: '', deviceId: null },

        basecamps: JSON.parse(localStorage.getItem('bc_basecamps')) || [
            { id: 1, name: 'Basecamp Palembang', lat: -2.990934, lng: 104.756554, radius: 150 },
            { id: 2, name: 'Basecamp Padang', lat: -0.947083, lng: 100.354274, radius: 150 },
            { id: 3, name: 'Basecamp Pekanbaru', lat: 0.507068, lng: 101.447779, radius: 150 }
        ],
        employees: JSON.parse(localStorage.getItem('bc_employees')) || [
            { id: 'EMP001', name: 'Rudi Batubara', role: 'Project Coordinator', password: '123', deviceId: null },
            { id: 'EMP002', name: 'Ahmad Fauzi', role: 'Field Technician', password: '123', deviceId: null }
        ],
        attendanceLogs: JSON.parse(localStorage.getItem('bc_attendance')) || [],
        leaves: JSON.parse(localStorage.getItem('bc_leaves')) || [],

        async init() {
            this.initGPS();
            await getOrCreateStableDeviceIdentifier();
        },

        initGPS() {
            if (navigator.geolocation) {
                navigator.geolocation.watchPosition(
                    async (position) => {
                        const isMocked = position.coords.isMocked || await checkIsMockLocation(position.coords);
                        this.currentCoords = { 
                            lat: position.coords.latitude, 
                            lng: position.coords.longitude,
                            isMocked: isMocked 
                        };
                        this.gpsAccuracy = Math.round(position.coords.accuracy);
                        
                        if (this.gpsAccuracy > 50 || isMocked) {
                            this.gpsStatus = 'Peringatan: Terindikasi Mock / Fake GPS!';
                        } else {
                            this.gpsStatus = 'GPS Aman & Akurat';
                        }

                        this.checkNearestBasecamp(this.currentCoords.lat, this.currentCoords.lng);
                    },
                    (error) => {
                        this.gpsStatus = 'Gagal mendeteksi GPS. Aktifkan lokasi.';
                    },
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
                );
            } else {
                this.gpsStatus = 'Browser tidak mendukung GPS.';
            }
        },

        calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371e3;
            const φ1 = lat1 * Math.PI/180;
            const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180;
            const Δλ = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },

        checkNearestBasecamp(lat, lng) {
            let found = null;
            for (let bc of this.basecamps) {
                const dist = this.calculateDistance(lat, lng, bc.lat, bc.lng);
                if (dist <= bc.radius) {
                    found = bc;
                    break;
                }
            }
            this.detectedBasecamp = found;
        },

        switchRole() {
            this.isAdminView = !this.isAdminView;
            if (!this.isAdminView) {
                this.isAdminLoggedIn = false;
            }
        },

        handleAdminLogin() {
            if (this.adminLoginUser === 'admin' && this.adminLoginPass === 'admin123') {
                this.isAdminLoggedIn = true;
                this.adminLoginUser = '';
                this.adminLoginPass = '';
            } else {
                const emp = this.employees.find(e => e.id === this.adminLoginUser && e.password === this.adminLoginPass);
                if (emp && (emp.role.toLowerCase().includes('coordinator') || emp.role.toLowerCase().includes('manager') || emp.role.toLowerCase().includes('admin'))) {
                    this.isAdminLoggedIn = true;
                    this.adminLoginUser = '';
                    this.adminLoginPass = '';
                } else {
                    alert('ID/Username atau Password Admin/PM salah, atau hak akses tidak diizinkan!');
                }
            }
        },

        adminLogout() {
            this.isAdminLoggedIn = false;
            this.adminLoginUser = '';
            this.adminLoginPass = '';
        },

        async handleCheckIn() {
            if (!this.loginId || !this.loginPass) {
                alert('Masukkan ID Karyawan dan Password!');
                return;
            }

            const currentDeviceId = await getOrCreateStableDeviceIdentifier();
            
            const payload = {
                loginId: this.loginId,
                loginPass: this.loginPass,
                currentCoords: this.currentCoords,
                gpsAccuracy: this.gpsAccuracy,
                simulationMode: this.simulationMode,
                deviceId: currentDeviceId
            };

            this.gpsStatus = 'Memproses Validasi Server...';

            const result = await simulateServerSideValidation(payload);

            if (this.gpsAccuracy > 50 || (this.currentCoords && this.currentCoords.isMocked)) {
                this.gpsStatus = 'Peringatan: Terindikasi Mock / Fake GPS!';
            } else {
                this.gpsStatus = 'GPS Aman & Akurat';
            }

            if (!result.success) {
                alert(result.message);
                return;
            }

            alert(result.message);
            this.loginId = '';
            this.loginPass = '';
            
            this.attendanceLogs = JSON.parse(localStorage.getItem('bc_attendance')) || [];
            this.employees = JSON.parse(localStorage.getItem('bc_employees')) || [];
        },

        submitLeaveRequest() {
            const emp = this.employees.find(e => e.id === this.leaveForm.empId);
            if (!emp) {
                alert('ID Karyawan tidak ditemukan dalam sistem!');
                return;
            }

            const newLeave = {
                id: Date.now(),
                empId: emp.id,
                name: emp.name,
                type: this.leaveForm.type,
                startDate: this.leaveForm.startDate,
                endDate: this.leaveForm.endDate,
                reason: this.leaveForm.reason,
                status: 'Pending',
                timestamp: new Date().toLocaleString('id-ID')
            };

            this.leaves.unshift(newLeave);
            localStorage.setItem('bc_leaves', JSON.stringify(this.leaves));
            alert('Pengajuan izin/sakit berhasil dikirim dan menunggu persetujuan Admin/PM.');
            this.leaveForm.reason = '';
        },

        updateLeaveStatus(id, status) {
            const idx = this.leaves.findIndex(l => l.id === id);
            if (idx !== -1) {
                this.leaves[idx].status = status;
                localStorage.setItem('bc_leaves', JSON.stringify(this.leaves));
                alert(`Pengajuan berhasil diubah statusnya menjadi: ${status}`);
            }
        },

        get employeeLeaves() {
            if (!this.leaveForm.empId) return [];
            return this.leaves.filter(l => l.empId === this.leaveForm.empId);
        },

        initMap() {
            const lat = parseFloat(this.basecampForm.lat) || -2.990934;
            const lng = parseFloat(this.basecampForm.lng) || 104.756554;
            const radius = parseInt(this.basecampForm.radius) || 100;

            if (!this.map) {
                this.map = L.map('basecampMap').setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(this.map);

                this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
                this.circle = L.circle([lat, lng], { radius: radius, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 }).addTo(this.map);

                this.marker.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    this.basecampForm.lat = parseFloat(pos.lat.toFixed(6));
                    this.basecampForm.lng = parseFloat(pos.lng.toFixed(6));
                    this.updateMapVisuals();
                });

                this.map.on('click', (e) => {
                    this.basecampForm.lat = parseFloat(e.latlng.lat.toFixed(6));
                    this.basecampForm.lng = parseFloat(e.latlng.lng.toFixed(6));
                    this.marker.setLatLng(e.latlng);
                    this.updateMapVisuals();
                });
            } else {
                this.map.invalidateSize();
                this.map.setView([lat, lng], 15);
                this.marker.setLatLng([lat, lng]);
                this.circle.setLatLng([lat, lng]);
                this.circle.setRadius(radius);
            }
        },

        updateMapVisuals() {
            const lat = parseFloat(this.basecampForm.lat);
            const lng = parseFloat(this.basecampForm.lng);
            const radius = parseInt(this.basecampForm.radius) || 100;
            if (!isNaN(lat) && !isNaN(lng)) {
                this.circle.setLatLng([lat, lng]);
                this.circle.setRadius(radius);
            }
        },

        updateMapFromInputs() {
            const lat = parseFloat(this.basecampForm.lat);
            const lng = parseFloat(this.basecampForm.lng);
            const radius = parseInt(this.basecampForm.radius) || 100;
            if (!isNaN(lat) && !isNaN(lng) && this.map) {
                this.marker.setLatLng([lat, lng]);
                this.circle.setLatLng([lat, lng]);
                this.circle.setRadius(radius);
                this.map.setView([lat, lng], this.map.getZoom());
            }
        },

        openBasecampModal() {
            this.editBasecampIndex = null;
            this.basecampForm = { name: '', lat: -2.990934, lng: 104.756554, radius: 150 };
            this.showBasecampModal = true;
            this.$nextTick(() => {
                this.initMap();
            });
        },
        editBasecamp(index) {
            this.editBasecampIndex = index;
            this.basecampForm = { ...this.basecamps[index] };
            this.showBasecampModal = true;
            this.$nextTick(() => {
                this.initMap();
            });
        },
        saveBasecamp() {
            if (this.editBasecampIndex !== null) {
                this.basecamps[this.editBasecampIndex] = { ...this.basecampForm, id: this.basecamps[this.editBasecampIndex].id };
            } else {
                this.basecampForm.id = Date.now();
                this.basecamps.push({ ...this.basecampForm });
            }
            localStorage.setItem('bc_basecamps', JSON.stringify(this.basecamps));
            this.showBasecampModal = false;
        },
        deleteBasecamp(index) {
            if (confirm('Hapus basecamp ini?')) {
                this.basecamps.splice(index, 1);
                localStorage.setItem('bc_basecamps', JSON.stringify(this.basecamps));
            }
        },

        openEmployeeModal() {
            this.editEmployeeIndex = null;
            this.employeeForm = { id: '', name: '', role: '', password: '', deviceId: null };
            this.showEmployeeModal = true;
        },
        editEmployee(index) {
            this.editEmployeeIndex = index;
            this.employeeForm = { ...this.employees[index] };
            this.showEmployeeModal = true;
        },
        saveEmployee() {
            if (this.editEmployeeIndex !== null) {
                this.employees[this.editEmployeeIndex] = { ...this.employeeForm };
            } else {
                this.employees.push({ ...this.employeeForm });
            }
            this.saveEmployeesToStorage();
            this.showEmployeeModal = false;
        },
        deleteEmployee(index) {
            if (confirm('Hapus data karyawan ini?')) {
                this.employees.splice(index, 1);
                this.saveEmployeesToStorage();
            }
        },
        resetDevice(index) {
            if (confirm(`Reset perangkat terikat untuk ${this.employees[index].name}?`)) {
                this.employees[index].deviceId = null;
                this.saveEmployeesToStorage();
                alert('Perangkat berhasil direset.');
            }
        },
        saveEmployeesToStorage() {
            localStorage.setItem('bc_employees', JSON.stringify(this.employees));
        },

        get filteredAttendance() {
            return this.attendanceLogs.filter(item => {
                return item.date >= this.filterStartDate && item.date <= this.filterEndDate;
            });
        },

        exportCSV() {
            let csvContent = "data:text/csv;charset=utf-8,ID,Nama,Role,Basecamp,Tanggal Waktu,Akurasi GPS\n";
            this.filteredAttendance.forEach(row => {
                csvContent += `"${row.empId}","${row.name}","${row.role}","${row.basecamp}","${row.timestamp}","${row.accuracy}m"\r\n`;
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `rekap_absensi_${this.filterStartDate}_sampai_${this.filterEndDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }));
});
