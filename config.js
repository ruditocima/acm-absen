/**
 * PRODUCTION-READY CONFIGURATION & SDK INITIALIZER (GOLD MASTER)
 * Optimized for Classic Scripts, CommonJS, Async CDN, Strict CSP & Zero-Leak Error Handling
 */

// 1. EVALUASI ENVIRONMENT VARIABLE AMAN SINTAKS
const getEnv = (key, defaultValue = '') => {
    try {
        if (typeof process !== 'undefined' && process?.env?.[key]) {
            return process.env[key];
        }
    } catch (_) {}

    try {
        if (typeof window !== 'undefined' && window?.__ENV__?.[key]) {
            return window.__ENV__[key];
        }
    } catch (_) {}

    return defaultValue;
};

// 2. OBJEK KONFIGURASI UTAMA
const rawConfig = {
    SUPABASE: {
        URL: getEnv('VITE_SUPABASE_URL', 'https://gviqfdbuoruqldsbbrxk.supabase.co').trim().replace(/\/+$/, ''),
        ANON_KEY: getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aXFmZGJ1b3J1cWxkc2JicnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjU1MzksImV4cCI6MjEwMjIwMTUzOX0.RalUZTRpAKswYK0SxdJjZWkY1wQb1V0JFKmXu8i0Lo0').trim()
    },
    EMAILJS: {
        PUBLIC_KEY: getEnv('VITE_EMAILJS_PUBLIC_KEY', 'il5LfNiQu0y8dsN35').trim(),
        SERVICE_ID: getEnv('VITE_EMAILJS_SERVICE_ID', 'service_3w0ocfc').trim(),
        TEMPLATE_ID: getEnv('VITE_EMAILJS_TEMPLATE_ID', 'template_09rz7kd').trim()
    },
    STORAGE: {
        BUCKET: 'attendance-photos',
        FOLDER: 'selfies'
    },
    ATTENDANCE: {
        OPEN_TIME: '07:45',
        MAX_TIME: '09:40',
        WORK_DAYS_PER_MONTH: 26
    },
    GPS: {
        DEFAULT_RADIUS: 1500, // meter
        MAX_ACCURACY: 100    // meter
    },
    PAGINATION: {
        REKAP_PER_PAGE: 50
    },
    OTP: {
        EXPIRY_MINUTES: 3
    }
};

// 3. VALIDASI SKEMA STRUKTUR LENGKAP
const parseTimeToMinutes = (timeStr) => {
    if (typeof timeStr !== 'string') return null;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeStr)) return null;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const validateConfig = (cfg) => {
    // Validasi Waktu Absensi
    const openMinutes = parseTimeToMinutes(cfg.ATTENDANCE?.OPEN_TIME);
    const maxMinutes = parseTimeToMinutes(cfg.ATTENDANCE?.MAX_TIME);

    if (openMinutes === null || maxMinutes === null) {
        throw new Error('[Config Error] Format waktu absensi harus HH:mm (contoh: 07:45)');
    }

    if (openMinutes >= maxMinutes) {
        throw new Error('[Config Error] OPEN_TIME harus lebih awal dari MAX_TIME');
    }

    if (!Number.isInteger(cfg.ATTENDANCE?.WORK_DAYS_PER_MONTH) || cfg.ATTENDANCE.WORK_DAYS_PER_MONTH <= 0) {
        throw new Error('[Config Error] WORK_DAYS_PER_MONTH harus berupa angka bulat positif');
    }

    // Validasi GPS
    if (typeof cfg.GPS?.DEFAULT_RADIUS !== 'number' || cfg.GPS.DEFAULT_RADIUS <= 0 ||
        typeof cfg.GPS?.MAX_ACCURACY !== 'number' || cfg.GPS.MAX_ACCURACY <= 0) {
        throw new Error('[Config Error] Nilai GPS radius dan accuracy harus berupa angka positif');
    }

    // Validasi Supabase
    if (!cfg.SUPABASE?.URL || !cfg.SUPABASE.URL.startsWith('https://')) {
        throw new Error('[Config Error] SUPABASE.URL harus berupa URL HTTPS yang valid');
    }

    if (!cfg.SUPABASE?.ANON_KEY) {
        throw new Error('[Config Error] SUPABASE.ANON_KEY tidak boleh kosong');
    }

    // Validasi EmailJS
    if (!cfg.EMAILJS?.PUBLIC_KEY || !cfg.EMAILJS?.SERVICE_ID || !cfg.EMAILJS?.TEMPLATE_ID) {
        throw new Error('[Config Error] Seluruh kunci EMAILJS (PUBLIC_KEY, SERVICE_ID, TEMPLATE_ID) wajib diisi');
    }

    // Validasi Storage
    if (!cfg.STORAGE?.BUCKET || typeof cfg.STORAGE.BUCKET !== 'string') {
        throw new Error('[Config Error] STORAGE.BUCKET harus berupa string nama bucket yang valid');
    }

    // Validasi Pagination & OTP
    if (!Number.isInteger(cfg.PAGINATION?.REKAP_PER_PAGE) || cfg.PAGINATION.REKAP_PER_PAGE <= 0) {
        throw new Error('[Config Error] REKAP_PER_PAGE harus berupa angka bulat positif');
    }

    if (typeof cfg.OTP?.EXPIRY_MINUTES !== 'number' || cfg.OTP.EXPIRY_MINUTES <= 0) {
        throw new Error('[Config Error] EXPIRY_MINUTES harus berupa angka positif');
    }
};

