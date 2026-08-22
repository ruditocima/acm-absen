let currentDeviceUUID = "PENDING";
let generatedOTP = null;
let otpExpiryTime = null;
let roles = [
    { id: 'ROL-01', name: 'Master Admin', access: 'Dashboard, Rekap, Role, Karyawan, Basecamp, Izin, Email' },
    { id: 'ROL-02', name: 'Manajer Lapangan', access: 'Dashboard, Rekap, Karyawan, Basecamp, Izin, Email' },
    { id: 'ROL-03', name: 'Karyawan / Field', access: 'Dashboard, Izin, Email' }
];
let employees = [];
let basecamps = [{ id: 1, name: 'Basecamp Pekanbaru Pusat', lat: 0.434291, lng: 101.466385, radius: 1500 }];
let rekapList = [];
let izinList = [];
let emailsList = [];
let activeEmployeeSession = { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' };
let tempRegData = null;
let pendingAbsenData = null;
let mediaStream = null;
let capturedBlob = null;
let activeSelectedEmail = null;
let bcMap = null;
let confirmCallback = null;