var Store = {
    state: {
        currentDeviceUUID: 'PENDING',
        holidays: [], // Tambahkan array ini (Format: [{ date: '2026-08-17', desc: 'Hari Kemerdekaan' }])
        roles: [],
        employees: [],
        basecamps: [],
        rekapList: [],
        izinList: [],
        emailsList: [],
        activeEmployeeSession: { name: 'Tamu', id: 'tamu@gmail.com', role: 'Tamu' },
        tempRegData: null,
        generatedOTP: null,
        otpExpiryTime: null,
        pendingAbsenData: null,
        mediaStream: null,
        capturedBlob: null,
        activeSelectedEmail: null,
        bcMap: null,
        bcMarkers: [],
        supabaseConnected: false,
        rekapPage: 0,
        rekapTotalCount: 0
    },
    set: function(key, value) {
        this.state[key] = value;
    },
    get: function(key) {
        return this.state[key];
    }
};
