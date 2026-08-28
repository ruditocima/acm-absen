# ============================================================
# FILE 3: store.js
# ============================================================
store_js = '''// ============================================================
// STORE: Simple Global State Management
// ============================================================

var Store = {
    state: {
        currentDeviceUUID: 'PENDING',
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
'''

with open('/mnt/agents/output/store.js', 'w', encoding='utf-8') as f:
    f.write(store_js)