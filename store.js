
# ============================================================
# FILE 3: store.js — Simple State Management
# ============================================================
store_js = r'''// ============================================================
// STORE: Simple Global State Management
// ============================================================

const Store = {
    state: {
        currentDeviceUUID: "PENDING",
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
        rekapTotalCount: 0,
        isMasterAdmin() {
            return this.activeEmployeeSession.role === 'Master Admin';
        }
    },

    set(key, value) {
        this.state[key] = value;
        this.notify(key);
    },

    get(key) {
        return this.state[key];
    },

    listeners: {},

    subscribe(key, callback) {
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(callback);
    },

    notify(key) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(cb => cb(this.state[key]));
        }
    }
};
'''

with open('/mnt/agents/output/store.js', 'w', encoding='utf-8') as f:
    f.write(store_js)

print("✅ store.js created")