// 4. DEEP FREEZE LENGKAP
const deepFreeze = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    Reflect.ownKeys(obj).forEach(prop => {
        if (typeof obj[prop] === 'object' && obj[prop] !== null && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return Object.freeze(obj);
};

validateConfig(rawConfig);
const CONFIG = deepFreeze(rawConfig);

// 5. MANAGED INITIALIZATION & STATE CACHING
let _supabaseInstance = null;
let _supabaseError = null;
let _isEmailJSInit = false;
let _emailJSError = null;

const getSupabaseClient = () => {
    if (_supabaseInstance) return _supabaseInstance;
    if (_supabaseError) return null;

    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        try {
            _supabaseInstance = supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('supabase:ready', { detail: { client: _supabaseInstance } }));
            }
            return _supabaseInstance;
        } catch (err) {
            _supabaseError = err;
            console.error('[Supabase Error] Gagal melakukan inisialisasi:', err.message);
            return null;
        }
    }
    return null;
};

const initEmailJS = () => {
    if (_isEmailJSInit) return true;
    if (_emailJSError) return false;

    if (typeof emailjs !== 'undefined' && typeof emailjs.init === 'function') {
        try {
            emailjs.init(CONFIG.EMAILJS.PUBLIC_KEY);
            _isEmailJSInit = true;
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('emailjs:ready'));
            }
            return true;
        } catch (err) {
            _emailJSError = err;
            console.error('[EmailJS Error] Gagal melakukan inisialisasi EmailJS:', err.message);
            return false;
        }
    }
    return false;
};

// Siklus Eksekusi Tunggal
let _hasInitialized = false;
const runInitialization = () => {
    if (_hasInitialized) return;
    _hasInitialized = true;

    getSupabaseClient();
    initEmailJS();
};

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInitialization, { once: true });
    } else {
        runInitialization();
    }
}

// 6. SAFE GLOBAL BINDINGS & TIMED PROMISE HELPERS
if (typeof window !== 'undefined') {
    const safeDefineProperty = (obj, prop, descriptor) => {
        try {
            const existingDesc = Object.getOwnPropertyDescriptor(obj, prop);
            if (!existingDesc || existingDesc.configurable) {
                Object.defineProperty(obj, prop, descriptor);
            }
        } catch (e) {
            console.warn(`[Config Warning] Gagal mengonfigurasi properti window.${prop}:`, e.message);
        }
    };

    safeDefineProperty(window, 'CONFIG', {
        value: CONFIG,
        writable: false,
        configurable: true
    });

    safeDefineProperty(window, 'supabaseClient', {
        get: () => {
            const client = getSupabaseClient();
            if (!client && !_supabaseError && typeof console !== 'undefined') {
                console.warn('[Supabase Warning] window.supabaseClient diakses sebelum SDK siap. Pertimbangkan menggunakan await window.waitForSupabase().');
            }
            return client;
        },
        configurable: true
    });

    safeDefineProperty(window, 'getSupabaseClient', {
        value: getSupabaseClient,
        writable: false,
        configurable: true
    });

    safeDefineProperty(window, 'initEmailJS', {
        value: initEmailJS,
        writable: false,
        configurable: true
    });

    // Helper Promise Supabase CDN
    safeDefineProperty(window, 'waitForSupabase', {
        value: (timeoutMs = 10000) => {
            return new Promise((resolve, reject) => {
                const client = getSupabaseClient();
                if (client) return resolve(client);
                if (_supabaseError) return reject(_supabaseError);

                const startTime = Date.now();
                const pollInterval = setInterval(() => {
                    const instance = getSupabaseClient();
                    if (instance) {
                        clearInterval(pollInterval);
                        return resolve(instance);
                    }
                    if (_supabaseError) {
                        clearInterval(pollInterval);
                        return reject(_supabaseError);
                    }
                    if (Date.now() - startTime >= timeoutMs) {
                        clearInterval(pollInterval);
                        reject(new Error('[Timeout] Gagal memuat SDK Supabase CDN setelah ' + timeoutMs + 'ms. Periksa koneksi internet atau AdBlocker Anda.'));
                    }
                }, 100);
            });
        },
        writable: false,
        configurable: true
    });

    // Helper Promise EmailJS CDN
    safeDefineProperty(window, 'waitForEmailJS', {
        value: (timeoutMs = 10000) => {
            return new Promise((resolve, reject) => {
                if (initEmailJS()) return resolve(true);
                if (_emailJSError) return reject(_emailJSError);

                const startTime = Date.now();
                const pollInterval = setInterval(() => {
                    if (initEmailJS()) {
                        clearInterval(pollInterval);
                        return resolve(true);
                    }
                    if (_emailJSError) {
                        clearInterval(pollInterval);
                        return reject(_emailJSError);
                    }
                    if (Date.now() - startTime >= timeoutMs) {
                        clearInterval(pollInterval);
                        reject(new Error('[Timeout] Gagal memuat SDK EmailJS CDN setelah ' + timeoutMs + 'ms. Periksa koneksi internet atau AdBlocker Anda.'));
                    }
                }, 100);
            });
        },
        writable: false,
        configurable: true
    });
}

// 7. EXPORT UNIVERSAL
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, getSupabaseClient, initEmailJS };
}