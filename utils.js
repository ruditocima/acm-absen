/**
 * utils.js - Modul Utilitas Pendukung Absensi & Frontend
 * Versi Enterprise-Grade Production-Ready v6.4 (Fully Sanitized, Self-Healing, HMR-Resilient, Cross-Realm Safe, ICU & Locale Fallback, WCAG 2.1 A11y Compliant)
 */

'use strict';

// Wadah status global untuk ketahanan HMR total dan pencegahan race condition dengan deep-patching
if (typeof window !== 'undefined') {
    if (!window.__UTILS_STATE__) {
        window.__UTILS_STATE__ = {
            previousActiveElement: null,
            confirmCallback: null,
            isConfirming: false,
            emailjsReady: false,
            modalSessionToken: 0
        };
    } else {
        window.__UTILS_STATE__.previousActiveElement = window.__UTILS_STATE__.previousActiveElement !== undefined ? window.__UTILS_STATE__.previousActiveElement : null;
        window.__UTILS_STATE__.confirmCallback = window.__UTILS_STATE__.confirmCallback !== undefined ? window.__UTILS_STATE__.confirmCallback : null;
        window.__UTILS_STATE__.isConfirming = window.__UTILS_STATE__.isConfirming !== undefined ? window.__UTILS_STATE__.isConfirming : false;
        window.__UTILS_STATE__.emailjsReady = window.__UTILS_STATE__.emailjsReady !== undefined ? window.__UTILS_STATE__.emailjsReady : false;
        window.__UTILS_STATE__.modalSessionToken = window.__UTILS_STATE__.modalSessionToken || 0;
    }
}

const state = (typeof window !== 'undefined' && window.__UTILS_STATE__) ? window.__UTILS_STATE__ : {
    previousActiveElement: null,
    confirmCallback: null,
    isConfirming: false,
    emailjsReady: false,
    modalSessionToken: 0
};

/**
 * Membersihkan string angka regional secara universal dengan deteksi pintar pemisah ribuan dan desimal (Format Indonesia/Eropa & US).
 * @param {any} val 
 * @returns {any}
 */
function cleanNumericString(val) {
    if (typeof val === 'string') {
        let s = val.trim();
        if (s === '') return val;
        
        const hasComma = s.includes(',');
        const hasDot = s.includes('.');
        
        if (hasComma && hasDot) {
            const lastComma = s.lastIndexOf(',');
            const lastDot = s.lastIndexOf('.');
            if (lastComma > lastDot) {
                // Format Indonesia/Eropa: 1.234.567,89
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                // Format US: 1,234,567.89
                s = s.replace(/,/g, '');
            }
        } else if (hasComma && !hasDot) {
            // Jika koma diikuti 1-2 digit di akhir, asumsikan desimal, jika tidak asumsikan pemisah ribuan
            if (/,\d{1,2}$/.test(s)) {
                s = s.replace(',', '.');
            } else {
                s = s.replace(/,/g, '');
            }
        } else if (hasDot && (s.match(/\./g) || []).length > 1) {
            // Titik ganda sebagai pemisah ribuan: 1.234.567
            s = s.replace(/\./g, '');
        }
        return s;
    }
    return val;
}

/**
 * Pembuatan formatter Intl yang aman dengan fallback berlapis ke locale default dan zona waktu lokal/UTC.
 */
function createSafeIntl(options) {
    try {
        return new Intl.DateTimeFormat('id-ID', options);
    } catch (e1) {
        try {
            const fallbackOptions = { ...options };
            delete fallbackOptions.timeZone;
            return new Intl.DateTimeFormat('id-ID', fallbackOptions);
        } catch (e2) {
            return new Intl.DateTimeFormat(undefined, options);
        }
    }
}

