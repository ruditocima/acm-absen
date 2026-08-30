/**
 * UI Navigation & Role Permission Controller Module
 * Enterprise-Grade, Ultra-Resilient, Memory-Safe, Re-entrancy Protected, SPA-Compatible, A11y-Enhanced
 */
(function(window, document, undefined) {
    'use strict';

    if (window.__uiControllerInstance) {
        try {
            if (typeof window.__uiControllerInstance.destroy === 'function') {
                window.__uiControllerInstance.destroy();
            }
        } catch (e) {}
    }

    var isApplyingPermissions = false;
    var pendingPermissionRetry = false;
    var uiObserver = null;
    var observerTimer = null;
    var mapResizeTimer = null;
    var boundListeners = {};
    var registeredDynamicTabs = {
        desktop: [],
        mobile: []
    };

    function safeStoreGet(key, isRaw) {
        var rawVal = null;
        try {
            if (typeof Store !== 'undefined' && typeof Store.get === 'function') {
                rawVal = Store.get(key);
                if (rawVal && typeof rawVal.then === 'function') {
                    rawVal = null;
                }
            }
        } catch (err) {
            console.error('[SafeStore] Exception retrieving from Store wrapper for key "' + key + '":', err);
        }

        if (rawVal == null && typeof localStorage !== 'undefined') {
            try {
                rawVal = localStorage.getItem(key);
            } catch (lsErr) {
                console.error('[SafeStore] Exception retrieving from localStorage for key "' + key + '":', lsErr);
            }
        }

        if (rawVal == null) return null;
        if (isRaw) return rawVal;

        if (typeof rawVal === 'string') {
            try {
                return JSON.parse(rawVal);
            } catch (jsonErr) {
                return rawVal;
            }
        }
        return rawVal;
    }

    function safeInvoke(fn, context, args) {
        if (typeof fn !== 'function') return null;
        try {
            return fn.apply(context, args || []);
        } catch (err) {
            console.error('[SafeInvoke] Exception caught in external handler:', err);
            return null;
        }
    }

    function safeClassToggle(el, className, force) {
        if (!el || !el.classList || typeof el.classList.toggle !== 'function') return;
        try {
            var cleanCls = String(className || '').trim();
            if (cleanCls) {
                el.classList.toggle(cleanCls, force);
                if (el.hasAttribute('aria-hidden')) {
                    el.setAttribute('aria-hidden', force ? 'false' : 'true');
                }
            }
        } catch (e) {}
    }

    function safeClassAdd(el) {
        if (!el || !el.classList || typeof el.classList.add !== 'function') return;
        try {
            for (var i = 1; i < arguments.length; i++) {
                var arg = arguments[i];
                if (!arg) continue;
                if (typeof arg === 'string') {
                    var tokens = arg.split(/\s+/);
                    for (var j = 0; j < tokens.length; j++) {
                        var token = tokens[j].trim();
                        if (token) el.classList.add(token);
                    }
                } else if (Array.isArray(arg)) {
                    for (var k = 0; k < arg.length; k++) {
                        if (arg[k] && typeof arg[k] === 'string') {
                            var subTokens = arg[k].split(/\s+/);
                            for (var l = 0; l < subTokens.length; l++) {
                                var subToken = subTokens[l].trim();
                                if (subToken) el.classList.add(subToken);
                            }
                        }
                    }
                }
            }
            if (el.classList.contains('hidden')) {
                el.setAttribute('aria-hidden', 'true');
            }
        } catch (e) {}
    }

    function safeClassRemove(el) {
        if (!el || !el.classList || typeof el.classList.remove !== 'function') return;
        try {
            for (var i = 1; i < arguments.length; i++) {
                var arg = arguments[i];
                if (!arg) continue;
                if (typeof arg === 'string') {
                    var tokens = arg.split(/\s+/);
                    for (var j = 0; j < tokens.length; j++) {
                        var token = tokens[j].trim();
                        if (token) el.classList.remove(token);
                    }
                } else if (Array.isArray(arg)) {
                    for (var k = 0; k < arg.length; k++) {
                        if (arg[k] && typeof arg[k] === 'string') {
                            var subTokens = arg[k].split(/\s+/);
                            for (var l = 0; l < subTokens.length; l++) {
                                var subToken = subTokens[l].trim();
                                if (subToken) el.classList.remove(subToken);
                            }
                        }
                    }
                }
            }
            if (!el.classList.contains('hidden')) {
                el.setAttribute('aria-hidden', 'false');
            }
        } catch (e) {}
    }

    function dispatchCustomEvt(eventName, detailData) {
        try {
            var evt;
            var data = detailData || {};
            if (typeof window.CustomEvent === 'function') {
                try {
                    evt = new CustomEvent(eventName, { detail: data });
                } catch (e) {
                    evt = null;
                }
            }
            if (!evt) {
                try {
                    evt = document.createEvent('CustomEvent');
                    evt.initCustomEvent(eventName, true, true, data);
                } catch (ex) {
                    evt = document.createEvent('HTMLEvents');
                    evt.initEvent(eventName, true, true);
                    evt.detail = data;
                }
            }
            if (evt && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(evt);
            }
        } catch (err) {
            console.error('[Event] Failed to dispatch custom event "' + eventName + '":', err);
        }
    }

    function triggerChangeEvent(el) {
        if (!el || typeof el.dispatchEvent !== 'function') return;
        try {
            var evt;
            try {
                evt = new Event('change', { bubbles: true });
            } catch (e) {
                evt = document.createEvent('HTMLEvents');
                evt.initEvent('change', true, true);
            }
            el.dispatchEvent(evt);
        } catch (err) {
            console.error('[Event] Failed to dispatch change event:', err);
        }
    }

    function extractAccessTokens(data, tokenSet, visited, depth) {
        if (data == null) return;
        var currentDepth = (typeof depth === 'number') ? depth : 0;
        if (currentDepth > 15) return;

        if (!visited) {
            visited = (typeof WeakSet === 'function') ? new WeakSet() : {
                _set: (typeof Set === 'function') ? new Set() : [],
                has: function(item) {
                    return this._set.has ? this._set.has(item) : (this._set.indexOf(item) !== -1);
                },
                add: function(item) {
                    if (this._set.add) this._set.add(item);
                    else if (this._set.indexOf(item) === -1) this._set.push(item);
                }
            };
        }

        if (typeof data === 'string') {
            try {
                var parsed = JSON.parse(data);
                if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
                    extractAccessTokens(parsed, tokenSet, visited, currentDepth + 1);
                    return;
                }
            } catch (e) {}
        }

        if (typeof data === 'object' && data !== null) {
            try {
                if (visited.has(data)) return;
                visited.add(data);
            } catch (vErr) {
                return;
            }
        }

        if (Array.isArray(data)) {
            data.forEach(function(item) {
                extractAccessTokens(item, tokenSet, visited, currentDepth + 1);
            });
        } else if (typeof data === 'object' && data !== null) {
            var identifierKeys = ['name', 'id', 'key', 'slug', 'value', 'permission', 'access', 'module', 'code'];
            var hasIdentifierMatch = false;

            identifierKeys.forEach(function(k) {
                try {
                    if (Object.prototype.hasOwnProperty.call(data, k) && data[k] != null && typeof data[k] !== 'function') {
                        var val = data[k];
                        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                            hasIdentifierMatch = true;
                            String(val).split(/[\s,;._-]+/).filter(Boolean).forEach(function(token) {
                                var cleaned = String(token).toLowerCase().trim();
                                if (cleaned) tokenSet[cleaned] = true;
                            });
                        } else {
                            extractAccessTokens(val, tokenSet, visited, currentDepth + 1);
                        }
                    }
                } catch (propErr) {}
            });

            var nestedKeys = ['children', 'sub', 'items', 'permissions', 'modules', 'subModules', 'accessList'];
            var hasNestedMatch = false;
            nestedKeys.forEach(function(sk) {
                try {
                    if (Object.prototype.hasOwnProperty.call(data, sk) && data[sk]) {
                        hasNestedMatch = true;
                        extractAccessTokens(data[sk], tokenSet, visited, currentDepth + 1);
                    }
                } catch (nestedErr) {}
            });

            if (!hasIdentifierMatch && !hasNestedMatch) {
                Object.keys(data).forEach(function(prop) {
                    try {
                        if (!Object.prototype.hasOwnProperty.call(data, prop)) return;
                        var val = data[prop];
                        if (typeof val === 'function') return;
                        if (val === true || val === 1 || val === '1' || val === 'true') {
                            String(prop).split(/[\s,;._-]+/).filter(Boolean).forEach(function(token) {
                                var cleanedProp = String(token).toLowerCase().trim();
                                if (cleanedProp) tokenSet[cleanedProp] = true;
                            });
                        } else if (val && (typeof val === 'object' || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean')) {
                            extractAccessTokens(val, tokenSet, visited, currentDepth + 1);
                        }
                    } catch (keyErr) {}
                });
            }
        } else if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
            String(data).split(/[\s,;._-]+/).filter(Boolean).forEach(function(token) {
                var cleaned = String(token).toLowerCase().trim();
                if (cleaned) tokenSet[cleaned] = true;
            });
        }
    }

    function invokeDynamicRenderer(tabStr, platform) {
        if (!tabStr) return;
        var clean = String(tabStr).replace(/[^a-zA-Z0-9_-]/g, '').trim();
        if (!clean) return;
        var prefix = platform === 'mobile' ? 'renderMobile' : 'render';
        var parts = clean.split(/[\s,;._-]+/).filter(Boolean);
        if (parts.length === 0) return;
        
        var pascal = parts.map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); }).join('');
        var camel = parts[0].toLowerCase() + parts.slice(1).map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); }).join('');
        
        var candidates = [
            prefix + pascal,
            prefix + camel,
            prefix + clean,
            prefix + clean.charAt(0).toUpperCase() + clean.slice(1)
        ];

        for (var i = 0; i < candidates.length; i++) {
            var fnName = candidates[i];
            if (typeof window[fnName] === 'function') {
                safeInvoke(window[fnName], window);
                return;
            }
        }
    }

    function switchMode(mode) {
        var cleanMode = mode ? String(mode).toLowerCase() : 'desktop';
        var session = safeStoreGet('activeEmployeeSession');
        
        if (session && typeof session === 'object' && session.name && String(session.name).trim() !== 'Tamu' && typeof window.handleLogout === 'function') {
            try {
                var logoutResult = safeInvoke(window.handleLogout, window, [true]);
                if (logoutResult && typeof logoutResult.then === 'function') {
                    logoutResult.then(function() {
                        executeSwitchMode(cleanMode);
                    }).catch(function(err) {
                        console.error('[Auth] Logout promise rejected during mode switch:', err);
                        executeSwitchMode(cleanMode);
                    });
                    return;
                } else {
                    executeSwitchMode(cleanMode);
                    return;
                }
            } catch (e) {
                console.error('[Auth] Critical exception during logout execution:', e);
                executeSwitchMode(cleanMode);
            }
        }
        executeSwitchMode(cleanMode);
    }

    function executeSwitchMode(mode) {
        var cleanMode = mode ? String(mode).toLowerCase() : 'desktop';
        var viewMobile = document.getElementById('view-mobile');
        var viewDesktop = document.getElementById('view-desktop');
        var btnMobile = document.getElementById('btn-mobile');
        var btnDesktop = document.getElementById('btn-desktop');
        var desktopLoginSection = document.getElementById('desktop-login-section');
        var desktopAppWrapper = document.getElementById('desktop-app-wrapper');

        if (viewMobile) safeClassAdd(viewMobile, 'hidden');
        if (viewDesktop) safeClassAdd(viewDesktop, 'hidden');

        if (cleanMode === 'mobile') {
            if (viewMobile) safeClassRemove(viewMobile, 'hidden');
            if (btnMobile) {
                safeClassAdd(btnMobile, 'bg-gold-500 text-slate-950 shadow-md');
                safeClassRemove(btnMobile, 'bg-slate-800 text-slate-300 border border-slate-700');
                btnMobile.setAttribute('aria-selected', 'true');
            }
            if (btnDesktop) {
                safeClassAdd(btnDesktop, 'bg-slate-800 text-slate-300 border border-slate-700');
                safeClassRemove(btnDesktop, 'bg-gold-500 text-slate-950 shadow-md');
                btnDesktop.setAttribute('aria-selected', 'false');
            }
            switchMobileTab('daftar');
        } else {
            if (viewDesktop) safeClassRemove(viewDesktop, 'hidden');
            if (btnDesktop) {
                safeClassAdd(btnDesktop, 'bg-gold-500 text-slate-950 shadow-md');
                safeClassRemove(btnDesktop, 'bg-slate-800 text-slate-300 border border-slate-700');
                btnDesktop.setAttribute('aria-selected', 'true');
            }
            if (btnMobile) {
                safeClassAdd(btnMobile, 'bg-slate-800 text-slate-300 border border-slate-700');
                safeClassRemove(btnMobile, 'bg-gold-500 text-slate-950 shadow-md');
                btnMobile.setAttribute('aria-selected', 'false');
            }
            if (desktopLoginSection) safeClassRemove(desktopLoginSection, 'hidden');
            if (desktopAppWrapper) safeClassAdd(desktopAppWrapper, 'hidden');
        }

        dispatchCustomEvt('appModeChanged', { mode: cleanMode });
    }

    function switchMobileTab(tab) {
        if (mapResizeTimer) {
            clearTimeout(mapResizeTimer);
            mapResizeTimer = null;
        }

        var cleanTab = tab ? String(tab).toLowerCase() : 'daftar';
        var validTabs = ['daftar', 'absen', 'izin', 'email'].concat(registeredDynamicTabs.mobile);
        if (validTabs.indexOf(cleanTab) === -1) cleanTab = 'daftar';

        validTabs.forEach(function(t) {
            try {
                var tabEl = document.getElementById('m-tab-' + t);
                if (tabEl) safeClassAdd(tabEl, 'hidden');
                var btn = document.getElementById('m-nav-' + t);
                if (btn) {
                    safeClassRemove(btn, 'text-gold-400');
                    safeClassAdd(btn, 'text-slate-400');
                    btn.setAttribute('aria-selected', 'false');
                }
            } catch (e) {}
        });

        var activeTabEl = document.getElementById('m-tab-' + cleanTab);
        if (activeTabEl) {
            safeClassRemove(activeTabEl, 'hidden');
            try {
                if (!activeTabEl.hasAttribute('tabindex')) {
                    activeTabEl.setAttribute('tabindex', '-1');
                }
                if (typeof activeTabEl.focus === 'function') {
                    activeTabEl.focus({ preventScroll: true });
                }
            } catch (fErr) {}
        }

        var activeBtn = document.getElementById('m-nav-' + cleanTab);
        if (activeBtn) {
            safeClassRemove(activeBtn, 'text-slate-400');
            safeClassAdd(activeBtn, 'text-gold-400');
            activeBtn.setAttribute('aria-selected', 'true');
        }

        if (cleanTab === 'email') {
            switchMobileEmailSub('inbox');
        } else if (cleanTab === 'izin' && typeof window.renderMobileMyHistory === 'function') {
            safeInvoke(window.renderMobileMyHistory, window);
        } else if (['daftar', 'absen', 'izin', 'email'].indexOf(cleanTab) === -1) {
            invokeDynamicRenderer(cleanTab, 'mobile');
        }

        dispatchCustomEvt('mobileTabChanged', { tab: cleanTab });
    }

    function switchMobileEmailSub(sub) {
        var cleanSub = sub ? String(sub).toLowerCase() : 'inbox';
        var validSubs = ['inbox', 'sent', 'compose'];
        if (validSubs.indexOf(cleanSub) === -1) cleanSub = 'inbox';

        validSubs.forEach(function(s) {
            try {
                var sec = document.getElementById('m-email-' + s + '-section');
                var btn = document.getElementById('m-btn-' + s);
                if (sec) safeClassAdd(sec, 'hidden');
                if (btn) {
                    if (s === cleanSub) {
                        safeClassAdd(btn, 'bg-gold-500 text-slate-950 font-bold');
                        safeClassRemove(btn, 'text-slate-400');
                        btn.setAttribute('aria-selected', 'true');
                    } else {
                        safeClassRemove(btn, 'bg-gold-500 text-slate-950 font-bold');
                        safeClassAdd(btn, 'text-slate-400');
                        btn.setAttribute('aria-selected', 'false');
                    }
                }
            } catch (e) {}
        });

        var activeSec = document.getElementById('m-email-' + cleanSub + '-section');
        if (activeSec) safeClassRemove(activeSec, 'hidden');

        if (cleanSub === 'compose') {
            var rec = document.getElementById('m-email-recipient');
            var subj = document.getElementById('m-email-subject');
            var msg = document.getElementById('m-email-message');
            if (rec) {
                rec.value = 'BROADCAST';
                triggerChangeEvent(rec);
            }
            if (subj) subj.value = '';
            if (msg) msg.value = '';
        } else if ((cleanSub === 'inbox' || cleanSub === 'sent') && typeof window.renderEmails === 'function') {
            safeInvoke(window.renderEmails, window, [cleanSub]);
        }
    }

    function switchDesktopTab(tab) {
        if (mapResizeTimer) {
            clearTimeout(mapResizeTimer);
            mapResizeTimer = null;
        }

        var cleanTab = tab ? String(tab).toLowerCase() : 'dashboard';
        var validTabs = ['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin', 'email', 'libur'].concat(registeredDynamicTabs.desktop);
        if (validTabs.indexOf(cleanTab) === -1) cleanTab = 'dashboard';

        validTabs.forEach(function(t) {
            try {
                var el = document.getElementById('d-tab-' + t);
                var btn = document.getElementById('d-nav-' + t);
                if (el) safeClassAdd(el, 'hidden');
                if (btn) {
                    safeClassRemove(btn, 'bg-gold-500/10 text-gold-400 border border-gold-500/20');
                    safeClassAdd(btn, 'text-slate-400 hover:bg-slate-800 hover:text-white');
                    btn.setAttribute('aria-selected', 'false');
                }
            } catch (e) {}
        });

        var activeEl = document.getElementById('d-tab-' + cleanTab);
        var activeBtn = document.getElementById('d-nav-' + cleanTab);
        if (activeEl) {
            safeClassRemove(activeEl, 'hidden');
            try {
                if (!activeEl.hasAttribute('tabindex')) {
                    activeEl.setAttribute('tabindex', '-1');
                }
                if (typeof activeEl.focus === 'function') {
                    activeEl.focus({ preventScroll: true });
                }
            } catch (fErr) {}
        }
        if (activeBtn) {
            safeClassRemove(activeBtn, 'text-slate-400 hover:bg-slate-800 hover:text-white');
            safeClassAdd(activeBtn, 'bg-gold-500/10 text-gold-400 border border-gold-500/20');
            activeBtn.setAttribute('aria-selected', 'true');
        }

        if (cleanTab === 'rekap') {
            safeInvoke(window.renderRekap, window);
        } else if (cleanTab === 'karyawan') {
            safeInvoke(window.renderEmployees, window);
        } else if (cleanTab === 'basecamp') {
            safeInvoke(window.renderBasecamps, window);
            
            var triggerMapResize = function(retries) {
                var attempt = typeof retries === 'number' ? retries : 0;
                var bcMapInstance = window.bcMap;
                if (bcMapInstance && typeof bcMapInstance.invalidateSize === 'function') {
                    try {
                        var mapContainer = bcMapInstance.getContainer ? bcMapInstance.getContainer() : null;
                        if (mapContainer && document.body.contains(mapContainer) && mapContainer.offsetWidth > 0 && mapContainer.offsetHeight > 0) {
                            bcMapInstance.invalidateSize(true);
                            return;
                        }
                    } catch (mapErr) {
                        console.error('[Map] Failed to invalidate basecamp map size:', mapErr);
                    }
                }
                if (attempt < 5) {
                    mapResizeTimer = setTimeout(function() {
                        triggerMapResize(attempt + 1);
                    }, 120 * (attempt + 1));
                }
            };

            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(function() {
                    triggerMapResize(0);
                });
            } else {
                triggerMapResize(0);
            }
        } else if (cleanTab === 'email') {
            switchDesktopEmailSub('inbox');
        } else if (cleanTab === 'libur') {
            safeInvoke(window.renderLibur, window);
        } else if (['dashboard', 'rekap', 'role', 'karyawan', 'basecamp', 'izin', 'email', 'libur'].indexOf(cleanTab) === -1) {
            invokeDynamicRenderer(cleanTab, 'desktop');
        }

        dispatchCustomEvt('desktopTabChanged', { tab: cleanTab });
    }

    function switchDesktopEmailSub(sub) {
        var cleanSub = sub ? String(sub).toLowerCase() : 'inbox';
        var validSubs = ['inbox', 'sent', 'compose'];
        if (validSubs.indexOf(cleanSub) === -1) cleanSub = 'inbox';

        validSubs.forEach(function(s) {
            try {
                var sec = document.getElementById('d-email-' + s + '-section');
                var btn = document.getElementById('d-btn-' + s);
                if (sec) safeClassAdd(sec, 'hidden');
                if (btn) {
                    if (s === cleanSub) {
                        safeClassAdd(btn, 'bg-gold-500 text-slate-950 shadow font-bold');
                        safeClassRemove(btn, 'bg-slate-900 text-slate-300 border border-slate-800');
                        btn.setAttribute('aria-selected', 'true');
                    } else {
                        safeClassRemove(btn, 'bg-gold-500 text-slate-950 shadow font-bold');
                        safeClassAdd(btn, 'bg-slate-900 text-slate-300 border border-slate-800');
                        btn.setAttribute('aria-selected', 'false');
                    }
                }
            } catch (e) {}
        });

        var activeSec = document.getElementById('d-email-' + cleanSub + '-section');
        if (activeSec) safeClassRemove(activeSec, 'hidden');

        if (cleanSub === 'compose') {
            var rec = document.getElementById('d-email-recipient');
            var subj = document.getElementById('d-email-subject');
            var msg = document.getElementById('d-email-message');
            if (rec) {
                rec.value = 'BROADCAST';
                triggerChangeEvent(rec);
            }
            if (subj) subj.value = '';
            if (msg) msg.value = '';
        } else if ((cleanSub === 'inbox' || cleanSub === 'sent') && typeof window.renderEmails === 'function') {
            safeInvoke(window.renderEmails, window, [cleanSub]);
        }
    }

    function applyRolePermissions(isInitialLoad) {
        if (isApplyingPermissions) {
            pendingPermissionRetry = true;
            return;
        }
        isApplyingPermissions = true;

        try {
            var session = safeStoreGet('activeEmployeeSession');
            if (!session || typeof session !== 'object') {
                session = { name: 'Tamu', role: 'Tamu' };
            }
            if (!session.name) session.name = 'Tamu';
            if (!session.role) session.role = 'Tamu';

            var initialEl = document.getElementById('desktop-user-initial');
            if (initialEl) {
                var cleanName = String(session.name).trim();
                var parts = cleanName.split(/\s+/).filter(Boolean);
                var initials = 'US';
                if (parts.length >= 2) {
                    var firstChar = parts[0] ? parts[0].charAt(0) : '';
                    var secondChar = parts[1] ? parts[1].charAt(0) : '';
                    initials = (firstChar + secondChar).toUpperCase();
                } else if (parts.length === 1) {
                    initials = parts[0].substring(0, 2).toUpperCase();
                }
                initialEl.innerText = initials || 'US';
            }

            var roleLabelEl = document.getElementById('desktop-role-label');
            if (roleLabelEl) {
                roleLabelEl.innerText = String(session.role);
            }

            var roleName = session.role ? String(session.role).trim() : 'Tamu';
            var roleLower = roleName.toLowerCase();
            
            var menuMapping = {
                'dashboard': 'd-nav-dashboard',
                'rekap': 'd-nav-rekap',
                'role': 'd-nav-role',
                'karyawan': 'd-nav-karyawan',
                'basecamp': 'd-nav-basecamp',
                'izin': 'd-nav-izin',
                'email': 'd-nav-email',
                'libur': 'd-nav-libur'
            };

            registeredDynamicTabs.desktop.forEach(function(dt) {
                if (!menuMapping[dt]) {
                    menuMapping[dt] = 'd-nav-' + dt;
                }
            });

            Object.keys(menuMapping).forEach(function(key) {
                var btnId = menuMapping[key];
                var btn = document.getElementById(btnId);
                if (btn) safeClassAdd(btn, 'hidden');
            });

            var dashBtn = document.getElementById('d-nav-dashboard');
            if (dashBtn) safeClassRemove(dashBtn, 'hidden');

            if (roleLower === 'master admin') {
                Object.keys(menuMapping).forEach(function(k) {
                    if (k === 'dashboard') return;
                    var b = document.getElementById(menuMapping[k]);
                    if (b) safeClassRemove(b, 'hidden');
                });
            } else if (roleLower === 'karyawan / field') {
                ['rekap', 'email', 'basecamp'].forEach(function(key) {
                    var b = document.getElementById(menuMapping[key]);
                    if (b) safeClassRemove(b, 'hidden');
                });
            } else if (roleLower === 'supervisor field') {
                ['rekap', 'izin', 'email', 'basecamp'].forEach(function(key) {
                    var b = document.getElementById(menuMapping[key]);
                    if (b) safeClassRemove(b, 'hidden');
                });
            } else if (roleLower === 'admin') {
                ['rekap', 'izin', 'email', 'basecamp', 'libur'].forEach(function(key) {
                    var b = document.getElementById(menuMapping[key]);
                    if (b) safeClassRemove(b, 'hidden');
                });
            } else {
                var roles = safeStoreGet('roles');
                var rData = null;
                if (Array.isArray(roles)) {
                    rData = roles.find(function(r) { return r && r.name && String(r.name).trim().toLowerCase() === roleLower; });
                } else if (roles && typeof roles === 'object') {
                    rData = roles[roleName] || roles[roleLower];
                    if (!rData) {
                        var roleKeys = Object.keys(roles);
                        for (var i = 0; i < roleKeys.length; i++) {
                            var val = roles[roleKeys[i]];
                            if (val && val.name && String(val.name).trim().toLowerCase() === roleLower) {
                                rData = val;
                                break;
                            }
                        }
                    }
                }
                
                var accessTokensSet = {};
                if (rData) {
                    extractAccessTokens(rData.access || rData.permissions || rData, accessTokensSet);
                }
                
                Object.keys(menuMapping).forEach(function(k2) {
                    if (k2 === 'dashboard') return;
                    var b2 = document.getElementById(menuMapping[k2]);
                    if (b2) {
                        var hasAccess = !!accessTokensSet[k2] || !!accessTokensSet['all'] || !!accessTokensSet['*'];
                        if (!hasAccess) {
                            var tokenKeys = Object.keys(accessTokensSet);
                            for (var t = 0; t < tokenKeys.length; t++) {
                                var tok = tokenKeys[t];
                                if (tok === k2) {
                                    hasAccess = true;
                                    break;
                                }
                                var segs = tok.split(/[\s,;._-]+/).filter(Boolean);
                                if (segs.indexOf(k2) !== -1) {
                                    hasAccess = true;
                                    break;
                                }
                            }
                        }
                        if (hasAccess) {
                            safeClassRemove(b2, 'hidden');
                        }
                    }
                });
            }

            var btnAddBasecamp = document.getElementById('btn-add-basecamp');
            if (btnAddBasecamp) {
                var canAddBc = (roleLower === 'master admin' || roleLower === 'supervisor field');
                safeClassToggle(btnAddBasecamp, 'hidden', !canAddBc);
            }

            var btnResetRekap = document.getElementById('btn-reset-rekap');
            if (btnResetRekap) {
                var canResetRekap = (roleLower === 'master admin');
                safeClassToggle(btnResetRekap, 'hidden', !canResetRekap);
            }

            if (isInitialLoad) {
                switchDesktopTab('dashboard');
            }

            dispatchCustomEvt('permissionsApplied', { role: roleName });
        } finally {
            isApplyingPermissions = false;
            if (pendingPermissionRetry) {
                pendingPermissionRetry = false;
                setTimeout(function() {
                    applyRolePermissions(false);
                }, 50);
            }
        }
    }

    function toggleAuthMode(mode) {
        var cleanMode = mode ? String(mode).toLowerCase() : 'login';
        var loginStep = document.getElementById('login-step');
        var regStep1 = document.getElementById('reg-step-1');
        var regStep2 = document.getElementById('reg-step-2');

        if (cleanMode === 'login') {
            if (loginStep) safeClassRemove(loginStep, 'hidden');
            if (regStep1) safeClassAdd(regStep1, 'hidden');
            if (regStep2) safeClassAdd(regStep2, 'hidden');
        } else {
            if (loginStep) safeClassAdd(loginStep, 'hidden');
            if (regStep1) safeClassRemove(regStep1, 'hidden');
            if (regStep2) safeClassRemove(regStep2, 'hidden');
        }

        dispatchCustomEvt('authModeToggled', { mode: cleanMode });
    }

    function registerDynamicTab(tabName, platform) {
        var cleanTab = tabName ? String(tabName).toLowerCase().trim() : '';
        var cleanPlatform = platform ? String(platform).toLowerCase().trim() : 'desktop';
        if (!cleanTab) return;
        if (cleanPlatform === 'mobile') {
            if (registeredDynamicTabs.mobile.indexOf(cleanTab) === -1) {
                registeredDynamicTabs.mobile.push(cleanTab);
            }
        } else {
            if (registeredDynamicTabs.desktop.indexOf(cleanTab) === -1) {
                registeredDynamicTabs.desktop.push(cleanTab);
            }
        }
        if (typeof window.applyRolePermissions === 'function') {
            window.applyRolePermissions(false);
        }
    }

    function initModule() {
        if (window.__uiControllerInitialized) return;
        window.__uiControllerInitialized = true;

        boundListeners.sessionUpdated = function() {
            if (typeof window.applyRolePermissions === 'function') {
                window.applyRolePermissions(false);
            }
        };
        boundListeners.rolesUpdated = function() {
            if (typeof window.applyRolePermissions === 'function') {
                window.applyRolePermissions(false);
            }
        };
        boundListeners.beforeunload = function() {
            destroyController();
        };

        window.addEventListener('sessionUpdated', boundListeners.sessionUpdated);
        window.addEventListener('rolesUpdated', boundListeners.rolesUpdated);
        window.addEventListener('beforeunload', boundListeners.beforeunload);

        if (typeof window.MutationObserver === 'function') {
            var setupObserver = function() {
                var targetNode = document.body;
                if (!targetNode) return;
                uiObserver = new MutationObserver(function(mutations) {
                    if (isApplyingPermissions) return;
                    var needsCheck = false;
                    for (var i = 0; i < mutations.length; i++) {
                        if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                            needsCheck = true;
                            break;
                        }
                    }
                    if (needsCheck) {
                        if (observerTimer) clearTimeout(observerTimer);
                        observerTimer = setTimeout(function() {
                            if (typeof window.requestAnimationFrame === 'function') {
                                window.requestAnimationFrame(function() {
                                    if (typeof window.applyRolePermissions === 'function') {
                                        window.applyRolePermissions(false);
                                    }
                                });
                            } else {
                                if (typeof window.applyRolePermissions === 'function') {
                                    window.applyRolePermissions(false);
                                }
                            }
                        }, 200);
                    }
                });
                try {
                    uiObserver.observe(targetNode, { childList: true, subtree: true });
                } catch (obsErr) {
                    console.error('[UI] MutationObserver initialization error:', obsErr);
                }
            };

            if (document.body) {
                setupObserver();
            } else {
                document.addEventListener('DOMContentLoaded', setupObserver);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof window.applyRolePermissions === 'function') {
                    window.applyRolePermissions(true);
                }
            });
        } else {
            setTimeout(function() {
                if (typeof window.applyRolePermissions === 'function') {
                    window.applyRolePermissions(true);
                }
            }, 0);
        }
    }

    function destroyController() {
        if (observerTimer) {
            clearTimeout(observerTimer);
            observerTimer = null;
        }
        if (mapResizeTimer) {
            clearTimeout(mapResizeTimer);
            mapResizeTimer = null;
        }
        if (uiObserver && typeof uiObserver.disconnect === 'function') {
            try { uiObserver.disconnect(); } catch (e) {}
            uiObserver = null;
        }
        if (boundListeners.sessionUpdated) {
            window.removeEventListener('sessionUpdated', boundListeners.sessionUpdated);
        }
        if (boundListeners.rolesUpdated) {
            window.removeEventListener('rolesUpdated', boundListeners.rolesUpdated);
        }
        if (boundListeners.beforeunload) {
            window.removeEventListener('beforeunload', boundListeners.beforeunload);
        }
        registeredDynamicTabs.desktop = [];
        registeredDynamicTabs.mobile = [];
        window.__uiControllerInitialized = false;
        window.__uiControllerInstance = null;
    }

    initModule();

    window.__uiControllerInstance = {
        destroy: destroyController
    };

    window.switchMode = switchMode;
    window.switchMobileTab = switchMobileTab;
    window.switchMobileEmailSub = switchMobileEmailSub;
    window.switchDesktopTab = switchDesktopTab;
    window.switchDesktopEmailSub = switchDesktopEmailSub;
    window.applyRolePermissions = applyRolePermissions;
    window.toggleAuthMode = toggleAuthMode;
    window.registerDynamicTab = registerDynamicTab;

})(window, document);