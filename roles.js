(function(global) {
    'use strict';

    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (global.RoleModule && global.RoleModule.isInitialized) return;

    var memoryStorageFallback = {};
    var realtimeRetryTimer = null;
    var realtimeDebounceTimer = null;
    var clientInitRetryTimer = null;
    var syncCounter = 0;

    var SafeStore = {
        get: function(k) { 
            try { 
                var store = global.Store || localStorage;
                if (store && typeof store.get === 'function') return store.get(k);
                var raw = null;
                try {
                    raw = store ? store.getItem(k) : null;
                } catch (storageErr) {
                    return memoryStorageFallback[k] !== undefined ? memoryStorageFallback[k] : null;
                }
                if (raw !== null && raw !== '') {
                    try {
                        return JSON.parse(raw);
                    } catch (jsonErr) {
                        if (store && typeof store.removeItem === 'function') {
                            try { store.removeItem(k); } catch (e) {}
                        }
                        return memoryStorageFallback[k] !== undefined ? memoryStorageFallback[k] : null;
                    }
                }
                return memoryStorageFallback[k] !== undefined ? memoryStorageFallback[k] : null;
            } catch(e) { 
                return memoryStorageFallback[k] !== undefined ? memoryStorageFallback[k] : null; 
            } 
        },
        set: function(k, v) { 
            try { 
                var store = global.Store || localStorage;
                var serialized;
                try {
                    serialized = JSON.stringify(v);
                } catch (stringifyErr) {
                    memoryStorageFallback[k] = v;
                    return;
                }

                if (store && typeof store.set === 'function') {
                    try {
                        store.set(k, v);
                    } catch (customStoreErr) {
                        memoryStorageFallback[k] = v;
                        var isCustomQuota = customStoreErr && (
                            customStoreErr.name === 'QuotaExceededError' ||
                            customStoreErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                            customStoreErr.code === 22 ||
                            customStoreErr.code === 1014 ||
                            (customStoreErr.message && customStoreErr.message.toLowerCase().indexOf('quota') !== -1)
                        );
                        var toastFn = global.showToast;
                        if (typeof toastFn === 'function') {
                            toastFn(isCustomQuota ? 'Penyimpanan lokal penuh. Data diamankan di memori sementara.' : 'Gagal menyimpan ke penyimpanan lokal.', 'warning');
                        }
                    }
                } else if (store) {
                    try {
                        store.setItem(k, serialized);
                    } catch (quotaErr) {
                        memoryStorageFallback[k] = v;
                        var isQuotaError = quotaErr && (
                            quotaErr.name === 'QuotaExceededError' ||
                            quotaErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                            quotaErr.name === 'SecurityError' ||
                            quotaErr.name === 'InvalidStateError' ||
                            quotaErr.code === 22 ||
                            quotaErr.code === 1014 ||
                            (quotaErr.message && quotaErr.message.toLowerCase().indexOf('quota') !== -1)
                        );
                        var toastFn = global.showToast;
                        if (typeof toastFn === 'function') {
                            toastFn(isQuotaError ? 'Penyimpanan lokal penuh atau dibatasi. Data diamankan di memori sementara.' : 'Gagal menyimpan ke penyimpanan lokal.', 'warning');
                        }
                    }
                }
                memoryStorageFallback[k] = v;
            } catch(e) { 
                memoryStorageFallback[k] = v;
                var toastFn = global.showToast;
                if (typeof toastFn === 'function') {
                    toastFn('Penyimpanan lokal dibatasi. Data diamankan di memori sementara.', 'warning');
                }
            } 
        }
    };

    function safeEscape(str) {
        var escFn = global.escapeHtml;
        if (typeof escFn === 'function') return escFn(str);
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function safeToast(msg, type) {
        var toastFn = global.showToast;
        if (typeof toastFn === 'function') {
            toastFn(msg, type);
        } else {
            console.log('[' + (type || 'info').toUpperCase() + '] ' + msg);
        }
    }

    function getElementTarget(target) {
        if (!target) return null;
        if (target.nodeType === 3) return target.parentElement;
        var el = target;
        while (el && el.nodeType === 1 && !el.tagName) {
            el = el.parentElement;
        }
        return el;
    }

    function safeClosest(el, selector) {
        if (!el) return null;
        var current = el;
        while (current && current.nodeType === 1) {
            try {
                if (typeof current.matches === 'function' && current.matches(selector)) {
                    return current;
                }
                if (typeof current.msMatchesSelector === 'function' && current.msMatchesSelector(selector)) {
                    return current;
                }
                if (typeof current.webkitMatchesSelector === 'function' && current.webkitMatchesSelector(selector)) {
                    return current;
                }
                if (typeof current.closest === 'function') {
                    var match = current.closest(selector);
                    if (match) return match;
                }
            } catch (e) {}
            current = current.parentElement || current.parentNode;
        }
        return null;
    }

    function showCustomConfirm(message) {
        return new Promise(function(resolve) {
            if (typeof global.showConfirm === 'function') {
                try {
                    var res = global.showConfirm(message);
                    if (res && typeof res.then === 'function') {
                        res.then(resolve).catch(function() { resolve(false); });
                        return;
                    }
                    resolve(Boolean(res));
                    return;
                } catch (e) {}
            }

            var existingModal = document.getElementById('role-custom-confirm-modal');
            if (existingModal) {
                try { existingModal.remove(); } catch (e) {}
            }

            var activeElBeforeOpen = document.activeElement;

            var modalHtml = '<div id="role-custom-confirm-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="confirm-title">' +
                '<div class="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl text-white">' +
                    '<div class="flex items-center gap-3 mb-3 text-amber-400">' +
                        '<i class="fa-solid fa-triangle-exclamation text-xl"></i>' +
                        '<h3 id="confirm-title" class="text-lg font-bold text-white">Konfirmasi Tindakan</h3>' +
                    '</div>' +
                    '<p class="text-slate-300 text-sm mb-6 leading-relaxed">' + safeEscape(message) + '</p>' +
                    '<div class="flex justify-end gap-3">' +
                        '<button type="button" id="confirm-btn-no" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition">Batal</button>' +
                        '<button type="button" id="confirm-btn-yes" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition">Ya, Lanjutkan</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

            var div = document.createElement('div');
            div.innerHTML = modalHtml;
            var modalEl = div.firstElementChild;
            if (!document.body) {
                resolve(false);
                return;
            }
            document.body.appendChild(modalEl);

            var btnYes = modalEl.querySelector('#confirm-btn-yes');
            var btnNo = modalEl.querySelector('#confirm-btn-no');
            var isResolved = false;

            if (btnYes) {
                try { btnYes.focus(); } catch (e) {}
            }

            var handleEsc = function(e) {
                if (e.key === 'Escape') {
                    cleanup(false);
                } else if (e.key === 'Tab') {
                    var focusables = Array.prototype.slice.call(
                        modalEl.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])')
                    ).filter(function(el) {
                        return el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
                    });

                    if (focusables.length === 0) {
                        e.preventDefault();
                        return;
                    }

                    var first = focusables[0];
                    var last = focusables[focusables.length - 1];

                    if (e.shiftKey && document.activeElement === first) {
                        last.focus();
                        e.preventDefault();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        first.focus();
                        e.preventDefault();
                    }
                }
            };
            document.addEventListener('keydown', handleEsc);

            function cleanup(result) {
                if (isResolved) return;
                isResolved = true;

                try {
                    document.removeEventListener('keydown', handleEsc);
                } catch (e) {}

                if (modalEl && modalEl.parentNode) {
                    try {
                        modalEl.parentNode.removeChild(modalEl);
                    } catch (e) {}
                }

                if (activeElBeforeOpen && typeof activeElBeforeOpen.focus === 'function') {
                    try {
                        if (document.body.contains(activeElBeforeOpen)) {
                            activeElBeforeOpen.focus();
                        }
                    } catch (e) {}
                }

                resolve(result);
            }

            if (btnYes) btnYes.onclick = function() { cleanup(true); };
            if (btnNo) btnNo.onclick = function() { cleanup(false); };
            modalEl.onclick = function(e) {
                if (e.target === modalEl) cleanup(false);
            };
        });
    }

    var lastActiveElement = null;
    var editingOriginalId = null;
    var isModuleBusy = false;
    var isSyncing = false;
    var cachedRoleSelectPlaceholder = null;
    var cachedPlaceholderHtmlLength = -1;
    var realtimeChannel = null;
    var isInitialized = false;
    var domObserver = null;

    function sanitizeText(str) {
        return String(str || '')
            .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
            .replace(/[\s\u00A0\u3000]+/g, ' ')
            .trim();
    }

    function getSupabaseClient() {
        return global.supabaseClient || global.supabase || null;
    }

    function executeWithTimeout(queryBuilderFn, ms) {
        var controller = (typeof global.AbortController === 'function') ? new AbortController() : null;
        var signal = controller ? controller.signal : null;
        var query;
        try {
            query = typeof queryBuilderFn === 'function' ? queryBuilderFn(signal) : queryBuilderFn;
        } catch (err) {
            return Promise.reject(err);
        }

        var timeoutId;
        var isCompleted = false;
        var timeoutPromise = new Promise(function(_, reject) {
            timeoutId = setTimeout(function() {
                if (!isCompleted && controller) {
                    try { controller.abort(); } catch (e) {}
                }
                reject(new Error('Waktu permintaan ke server habis (timeout).'));
            }, ms);
        });

        return Promise.race([Promise.resolve(query), timeoutPromise]).then(function(res) {
            isCompleted = true;
            return res;
        }).catch(function(err) {
            isCompleted = true;
            if (err && (err.name === 'AbortError' || (err.message && err.message.indexOf('aborted') !== -1))) {
                throw new Error('Waktu permintaan ke server habis (timeout).');
            }
            throw err;
        }).finally(function() {
            if (timeoutId) clearTimeout(timeoutId);
            if (!isCompleted && controller && typeof controller.abort === 'function') {
                try { controller.abort(); } catch (e) {}
            }
        });
    }

    function getValidRoles() {
        var raw = SafeStore.get('roles');
        if (!Array.isArray(raw)) return [];
        var seen = {};
        return raw.filter(function(r) { 
            if (!r || typeof r !== 'object' || r.id == null || String(r.id).trim() === '') return false;
            var idStr = String(r.id).trim();
            if (seen[idStr]) return false;
            seen[idStr] = true;
            return true;
        }).map(function(r) {
            return {
                id: String(r.id).trim(),
                name: sanitizeText(r.name || ''),
                access: sanitizeText(r.access || '')
            };
        }).sort(function(a, b) {
            return a.id.localeCompare(b.id);
        });
    }

    async function fetchAndSyncRoles() {
        if (isSyncing || isModuleBusy || !isInitialized) return;
        var client = getSupabaseClient();
        if (!client || typeof client.from !== 'function') {
            if (!clientInitRetryTimer && isInitialized) {
                clientInitRetryTimer = setTimeout(function() {
                    clientInitRetryTimer = null;
                    fetchAndSyncRoles();
                }, 2000);
            }
            return;
        }
        
        isSyncing = true;
        var currentSyncId = ++syncCounter;
        try {
            var res = await executeWithTimeout(function(signal) {
                var query = client.from('roles').select('*');
                if (signal) {
                    if (typeof query.abortSignal === 'function') {
                        query = query.abortSignal(signal);
                    } else if (typeof query.signal === 'function') {
                        query = query.signal(signal);
                    }
                }
                return query;
            }, 10000);

            if (currentSyncId !== syncCounter) return;

            if (res && !res.error && Array.isArray(res.data)) {
                var validServerRoles = res.data.filter(function(r) {
                    return r && typeof r === 'object' && r.id != null;
                }).map(function(r) {
                    return {
                        id: String(r.id).trim(),
                        name: sanitizeText(r.name || ''),
                        access: sanitizeText(r.access || '')
                    };
                });
                
                SafeStore.set('roles', validServerRoles);
                renderRoles();
            }
        } catch (e) {
            // Fallback senyap ke penyimpanan lokal
        } finally {
            if (currentSyncId === syncCounter) {
                isSyncing = false;
            }
        }
    }

    function initRealtimeSubscription() {
        var client = getSupabaseClient();
        if (!client || typeof client.channel !== 'function') {
            if (!realtimeRetryTimer && isInitialized) {
                realtimeRetryTimer = setTimeout(function() {
                    realtimeRetryTimer = null;
                    initRealtimeSubscription();
                }, 3000);
            }
            return;
        }
        try {
            if (realtimeChannel) {
                if (typeof realtimeChannel.unsubscribe === 'function') {
                    try { realtimeChannel.unsubscribe(); } catch (e) {}
                }
                if (typeof client.removeChannel === 'function') {
                    try { client.removeChannel(realtimeChannel); } catch (e) {}
                }
                realtimeChannel = null;
            }

            realtimeChannel = client.channel('public:roles-module-' + Math.random().toString(36).substring(2))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, function() {
                    if (!isSyncing && !isModuleBusy && isInitialized) {
                        if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
                        realtimeDebounceTimer = setTimeout(function() {
                            realtimeDebounceTimer = null;
                            fetchAndSyncRoles();
                        }, 300);
                    }
                })
                .subscribe(function(status) {
                    if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isInitialized) {
                        if (!realtimeRetryTimer) {
                            realtimeRetryTimer = setTimeout(function() {
                                realtimeRetryTimer = null;
                                initRealtimeSubscription();
                            }, 5000);
                        }
                    }
                });
        } catch (e) {
            if (!realtimeRetryTimer && isInitialized) {
                realtimeRetryTimer = setTimeout(function() {
                    realtimeRetryTimer = null;
                    initRealtimeSubscription();
                }, 5000);
            }
        }
    }

    function renderRoles() {
        if (!isInitialized) return;
        var tbody = document.getElementById('role-tbody');
        if (tbody) {
            var roles = getValidRoles();
            if (roles.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 text-sm">Belum ada data role yang tersedia.</td></tr>';
            } else {
                tbody.innerHTML = roles.map(function(r) {
                    var safeId = safeEscape(r.id);
                    var safeName = safeEscape(r.name || '');
                    var safeAccess = safeEscape(r.access || '');
                    return '<tr class="hover:bg-slate-900/50">' +
                        '<td class="p-3 font-mono text-gold-400">' + safeId + '</td>' +
                        '<td class="p-3 font-semibold text-white">' + safeName + '</td>' +
                        '<td class="p-3 text-slate-300">' + safeAccess + '</td>' +
                        '<td class="p-3">' +
                            '<div class="flex items-center gap-2">' +
                                '<button type="button" data-role-id="' + safeId + '" class="btn-edit-role px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition">' +
                                    '<i class="fa-solid fa-pen"></i> Edit' +
                                '</button>' +
                                '<button type="button" data-role-id="' + safeId + '" class="btn-delete-role px-2.5 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-[11px] font-semibold transition">' +
                                    '<i class="fa-solid fa-trash"></i> Hapus' +
                                '</button>' +
                            '</div>' +
                        '</td>' +
                    '</tr>';
                }).join('');
            }
        }

        var roleSelect = document.getElementById('inp-role');
        if (roleSelect && document.activeElement !== roleSelect) {
            var rolesList = getValidRoles();
            var currentSelectedValue = String(roleSelect.value || '');
            
            if (roleSelect.options && roleSelect.options.length > 0 && (!roleSelect.options[0].value || roleSelect.options[0].disabled)) {
                var currentFirstOptHtml = roleSelect.options[0].outerHTML;
                if (cachedRoleSelectPlaceholder === null || cachedPlaceholderHtmlLength !== currentFirstOptHtml.length) {
                    cachedRoleSelectPlaceholder = currentFirstOptHtml;
                    cachedPlaceholderHtmlLength = currentFirstOptHtml.length;
                }
            } else {
                cachedRoleSelectPlaceholder = '';
                cachedPlaceholderHtmlLength = 0;
            }

            roleSelect.innerHTML = (cachedRoleSelectPlaceholder || '') + rolesList.map(function(r) {
                return '<option value="' + safeEscape(r.id) + '">' + safeEscape(r.name || '') + '</option>';
            }).join('');
            
            if (currentSelectedValue) {
                var optionExists = Array.prototype.slice.call(roleSelect.options).some(function(opt) {
                    return String(opt.value) === currentSelectedValue;
                });
                if (optionExists) {
                    if (String(roleSelect.value) !== currentSelectedValue) {
                        roleSelect.value = currentSelectedValue;
                        try {
                            if (document.body.contains(roleSelect)) {
                                var changeEvent;
                                if (typeof global.CustomEvent === 'function') {
                                    changeEvent = new CustomEvent('change', { bubbles: true, cancelable: true });
                                } else {
                                    changeEvent = document.createEvent('Event');
                                    changeEvent.initEvent('change', true, true);
                                }
                                roleSelect.dispatchEvent(changeEvent);
                            }
                        } catch (e) {}
                    }
                } else {
                    roleSelect.value = '';
                    try {
                        if (document.body.contains(roleSelect)) {
                            var resetEvent;
                            if (typeof global.CustomEvent === 'function') {
                                resetEvent = new CustomEvent('change', { bubbles: true, cancelable: true });
                            } else {
                                resetEvent = document.createEvent('Event');
                                resetEvent.initEvent('change', true, true);
                            }
                            roleSelect.dispatchEvent(resetEvent);
                        }
                    } catch (e) {}
                }
            }
        }
    }

    function handleStorageEvent(event) {
        if (event && event.key === 'roles' && event.newValue !== event.oldValue) {
            renderRoles();
        }
    }

    function handleClickEvent(event) {
        if (!event || !isInitialized) return;
        var targetEl = getElementTarget(event.target);
        if (!targetEl) return;

        var modal = document.getElementById('role-modal');
        if (modal && targetEl === modal && !modal.classList.contains('hidden')) {
            closeRoleModal();
            return;
        }

        var btnSave = safeClosest(targetEl, '#btn-save-role');
        if (btnSave) {
            saveRole();
            return;
        }

        var btnClose = safeClosest(targetEl, '.btn-close-role, #btn-cancel-role, [data-dismiss="modal"]');
        if (btnClose) {
            closeRoleModal();
            return;
        }

        var btnEdit = safeClosest(targetEl, '.btn-edit-role');
        if (btnEdit) {
            var roleIdEdit = btnEdit.getAttribute('data-role-id');
            if (roleIdEdit) {
                openEditRoleModal(roleIdEdit, btnEdit);
            }
            return;
        }

        var btnDel = safeClosest(targetEl, '.btn-delete-role');
        if (btnDel) {
            var roleIdDel = btnDel.getAttribute('data-role-id');
            if (roleIdDel) {
                deleteRole(roleIdDel, btnDel);
            }
        }
    }

    function handleFormSubmitEvent(event) {
        if (!event || !isInitialized) return;
        var target = getElementTarget(event.target);
        var form = target && target.id === 'role-form' ? target : safeClosest(target, '#role-form');
        if (form) {
            event.preventDefault();
            saveRole();
        }
    }

    function handleKeydownEvent(event) {
        if (!event || !isInitialized) return;
        var modal = document.getElementById('role-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (event.key === 'Escape') {
            closeRoleModal();
            return;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            var activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                event.preventDefault();
                saveRole();
                return;
            }
        }

        if (event.key === 'Tab') {
            var focusableElements = Array.prototype.slice.call(
                modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])')
            ).filter(function(el) {
                if (!el) return false;
                var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
                if (style && (style.display === 'none' || style.visibility === 'hidden')) {
                    return false;
                }
                
                var parent = el.parentElement;
                while (parent && parent !== modal) {
                    var pStyle = global.getComputedStyle ? global.getComputedStyle(parent) : null;
                    if (pStyle && (pStyle.display === 'none' || pStyle.visibility === 'hidden')) {
                        return false;
                    }
                    parent = parent.parentElement;
                }

                return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
            });

            if (focusableElements.length === 0) {
                event.preventDefault();
                return;
            }
            
            var firstElement = focusableElements[0];
            var lastElement = focusableElements[focusableElements.length - 1];

            try {
                if (!modal.contains(document.activeElement)) {
                    firstElement.focus();
                    event.preventDefault();
                    return;
                }

                if (event.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        event.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        event.preventDefault();
                    }
                }
            } catch (e) {}
        }
    }

    function handleDelegatedInputEvent(event) {
        var targetEl = getElementTarget(event && event.target);
        if (!targetEl || targetEl.id !== 'inp-role-id' || !isInitialized) return;
        var start = targetEl.selectionStart;
        var end = targetEl.selectionEnd;
        var cleaned = targetEl.value.replace(/[^a-zA-Z0-9_-]/g, '');
        if (cleaned !== targetEl.value) {
            targetEl.value = cleaned;
            try {
                targetEl.setSelectionRange(Math.min(start, cleaned.length), Math.min(end, cleaned.length));
            } catch (e) {}
        }
    }

    function handleDelegatedPasteEvent(event) {
        var targetEl = getElementTarget(event && event.target);
        if (!targetEl || targetEl.id !== 'inp-role-id' || !isInitialized) return;
        event.preventDefault();
        var clipboardData = event.clipboardData || global.clipboardData;
        var text = clipboardData ? clipboardData.getData('text') : '';
        var cleaned = text.replace(/[^a-zA-Z0-9_-]/g, '');
        var start = targetEl.selectionStart;
        var end = targetEl.selectionEnd;
        var val = targetEl.value;
        targetEl.value = val.substring(0, start) + cleaned + val.substring(end);
        try {
            targetEl.setSelectionRange(start + cleaned.length, start + cleaned.length);
        } catch (e) {}
    }

    function initModalBackdrop() {
        var modal = document.getElementById('role-modal');
        if (modal && !modal.dataset.backdropInitialized) {
            modal.dataset.backdropInitialized = 'true';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    function openRoleModal(triggerElement) {
        if (!isInitialized) return;
        initModalBackdrop();
        lastActiveElement = triggerElement || document.activeElement;
        editingOriginalId = null;
        var modalTitle = document.getElementById('role-modal-title');
        var idInput = document.getElementById('inp-role-id');
        var nameInput = document.getElementById('inp-role-name');
        var accessInput = document.getElementById('inp-role-access');
        var modal = document.getElementById('role-modal');

        if (modalTitle) modalTitle.innerText = 'Tambah Role Baru';
        
        if (idInput) {
            idInput.value = '';
            idInput.readOnly = false;
            idInput.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        if (nameInput) nameInput.value = '';
        if (accessInput) accessInput.value = '';
        
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }

        requestAnimationFrame(function() {
            if (idInput && document.body.contains(idInput)) {
                try { idInput.focus(); } catch(e) {}
            }
        });
    }

    function openEditRoleModal(roleId, triggerElement) {
        if (!isInitialized) return;
        initModalBackdrop();
        lastActiveElement = triggerElement || document.activeElement;
        var roles = getValidRoles();
        var r = roles.find(function(item) { return item && String(item.id) === String(roleId); });
        
        if (!r) {
            safeToast('Data role tidak ditemukan.', 'error');
            return;
        }

        editingOriginalId = String(r.id);
        var modalTitle = document.getElementById('role-modal-title');
        var idInput = document.getElementById('inp-role-id');
        var nameInput = document.getElementById('inp-role-name');
        var accessInput = document.getElementById('inp-role-access');
        var modal = document.getElementById('role-modal');

        if (modalTitle) modalTitle.innerText = 'Edit Role';
        
        if (idInput) {
            idInput.value = r.id;
            idInput.readOnly = true;
            idInput.classList.add('opacity-50', 'cursor-not-allowed');
        }

        if (nameInput) nameInput.value = r.name || '';
        if (accessInput) accessInput.value = r.access || '';
        
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }

        requestAnimationFrame(function() {
            if (nameInput && document.body.contains(nameInput)) {
                try { nameInput.focus(); } catch(e) {}
            }
        });
    }

    function closeRoleModal() {
        var modal = document.getElementById('role-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }

        var idInput = document.getElementById('inp-role-id');
        var nameInput = document.getElementById('inp-role-name');
        var accessInput = document.getElementById('inp-role-access');
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (accessInput) accessInput.value = '';

        if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
            try {
                if (document.body.contains(lastActiveElement)) {
                    lastActiveElement.focus();
                }
            } catch (e) {}
        }
        lastActiveElement = null;
        editingOriginalId = null;
    }

    async function saveRole(event) {
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        if (isModuleBusy || !isInitialized) return;

        var idInputEl = document.getElementById('inp-role-id');
        var nameInputEl = document.getElementById('inp-role-name');
        var accessInputEl = document.getElementById('inp-role-access');

        if (!idInputEl || !nameInputEl || !accessInputEl) {
            safeToast('Komponen formulir tidak lengkap di DOM.', 'error');
            return;
        }

        var isEdit = Boolean(editingOriginalId);
        var id = isEdit ? editingOriginalId : sanitizeText(idInputEl.value);
        var name = sanitizeText(nameInputEl.value);
        var access = sanitizeText(accessInputEl.value);

        if (!id || !name) {
            safeToast('ID dan Nama Role wajib diisi!', 'error');
            return;
        }

        if (id.length > 50 || name.length > 100 || access.length > 255) {
            safeToast('Batas karakter terlampaui (ID maks 50, Nama maks 100, Access maks 255).', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            safeToast('ID Role hanya boleh berisi huruf, angka, underscore, dan dash tanpa spasi.', 'error');
            return;
        }

        var roles = getValidRoles();
        var existingIndex = roles.findIndex(function(r) { return r && String(r.id) === String(id); });

        if (!isEdit && existingIndex !== -1) {
            safeToast('ID Role tersebut sudah terdaftar secara lokal!', 'error');
            return;
        }

        isModuleBusy = true;
        var saveBtn = document.getElementById('btn-save-role');
        var originalBtnHtml = '';
        if (saveBtn) {
            saveBtn.disabled = true;
            originalBtnHtml = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        }

        try {
            var client = getSupabaseClient();
            if (!client || typeof client.from !== 'function') {
                throw new Error('Koneksi basis data Supabase belum terinisialisasi.');
            }

            var payload = { id: id, name: name, access: access };
            var res = await executeWithTimeout(function(signal) {
                var query = client.from('roles').upsert([payload], { onConflict: 'id' }).select();
                if (signal) {
                    if (typeof query.abortSignal === 'function') {
                        query = query.abortSignal(signal);
                    } else if (typeof query.signal === 'function') {
                        query = query.signal(signal);
                    }
                }
                return query;
            }, 15000) || {};
            
            if (res.error) {
                var errObj = typeof res.error === 'object' ? res.error : { message: String(res.error) };
                var detailedMsg = errObj.message || errObj.error_description || errObj.msg || 'Gagal menyimpan ke basis data.';
                if (errObj.code === '23505') {
                    detailedMsg = 'ID Role ini sudah digunakan.';
                } else if (errObj.code === '42501') {
                    detailedMsg = 'Akses ditolak oleh kebijakan keamanan server (RLS Policy).';
                } else if (errObj.code === '23503') {
                    detailedMsg = 'Operasi ditolak karena terikat dengan relasi data lain.';
                } else if (errObj.details) {
                    detailedMsg += ' (' + errObj.details + ')';
                }
                throw new Error(detailedMsg);
            }

            if (res.data && Array.isArray(res.data) && res.data.length > 0 && res.data[0]) {
                var serverItem = res.data[0];
                if (serverItem && typeof serverItem === 'object') {
                    payload = {
                        id: String(serverItem.id || id).trim(),
                        name: sanitizeText(serverItem.name || name),
                        access: sanitizeText(serverItem.access || access)
                    };
                }
            }

            if (existingIndex !== -1) {
                roles[existingIndex] = payload;
                safeToast('Role berhasil diperbarui.', 'success');
            } else {
                roles.push(payload);
                safeToast('Role baru berhasil ditambahkan.', 'success');
            }

            SafeStore.set('roles', roles.slice());
            closeRoleModal();
            renderRoles();

        } catch (err) {
            console.error('Gagal menyimpan role:', err);
            var errorMsg = err.message || 'Terjadi kesalahan pada sistem.';
            if (err.name === 'TypeError' && err.message && err.message.toLowerCase().indexOf('fetch') !== -1) {
                errorMsg = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
            }
            safeToast(errorMsg, 'error');
        } finally {
            isModuleBusy = false;
            if (saveBtn && document.body.contains(saveBtn)) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnHtml || 'Simpan';
            }
        }
    }

    async function deleteRole(roleId, triggerBtn) {
        if (!roleId || isModuleBusy || !isInitialized) return;
        
        isModuleBusy = true;
        var confirmAction = false;
        try {
            confirmAction = await showCustomConfirm('Apakah Anda yakin ingin menghapus role "' + roleId + '"?');
        } catch (e) {
            confirmAction = false;
        } finally {
            if (!confirmAction) {
                isModuleBusy = false;
            }
        }

        if (!confirmAction) return;

        var originalHtml = '';
        if (triggerBtn) {
            triggerBtn.disabled = true;
            originalHtml = triggerBtn.innerHTML;
            triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            var client = getSupabaseClient();
            if (!client || typeof client.from !== 'function') {
                throw new Error('Koneksi basis data Supabase belum terinisialisasi.');
            }

            var res = await executeWithTimeout(function(signal) {
                var query = client.from('roles').delete().eq('id', roleId);
                if (signal) {
                    if (typeof query.abortSignal === 'function') {
                        query = query.abortSignal(signal);
                    } else if (typeof query.signal === 'function') {
                        query = query.signal(signal);
                    }
                }
                return query;
            }, 15000) || {};

            if (res.error) {
                var errObj = typeof res.error === 'object' ? res.error : { message: String(res.error) };
                var detailedDelMsg = errObj.message || 'Gagal menghapus data dari server.';
                if (errObj.code === '42501') {
                    detailedDelMsg = 'Akses hapus ditolak oleh kebijakan keamanan server (RLS Policy).';
                } else if (errObj.code === '23503') {
                    detailedDelMsg = 'Role tidak dapat dihapus karena masih digunakan oleh data pengguna atau entitas terkait.';
                }
                throw new Error(detailedDelMsg);
            }

            var roles = getValidRoles().filter(function(r) {
                return String(r.id) !== String(roleId);
            });

            SafeStore.set('roles', roles);
            renderRoles();
            safeToast('Role berhasil dihapus.', 'success');

        } catch (err) {
            console.error('Gagal menghapus role:', err);
            safeToast(err.message || 'Terjadi kesalahan saat menghapus role.', 'error');
        } finally {
            isModuleBusy = false;
            if (triggerBtn && document.body.contains(triggerBtn)) {
                triggerBtn.disabled = false;
                triggerBtn.innerHTML = originalHtml || '<i class="fa-solid fa-trash"></i> Hapus';
            }
        }
    }

    function bootModule() {
        if (!isInitialized) return;
        initModalBackdrop();
        fetchAndSyncRoles();
        initRealtimeSubscription();
    }

    function handlePopState() {
        var tbody = document.getElementById('role-tbody');
        if (!tbody || !document.body.contains(tbody)) {
            destroy();
        }
    }

    function init() {
        if (isInitialized) return;
        isInitialized = true;

        global.addEventListener('storage', handleStorageEvent);
        global.addEventListener('popstate', handlePopState);
        document.addEventListener('click', handleClickEvent);
        document.addEventListener('submit', handleFormSubmitEvent);
        document.addEventListener('keydown', handleKeydownEvent);
        document.addEventListener('input', handleDelegatedInputEvent);
        document.addEventListener('paste', handleDelegatedPasteEvent);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootModule);
        } else {
            bootModule();
        }

        try {
            var targetDoc = document.body || document.documentElement;
            if (targetDoc) {
                domObserver = new MutationObserver(function(_, observer) {
                    var tbody = document.getElementById('role-tbody');
                    var modal = document.getElementById('role-modal');
                    if (tbody || modal) {
                        initModalBackdrop();
                        renderRoles();
                        observer.disconnect();
                        domObserver = null;
                    }
                });
                domObserver.observe(targetDoc, { childList: true, subtree: true });
            }
        } catch (e) {}
    }

    function destroy() {
        if (!isInitialized) return;
        try {
            global.removeEventListener('storage', handleStorageEvent);
            global.removeEventListener('popstate', handlePopState);
            document.removeEventListener('click', handleClickEvent);
            document.removeEventListener('submit', handleFormSubmitEvent);
            document.removeEventListener('keydown', handleKeydownEvent);
            document.removeEventListener('input', handleDelegatedInputEvent);
            document.removeEventListener('paste', handleDelegatedPasteEvent);

            if (realtimeRetryTimer) {
                clearTimeout(realtimeRetryTimer);
                realtimeRetryTimer = null;
            }

            if (realtimeDebounceTimer) {
                clearTimeout(realtimeDebounceTimer);
                realtimeDebounceTimer = null;
            }

            if (clientInitRetryTimer) {
                clearTimeout(clientInitRetryTimer);
                clientInitRetryTimer = null;
            }

            if (domObserver && typeof domObserver.disconnect === 'function') {
                domObserver.disconnect();
                domObserver = null;
            }

            var client = getSupabaseClient();
            if (realtimeChannel) {
                if (typeof realtimeChannel.unsubscribe === 'function') {
                    try { realtimeChannel.unsubscribe(); } catch (e) {}
                }
                if (client && typeof client.removeChannel === 'function') {
                    try { client.removeChannel(realtimeChannel); } catch (e) {}
                }
                realtimeChannel = null;
            }

            var modal = document.getElementById('role-modal');
            if (modal) {
                delete modal.dataset.backdropInitialized;
            }

            var confirmModal = document.getElementById('role-custom-confirm-modal');
            if (confirmModal) {
                try { confirmModal.remove(); } catch (e) {}
            }
        } catch (e) {}

        try {
            delete global.renderRoles;
            delete global.openRoleModal;
            delete global.openEditRoleModal;
            delete global.closeRoleModal;
            delete global.saveRole;
            delete global.deleteRole;
            delete global.fetchAndSyncRoles;
            delete global.destroyRoleModule;
            delete global.RoleModule;
        } catch (e) {
            global.renderRoles = undefined;
            global.openRoleModal = undefined;
            global.openEditRoleModal = undefined;
            global.closeRoleModal = undefined;
            global.saveRole = undefined;
            global.deleteRole = undefined;
            global.fetchAndSyncRoles = undefined;
            global.destroyRoleModule = undefined;
            global.RoleModule = undefined;
        }

        lastActiveElement = null;
        editingOriginalId = null;
        cachedRoleSelectPlaceholder = null;
        cachedPlaceholderHtmlLength = -1;
        isSyncing = false;
        isInitialized = false;
        syncCounter++;
    }

    var RoleModuleAPI = {
        init: init,
        destroy: destroy,
        renderRoles: renderRoles,
        openRoleModal: openRoleModal,
        openEditRoleModal: openEditRoleModal,
        closeRoleModal: closeRoleModal,
        saveRole: saveRole,
        deleteRole: deleteRole,
        fetchAndSyncRoles: fetchAndSyncRoles,
        get isInitialized() { return isInitialized; }
    };

    global.RoleModule = RoleModuleAPI;
    global.renderRoles = renderRoles;
    global.openRoleModal = openRoleModal;
    global.openEditRoleModal = openEditRoleModal;
    global.closeRoleModal = closeRoleModal;
    global.saveRole = saveRole;
    global.deleteRole = deleteRole;
    global.fetchAndSyncRoles = fetchAndSyncRoles;
    global.destroyRoleModule = destroy;

    init();

})(typeof window !== 'undefined' ? window : this);