const intlFormatters = {
    date: createSafeIntl({ timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: createSafeIntl({ timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    datetime: createSafeIntl({ timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
};

/**
 * Mengurai tanggal secara aman lintas browser dengan dukungan format lokal Indonesia (DD-MM-YYYY / DD/MM/YYYY), offset WIB eksplisit, dan validasi ketat berpola strict anchor.
 * @param {any} date 
 * @returns {Date}
 */
export function parseDateSafely(date) {
    if (date === null || date === undefined || date === '') return new Date(NaN);
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);
    if (typeof date === 'string') {
        let trimmed = date.trim();
        if (trimmed === '') return new Date(NaN);
        
        // Dukungan parsing format tanggal Indonesia/Eropa ketat dengan anchor akhir string ($)
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (ddmmyyyyMatch) {
            const day = String(parseInt(ddmmyyyyMatch[1], 10)).padStart(2, '0');
            const month = String(parseInt(ddmmyyyyMatch[2], 10)).padStart(2, '0');
            const year = ddmmyyyyMatch[3];
            const hour = ddmmyyyyMatch[4] ? ddmmyyyyMatch[4] : '00';
            const minute = ddmmyyyyMatch[5] ? ddmmyyyyMatch[5] : '00';
            const second = ddmmyyyyMatch[6] ? ddmmyyyyMatch[6] : '00';
            return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`);
        }

        // Normalisasi format SQL datetime 'YYYY-MM-DD HH:mm:ss' ke ISO dengan offset WIB (+07:00)
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
            trimmed = trimmed.replace(' ', 'T') + '+07:00';
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            trimmed = trimmed + 'T00:00:00+07:00';
        }
        return new Date(trimmed);
    }
    return new Date(date);
}

/**
 * Melakukan serialisasi objek kompleks secara aman dengan deteksi silsilah lintas realm, perlindungan Proxy, penanganan DOM Node, serta objek tanpa prototipe.
 * @param {any} val 
 * @param {number} [depth=0] 
 * @param {Set<any>} [ancestors=new Set()] 
 * @returns {any}
 */
export function safeStringify(val, depth = 0, ancestors = new Set()) {
    const MAX_DEPTH = 12;

    function internalStringify(v, d, anc) {
        if (d > MAX_DEPTH) return '[Max Depth Exceeded]';
        if (v === null) return null;
        if (v === undefined) return undefined;

        let tag;
        try {
            tag = Object.prototype.toString.call(v);
        } catch (err) {
            return '[Inaccessible Object]';
        }

        if (tag === '[object String]' || tag === '[object Number]' || tag === '[object Boolean]') {
            try {
                return v.valueOf();
            } catch (e) {
                return String(v);
            }
        }

        const type = typeof v;
        if (type === 'function' || type === 'symbol') {
            try {
                return v.toString();
            } catch (e) {
                return '[Function/Symbol]';
            }
        }
        if (type === 'bigint') return v.toString();
        if (type === 'number') return (!Number.isFinite(v) || Number.isNaN(v)) ? String(v) : v;
        if (type === 'boolean' || type === 'string') return v;

        if (typeof Element !== 'undefined' && v instanceof Element) {
            try {
                return `[DOM Element: <${v.tagName.toLowerCase()}${v.id ? ` id="${v.id}"` : ''}${v.className ? ` class="${v.className}"` : ''}>]`;
            } catch (e) {
                return '[DOM Element]';
            }
        }
        if (typeof Node !== 'undefined' && v instanceof Node) {
            try {
                return `[DOM Node: Type ${v.nodeType}]`;
            } catch (e) {
                return '[DOM Node]';
            }
        }

        if (tag === '[object Date]') {
            try {
                return Number.isNaN(v.getTime()) ? '[Invalid Date]' : v.toISOString();
            } catch (e) {
                return '[Invalid Date]';
            }
        }
        if (tag === '[object RegExp]') return v.toString();
        if (tag === '[object Error]') {
            try {
                return v.stack || v.message || v.toString();
            } catch (err) {
                return '[Unreadable Error Object]';
            }
        }
        if (tag === '[object Promise]' || (v && typeof v.then === 'function')) return '[Promise/Thenable]';
        if (tag === '[object WeakMap]') return '[WeakMap]';
        if (tag === '[object WeakSet]') return '[WeakSet]';
        if (tag === '[object ArrayBuffer]' || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(v))) {
            try {
                return `[Binary Data: ${v.constructor?.name || 'ArrayBuffer'} (${v.byteLength || v.length} bytes)]`;
            } catch (e) {
                return '[Binary Data]';
            }
        }

        if (tag === '[object Map]') {
            if (anc.has(v)) return '[Circular Map]';
            anc.add(v);
            try {
                const entries = [];
                for (const [k, itemVal] of v.entries()) {
                    entries.push([
                        internalStringify(k, d + 1, anc),
                        internalStringify(itemVal, d + 1, anc)
                    ]);
                }
                return entries;
            } catch (e) {
                return '[Unreadable Map]';
            } finally {
                anc.delete(v);
            }
        }

        if (tag === '[object Set]') {
            if (anc.has(v)) return '[Circular Set]';
            anc.add(v);
            try {
                const arr = [];
                for (const item of v.values()) {
                    arr.push(internalStringify(item, d + 1, anc));
                }
                return arr;
            } catch (e) {
                return '[Unreadable Set]';
            } finally {
                anc.delete(v);
            }
        }

        if (Array.isArray(v)) {
            if (anc.has(v)) return '[Circular Array]';
            anc.add(v);
            try {
                return v.map(item => internalStringify(item, d + 1, anc));
            } catch (e) {
                return '[Unreadable Array]';
            } finally {
                anc.delete(v);
            }
        }

        if (type === 'object') {
            if (anc.has(v)) return '[Circular Object]';
            anc.add(v);
            try {
                let keys;
                try {
                    keys = Reflect.ownKeys(v);
                } catch (err) {
                    return '[Inaccessible Proxy/Object]';
                }

                const cleanObj = {};
                for (const key of keys) {
                    if (typeof key === 'symbol') continue;
                    try {
                        let desc;
                        try {
                            desc = Object.getOwnPropertyDescriptor(v, key);
                        } catch (e) {
                            desc = null;
                        }

                        if (desc && desc.enumerable === false) continue;
                        if (desc && (desc.get || desc.set)) {
                            cleanObj[String(key)] = '[Getter/Setter]';
                            continue;
                        }
                        cleanObj[String(key)] = internalStringify(v[key], d + 1, anc);
                    } catch (e) {
                        cleanObj[String(key)] = '[Inaccessible Property]';
                    }
                }
                return cleanObj;
            } catch (e) {
                return '[Inaccessible Object]';
            } finally {
                anc.delete(v);
            }
        }

        try {
            return String(v);
        } catch (e) {
            return '[Unserializable Object]';
        }
    }

    const sanitized = internalStringify(val, depth, ancestors);
    if (sanitized === undefined) return 'undefined';
    if (sanitized === null) return 'null';
    if (typeof sanitized === 'string') return sanitized;
    if (typeof sanitized === 'number' || typeof sanitized === 'boolean') return String(sanitized);

    try {
        const jsonResult = JSON.stringify(sanitized);
        return jsonResult !== undefined ? jsonResult : String(sanitized);
    } catch (e) {
        return String(sanitized);
    }
}

/**
 * Mengamankan string dari potensi serangan XSS dengan fallback otomatis.
 * @param {any} text 
 * @returns {string}
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    let str = '';
    try {
        str = String(safeStringify(text));
    } catch (err) {
        str = '[Unserializable Object]';
    }

    const fallbackEscape = (s) => s.replace(/&/g, '&amp;')
                                   .replace(/</g, '&lt;')
                                   .replace(/>/g, '&gt;')
                                   .replace(/"/g, '&quot;')
                                   .replace(/'/g, '&#039;');

    if (typeof document === 'undefined') {
        return fallbackEscape(str);
    }
    try {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    } catch (e) {
        return fallbackEscape(str);
    }
}

/**
 * Mendapatkan string tanggal dalam format WIB (Asia/Jakarta).
 * @param {Date|string|number} [date] 
 * @returns {string}
 */
export function getWIBDateString(date) {
    const targetDate = parseDateSafely(date);
    if (Number.isNaN(targetDate.getTime())) return '';
    
    try {
        const parts = intlFormatters.date.formatToParts(targetDate);
        const y = parts.find(p => p.type === 'year')?.value || '';
        const m = parts.find(p => p.type === 'month')?.value || '';
        const d = parts.find(p => p.type === 'day')?.value || '';
        return y && m && d ? `${y}-${m}-${d}` : '';
    } catch (e) {
        return targetDate.toISOString().split('T')[0];
    }
}

/**
 * Mendapatkan bagian waktu WIB secara aman.
 * @param {Date|string|number} [date]
 * @returns {{h: string, m: string, s: string}}
 */
export function getWIBTimeParts(date) {
    const targetDate = parseDateSafely(date);
    if (Number.isNaN(targetDate.getTime())) return { h: '00', m: '00', s: '00' };

    try {
        const parts = intlFormatters.time.formatToParts(targetDate);
        return {
            h: parts.find(p => p.type === 'hour')?.value || '00',
            m: parts.find(p => p.type === 'minute')?.value || '00',
            s: parts.find(p => p.type === 'second')?.value || '00'
        };
    } catch (e) {
        return {
            h: String(targetDate.getHours()).padStart(2, '0'),
            m: String(targetDate.getMinutes()).padStart(2, '0'),
            s: String(targetDate.getSeconds()).padStart(2, '0')
        };
    }
}

/**
 * Memformat waktu WIB (HH:mm:ss).
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function formatWIBTime(date) {
    const targetDate = parseDateSafely(date);
    if (Number.isNaN(targetDate.getTime())) return '--:--:--';
    try {
        return intlFormatters.time.format(targetDate);
    } catch (e) {
        return `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}:${String(targetDate.getSeconds()).padStart(2, '0')}`;
    }
}

/**
 * Memformat tanggal dan waktu lengkap WIB.
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function formatWIBDateTime(date) {
    const targetDate = parseDateSafely(date);
    if (Number.isNaN(targetDate.getTime())) return '-';
    try {
        return intlFormatters.datetime.format(targetDate);
    } catch (e) {
        return targetDate.toISOString().replace('T', ' ').substring(0, 19);
    }
}

/**
 * Mengonversi string durasi ISO 8601 secara akurat dengan parser linier anti-ReDoS, validasi desainator T ketat dan posisi unit sesuai spesifikasi.
 * @param {string} isoStr 
 * @returns {number|null}
 */
export function parseISODurationToSeconds(isoStr) {
    if (typeof isoStr !== 'string') return null;
    const trimmed = isoStr.trim();
    if (!trimmed.startsWith('P') && !trimmed.startsWith('-P')) return null;

    const isNegative = trimmed.startsWith('-');
    const upper = trimmed.toUpperCase();
    const hasT = upper.includes('T');
    const tIndex = upper.indexOf('T');

    if (hasT) {
        const partsT = upper.split('T');
        if (partsT.length !== 2 || !/[HMS]/i.test(partsT[1])) return null;
    }

    let totalSeconds = 0;
    const tokenRegex = /(\d+(?:\.\d*)?|\.\d+)([YMWDHMS])/g;
    let match;
    let foundAny = false;

    while ((match = tokenRegex.exec(upper)) !== null) {
        foundAny = true;
        const val = parseFloat(cleanNumericString(match[1]));
        const unit = match[2];
        const charIndex = match.index;

        if (Number.isNaN(val) || !Number.isFinite(val)) continue;

        const isAfterT = hasT && tIndex !== -1 && charIndex > tIndex;

        // Validasi posisi unit ISO 8601 yang ketat
        if (['Y', 'W', 'D'].includes(unit) && isAfterT) return null;
        if (['H', 'S'].includes(unit) && !isAfterT) return null;

        if (unit === 'Y') {
            totalSeconds += val * 31536000;
        } else if (unit === 'M') {
            if (isAfterT) {
                totalSeconds += val * 60; // Menit
            } else {
                totalSeconds += val * 2592000; // Bulan (perkiraan 30 hari)
            }
        } else if (unit === 'W') {
            totalSeconds += val * 604800;
        } else if (unit === 'D') {
            totalSeconds += val * 86400;
        } else if (unit === 'H') {
            totalSeconds += val * 3600;
        } else if (unit === 'S') {
            totalSeconds += val;
        }
    }

    const prefixLen = isNegative ? 2 : 1;
    const coreStr = upper.slice(prefixLen);
    const strippedCore = coreStr.replace(tokenRegex, '').replace('T', '');
    if (strippedCore.length > 0) {
        return null;
    }

    return foundAny ? (isNegative ? -totalSeconds : totalSeconds) : null;
}

/**
 * Mengonversi string waktu, string angka detik, durasi ISO, objek tanggal, atau SQL datetime menjadi total detik secara robust.
 * @param {string|number|Date} timeStr 
 * @returns {number}
 */
export function timeToSeconds(timeStr) {
    if (timeStr === null || timeStr === undefined) return 0;
    if (typeof timeStr === 'number') return (!Number.isFinite(timeStr) || Number.isNaN(timeStr)) ? 0 : timeStr;
    if (timeStr instanceof Date) {
        if (Number.isNaN(timeStr.getTime())) return 0;
        return timeStr.getHours() * 3600 + timeStr.getMinutes() * 60 + timeStr.getSeconds() + timeStr.getMilliseconds() / 1000;
    }
    if (typeof timeStr !== 'string') return 0;

    const trimmed = timeStr.trim();
    if (trimmed === '') return 0;

    if (trimmed.toUpperCase().startsWith('P') || trimmed.toUpperCase().startsWith('-P')) {
        const isoSecs = parseISODurationToSeconds(trimmed);
        if (isoSecs !== null) return isoSecs;
    }

    const cleanedNumStr = cleanNumericString(trimmed);
    if (/^-?\d+(?:\.\d+)?$/.test(cleanedNumStr)) {
        const num = parseFloat(cleanedNumStr);
        return Number.isFinite(num) ? num : 0;
    }

    const sqlDatetimeMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}[\sT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:?\d{2})?/i);
    if (sqlDatetimeMatch) {
        const h = parseInt(sqlDatetimeMatch[1], 10) || 0;
        const m = parseInt(sqlDatetimeMatch[2], 10) || 0;
        const s = parseFloat(cleanNumericString(sqlDatetimeMatch[3] + (sqlDatetimeMatch[4] ? '.' + sqlDatetimeMatch[4] : ''))) || 0;
        return (Number.isFinite(h) ? h : 0) * 3600 + (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
    }

    const isNegative = trimmed.startsWith('-');
    const cleanStr = isNegative ? trimmed.slice(1).trim() : trimmed;
    const parts = cleanStr.split(':');
    if (parts.length < 2) return 0;

    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parts.length > 2 && parts[2] !== undefined && parts[2] !== '' ? parseFloat(cleanNumericString(parts[2])) : 0;
    
    const total = (Number.isFinite(h) ? h : 0) * 3600 + (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
    return isNegative ? -total : total;
}

/**
 * Memformat waktu rekap dengan dukungan normalisasi jam fleksibel dan durasi ISO 8601.
 * @param {string|number|Date} timeValue 
 * @returns {string}
 */
export function formatRekapTime(timeValue) {
    if (timeValue === null || timeValue === undefined || timeValue === '') return '--:--:--';
    
    if (typeof timeValue === 'number') {
        if (!Number.isFinite(timeValue) || Number.isNaN(timeValue)) return '--:--:--';
        const totalSecs = Math.trunc(timeValue);
        const isNeg = totalSecs < 0;
        const absSecs = Math.abs(totalSecs);
        const h = Math.floor(absSecs / 3600).toString().padStart(2, '0');
        const m = Math.floor((absSecs % 3600) / 60).toString().padStart(2, '0');
        const s = (absSecs % 60).toString().padStart(2, '0');
        return `${isNeg ? '-' : ''}${h}:${m}:${s}`;
    }

    if (typeof timeValue === 'string') {
        const trimmed = timeValue.trim();
        if (trimmed === '') return '--:--:--';
        
        if (trimmed.toUpperCase().startsWith('P') || trimmed.toUpperCase().startsWith('-P')) {
            const isoSecs = parseISODurationToSeconds(trimmed);
            if (isoSecs !== null) {
                const totalSecs = Math.trunc(isoSecs);
                const isNeg = totalSecs < 0;
                const absSecs = Math.abs(totalSecs);
                const h = Math.floor(absSecs / 3600).toString().padStart(2, '0');
                const m = Math.floor((absSecs % 3600) / 60).toString().padStart(2, '0');
                const s = (absSecs % 60).toString().padStart(2, '0');
                return `${isNeg ? '-' : ''}${h}:${m}:${s}`;
            }
        }
        
        const cleanedNumStr = cleanNumericString(trimmed);
        if (/^-?\d+(?:\.\d+)?$/.test(cleanedNumStr)) {
            const num = parseFloat(cleanedNumStr);
            if (Number.isFinite(num)) {
                const totalSecs = Math.trunc(num);
                const isNeg = totalSecs < 0;
                const absSecs = Math.abs(totalSecs);
                const h = Math.floor(absSecs / 3600).toString().padStart(2, '0');
                const m = Math.floor((absSecs % 3600) / 60).toString().padStart(2, '0');
                const s = (absSecs % 60).toString().padStart(2, '0');
                return `${isNeg ? '-' : ''}${h}:${m}:${s}`;
            }
        }

        const generalColonRegex = /^-?\d+:\d+(?:\:\d+(?:\.\d+)?)?$/;
        if (generalColonRegex.test(trimmed)) {
            const totalSecs = timeToSeconds(trimmed);
            if (Number.isFinite(totalSecs)) {
                const totalTrunc = Math.trunc(totalSecs);
                const isNeg = totalTrunc < 0;
                const absSecs = Math.abs(totalTrunc);
                const h = Math.floor(absSecs / 3600).toString().padStart(2, '0');
                const m = Math.floor((absSecs % 3600) / 60).toString().padStart(2, '0');
                const s = Math.floor(absSecs % 60).toString().padStart(2, '0');
                return `${isNeg ? '-' : ''}${h}:${m}:${s}`;
            }
        }
    }

    try {
        const parsedDate = parseDateSafely(timeValue);
        if (!Number.isNaN(parsedDate.getTime())) {
            return intlFormatters.time.format(parsedDate);
        }
    } catch (e) {
        // Abaikan
    }
    
    return '--:--:--';
}

/**
 * Menghitung jarak antara dua koordinat GPS menggunakan formula Haversine (dalam meter) dengan pembersihan koma regional yang robust.
 * @param {number|string} lat1 
 * @param {number|string} lon1 
 * @param {number|string} lat2 
 * @param {number|string} lon2 
 * @returns {number}
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const p1 = parseFloat(cleanNumericString(lat1));
    const p2 = parseFloat(cleanNumericString(lon1));
    const p3 = parseFloat(cleanNumericString(lat2));
    const p4 = parseFloat(cleanNumericString(lon2));

    if (Number.isNaN(p1) || Number.isNaN(p2) || Number.isNaN(p3) || Number.isNaN(p4)) return 0;
    if (p1 < -90 || p1 > 90 || p3 < -90 || p3 > 90) return 0;
    if (p2 < -180 || p2 > 180 || p4 < -180 || p4 > 180) return 0;

    const R = 6371e3;
    const phi1 = p1 * Math.PI / 180;
    const phi2 = p3 * Math.PI / 180;
    const dphi = (p3 - p1) * Math.PI / 180;
    const dlambda = (p4 - p2) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Menampilkan notifikasi Toast secara dinamis dengan pembatasan tumpukan dan perlindungan timer terisolasi.
 * @param {string} message 
 * @param {'success'|'warning'|'error'} [type='success']
 */
export function showToast(message, type = 'success') {
    if (typeof document === 'undefined' || !document.body) return;
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }
    
    const maxToasts = 4;
    while (container.children.length >= maxToasts) {
        container.firstElementChild.remove();
    }

    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    let borderColor, icon;
    if (type === 'success') {
        borderColor = 'border-emerald-500/30';
        icon = 'fa-circle-check text-emerald-400';
    } else if (type === 'warning') {
        borderColor = 'border-amber-500/30';
        icon = 'fa-triangle-exclamation text-amber-400';
    } else {
        borderColor = 'border-rose-500/30';
        icon = 'fa-circle-xmark text-rose-400';
    }
    
    toast.className = `glass-card pointer-events-auto px-4 py-3 rounded-2xl border ${borderColor} shadow-xl flex items-center gap-3 transform translate-y-2 opacity-0 transition-all duration-300 text-xs text-white max-w-sm`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span class="flex-1">${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        if (!toast.isConnected) return;
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);
    
    setTimeout(() => {
        if (!toast.isConnected) return;
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => { 
            if (toast.isConnected) toast.remove(); 
        }, 300);
    }, 3500);
}

/**
 * Memastikan modal konfirmasi tersedia di DOM secara dinamis (Self-Healing).
 */
function ensureConfirmModalExists() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('confirm-modal')) return;
    
    const modalDiv = document.createElement('div');
    modalDiv.id = 'confirm-modal';
    modalDiv.setAttribute('role', 'dialog');
    modalDiv.setAttribute('aria-modal', 'true');
    modalDiv.setAttribute('tabindex', '-1');
    modalDiv.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm hidden';
    modalDiv.innerHTML = `
        <div class="glass-card w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                    <i class="fa-solid fa-triangle-exclamation text-base"></i>
                </div>
                <div class="flex-1">
                    <h3 id="confirm-title" class="text-sm font-bold text-white">Konfirmasi Aksi</h3>
                    <p id="confirm-message" class="text-xs text-slate-400 mt-0.5">Apakah Anda yakin ingin melanjutkan?</p>
                </div>
            </div>
            <div class="flex items-center gap-3 pt-2">
                <button id="confirm-btn-no" type="button" class="flex-1 py-2.5 rounded-xl bg-slate-800/80 text-slate-300 font-medium text-xs border border-white/5 hover:bg-slate-700 transition">Batal</button>
                <button id="confirm-btn-yes" type="button" class="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition">Ya, Lanjutkan</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
}

/**
 * Memastikan modal zoom gambar tersedia di DOM secara dinamis (Self-Healing).
 */
function ensureImageZoomModalExists() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('image-zoom-modal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'image-zoom-modal';
    modalDiv.setAttribute('role', 'dialog');
    modalDiv.setAttribute('aria-modal', 'true');
    modalDiv.setAttribute('tabindex', '-1');
    modalDiv.className = 'fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md hidden';
    modalDiv.innerHTML = `
        <button type="button" id="zoom-close-btn" class="absolute top-5 right-5 w-10 h-10 rounded-full bg-slate-800/80 text-white flex items-center justify-center hover:bg-slate-700 transition border border-white/10 cursor-pointer" aria-label="Tutup Zoom">
            <i class="fa-solid fa-xmark text-lg"></i>
        </button>
        <img id="zoomed-image" src="" alt="Zoomed Preview" class="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10" />
        <p id="zoomed-caption" class="text-xs text-slate-300 mt-4 text-center font-medium px-4 py-2 rounded-xl bg-slate-900/60 border border-white/5 max-w-md"></p>
    `;
    document.body.appendChild(modalDiv);
}

/**
 * Membuka modal konfirmasi interaktif dengan manajemen fokus, Focus Trap, dan Session Tracking.
 * @param {string} title 
 * @param {string} message 
 * @param {Function} callback 
 * @param {boolean} [isDanger=true] 
 */
export function showConfirm(title, message, callback, isDanger = true) {
    if (typeof document === 'undefined') return;
    state.modalSessionToken++;
    const currentSession = state.modalSessionToken;
    
    state.previousActiveElement = (document.activeElement && document.contains(document.activeElement)) ? document.activeElement : null;
    ensureConfirmModalExists();
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const modalEl = document.getElementById('confirm-modal');
    const btnYes = document.getElementById('confirm-btn-yes');

    if (!titleEl || !msgEl || !modalEl || !btnYes) return;

    titleEl.innerText = title;
    msgEl.innerText = message;
    state.isConfirming = false;
    
    if (isDanger) {
        btnYes.className = 'flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md hover:bg-rose-600 transition';
        btnYes.innerText = 'Ya, Hapus/Reset';
    } else {
        btnYes.className = 'flex-1 py-2.5 rounded-xl gold-gradient text-slate-950 font-bold text-xs shadow-md hover:opacity-95 transition';
        btnYes.innerText = 'Ya, Lanjutkan';
    }
    
    state.confirmCallback = callback;
    modalEl.classList.remove('hidden');
    
    setTimeout(() => {
        if (currentSession === state.modalSessionToken && btnYes && document.contains(btnYes)) {
            btnYes.focus();
        }
    }, 50);
}

/**
 * Menutup modal konfirmasi dan mengembalikan fokus elemen secara aman.
 */
export function closeConfirmModal() {
    state.modalSessionToken++;
    const modalEl = document.getElementById('confirm-modal');
    if (modalEl) {
        modalEl.classList.add('hidden');
    }
    state.confirmCallback = null;
    state.isConfirming = false;

    if (state.previousActiveElement && typeof state.previousActiveElement.focus === 'function' && document.contains(state.previousActiveElement)) {
        state.previousActiveElement.focus();
    }
    state.previousActiveElement = null;
}

// Perlindungan listener global terhadap HMR / multiple injection & atomic execution dengan dynamic lookup
if (typeof window !== 'undefined' && !window.__UTILS_LISTENERS_INITIALIZED__) {
    window.__UTILS_LISTENERS_INITIALIZED__ = true;
    
    document.addEventListener('click', async (e) => {
        const targetBtn = e.target.closest('#confirm-btn-yes');
        if (targetBtn) {
            if (state.isConfirming) return;
            state.isConfirming = true;
            
            const originalText = targetBtn.innerHTML;
            targetBtn.disabled = true;
            targetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

            try {
                if (typeof state.confirmCallback === 'function') {
                    await state.confirmCallback();
                }
            } catch (err) {
                console.error('Confirm callback execution error:', err);
                showToast('Gagal memproses aksi. Silakan coba beberapa saat lagi.', 'error');
            } finally {
                targetBtn.disabled = false;
                targetBtn.innerHTML = originalText;
                if (typeof window.Utils?.closeConfirmModal === 'function') {
                    window.Utils.closeConfirmModal();
                } else {
                    closeConfirmModal();
                }
            }
            return;
        }

        const cancelBtn = e.target.closest('#confirm-btn-no, [data-dismiss="modal"]');
        if (cancelBtn) {
            if (typeof window.Utils?.closeConfirmModal === 'function') {
                window.Utils.closeConfirmModal();
            } else {
                closeConfirmModal();
            }
        }

        const zoomClose = e.target.closest('#zoom-close-btn');
        if (zoomClose) {
            if (typeof window.Utils?.closeImageZoom === 'function') {
                window.Utils.closeImageZoom();
            } else {
                closeImageZoom();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        const confirmModal = document.getElementById('confirm-modal');
        const zoomModal = document.getElementById('image-zoom-modal');
        const activeModal = (confirmModal && !confirmModal.classList.contains('hidden')) ? confirmModal : 
                            (zoomModal && !zoomModal.classList.contains('hidden')) ? zoomModal : null;

        if (e.key === 'Escape') {
            if (typeof window.Utils?.closeConfirmModal === 'function') {
                window.Utils.closeConfirmModal();
            } else {
                closeConfirmModal();
            }
            if (typeof window.Utils?.closeImageZoom === 'function') {
                window.Utils.closeImageZoom();
            } else {
                closeImageZoom();
            }
            return;
        }

        if (e.key === 'Tab' && activeModal) {
            const rawFocusables = activeModal.querySelectorAll('button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), [contenteditable]:not([contenteditable="false"])');
            const focusables = Array.from(rawFocusables).filter(el => {
                if (!document.contains(el)) return false;
                if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert')) return false;
                if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) return false;
                try {
                    if (typeof window !== 'undefined' && window.getComputedStyle) {
                        const style = window.getComputedStyle(el);
                        if (style.visibility === 'hidden' || style.display === 'none') return false;
                    }
                } catch (err) {
                    // Abaikan jika elemen terlepas (detached)
                }
                return true;
            });

            if (focusables.length === 0) {
                e.preventDefault();
                activeModal.focus();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (!activeModal.contains(document.activeElement)) {
                first.focus();
                e.preventDefault();
                return;
            }

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initEmailJS();
        });
    } else {
        initEmailJS();
    }
}

/**
 * Membuka modal perbesaran gambar (Zoom) dengan manajemen fokus dan session tracking.
 * @param {string} url 
 * @param {string} [caption] 
 */
export function openImageZoom(url, caption) {
    if (!url || typeof document === 'undefined') return;
    state.modalSessionToken++;
    const currentSession = state.modalSessionToken;

    state.previousActiveElement = (document.activeElement && document.contains(document.activeElement)) ? document.activeElement : null;
    ensureImageZoomModalExists();
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    const cap = document.getElementById('zoomed-caption');
    const closeBtn = document.getElementById('zoom-close-btn');

    if (modal && img) {
        img.src = url;
        if (cap) cap.innerText = caption || 'Foto Selfie Absensi';
        modal.classList.remove('hidden');
        if (closeBtn) {
            setTimeout(() => {
                if (currentSession === state.modalSessionToken && document.contains(closeBtn)) {
                    closeBtn.focus();
                }
            }, 50);
        }
    }
}

/**
 * Menutup modal perbesaran gambar dan mengembalikan fokus elemen secara aman.
 */
export function closeImageZoom() {
    state.modalSessionToken++;
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('zoomed-image');
    if (modal) {
        modal.classList.add('hidden');
        if (img) img.src = '';
    }

    if (state.previousActiveElement && typeof state.previousActiveElement.focus === 'function' && document.contains(state.previousActiveElement)) {
        state.previousActiveElement.focus();
    }
    state.previousActiveElement = null;
}

/**
 * Mengubah status tombol menjadi mode proses (loading).
 * @param {HTMLButtonElement} btn 
 * @param {string} [loadingText='Memproses...'] 
 */
export function setButtonLoading(btn, loadingText = 'Memproses...') {
    if (!btn) return;
    if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
    }
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(loadingText)}`;
}

/**
 * Mengembalikan status tombol ke kondisi semula.
 * @param {HTMLButtonElement} btn 
 */
export function resetButtonLoading(btn) {
    if (!btn || !btn.dataset.originalHtml) return;
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml;
    delete btn.dataset.originalHtml;
}

/**
 * Menginisialisasi layanan EmailJS secara aman dengan proteksi pemuatan asinkron.
 * @returns {boolean}
 */
export function initEmailJS() {
    try {
        if (typeof window !== 'undefined' && typeof window.emailjs !== 'undefined' && typeof window.emailjs.init === 'function') {
            const publicKey = window.CONFIG?.EMAILJS?.PUBLIC_KEY;
            if (publicKey) {
                window.emailjs.init(publicKey);
                state.emailjsReady = true;
                return true;
            }
        }
    } catch (e) {
        console.error('EmailJS initialization failed:', e);
    }
    state.emailjsReady = false;
    return false;
}

/**
 * Memeriksa kesiapan layanan EmailJS dengan retry otomatis.
 * @returns {boolean}
 */
export function isEmailJSReady() {
    if (!state.emailjsReady) {
        return initEmailJS();
    }
    return state.emailjsReady;
}

if (typeof window !== 'undefined') {
    window.Utils = {
        safeStringify,
        escapeHtml,
        getWIBDateString,
        getWIBTimeParts,
        formatWIBTime,
        formatWIBDateTime,
        parseISODurationToSeconds,
        timeToSeconds,
        formatRekapTime,
        calculateDistance,
        showToast,
        showConfirm,
        closeConfirmModal,
        openImageZoom,
        closeImageZoom,
        setButtonLoading,
        resetButtonLoading,
        isEmailJSReady
    };
    window.showToast = showToast;
    window.showConfirm = showConfirm;
    window.closeConfirmModal = closeConfirmModal;
    window.openImageZoom = openImageZoom;
    window.closeImageZoom = closeImageZoom;
}