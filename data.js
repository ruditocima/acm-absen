function loadFallbackData() {
    if (Store.get('roles').length === 0) {
        Store.set('roles', [
            { id: 'ROL-01', name: 'Master Admin', access: 'Dashboard, Rekap, Role, Karyawan, Basecamp, Izin, Email' },
            { id: 'ROL-02', name: 'Manajer Lapangan', access: 'Dashboard, Rekap, Karyawan, Basecamp, Izin, Email' },
            { id: 'ROL-03', name: 'Karyawan / Field', access: 'Dashboard, Rekap, Basecamp, Email' },
            { id: 'ROL-04', name: 'Supervisor Field', access: 'Dashboard, Rekap, Basecamp, Izin, Email' },
        ]);
    }
    if (Store.get('basecamps').length === 0) {
        Store.set('basecamps', [{ id: 1, name: 'Basecamp Pekanbaru Pusat', lat: 0.434291, lng: 101.466385, radius: 1500 }]);
    }
}

async function checkSupabaseConnection(retries) {
    if (retries === undefined) retries = 2;
    for (var i = 0; i <= retries; i++) {
        try {
            var result = await supabaseClient.from('roles').select('id').limit(1);
            if (result.error) {
                console.warn('[Supabase] Connection check attempt ' + (i + 1) + ' failed:', result.error.message);
                if (i < retries) await new Promise(function(r) { setTimeout(r, 800); });
                continue;
            }
            Store.set('supabaseConnected', true);
            return true;
        } catch (err) {
            console.error('[Supabase] Connection check attempt ' + (i + 1) + ' exception:', err);
            if (i < retries) await new Promise(function(r) { setTimeout(r, 800); });
        }
    }
    Store.set('supabaseConnected', false);
    return false;
}

async function fetchAllDataFromSupabase() {
    var isConnected = await checkSupabaseConnection();
    if (!isConnected) {
        showToast('Tidak dapat terhubung ke Supabase. Menggunakan data lokal.', 'warning');
        loadFallbackData();
        renderRoles();
        renderEmployees();
        renderRekap();
        renderBasecamps();
        renderAdminIzin();
        populateEmailRecipients();
        renderEmails();
        updateDashboardStats();
        return;
    }

    // Roles
    try {
        var r = await supabaseClient.from('roles').select('*');
        if (r.error) console.warn('[Supabase] Roles fetch error:', r.error.message);
        if (r.data && r.data.length > 0) Store.set('roles', r.data);
        else loadFallbackData();
        var kfRole = Store.get('roles').find(function(r) { return r.name === 'Karyawan / Field'; });
        if (kfRole) kfRole.access = 'Dashboard, Rekap, Basecamp, Email';
    } catch (err) {
        console.error('[Supabase] Roles exception:', err);
        loadFallbackData();
    }

    // Basecamps
    try {
        var b = await supabaseClient.from('basecamps').select('*');
        if (b.error) console.warn('[Supabase] Basecamps fetch error:', b.error.message);
        if (b.data && b.data.length > 0) Store.set('basecamps', b.data);
        else if (Store.get('basecamps').length === 0) loadFallbackData();
    } catch (err) {
        console.error('[Supabase] Basecamps exception:', err);
    }

    // Employees
    try {
        var e = await supabaseClient.from('employees').select('*');
        if (e.error) {
            console.warn('[Supabase] Employees fetch error:', e.error.message);
            Store.set('employees', []);
        } else {
            Store.set('employees', (e.data || []).map(function(emp) {
                return {
                    id: emp.id,
                    name: emp.name,
                    position: emp.position || '-',
                    role: emp.role,
                    atasan: emp.atasan,
                    status: emp.status,
                    deviceId: emp.device_id || 'Unbound',
                    auth_id: emp.auth_id
                };
            }));
        }
    } catch (err) {
        console.error('[Supabase] Employees exception:', err);
        Store.set('employees', []);
    }

    // Rekap List (dengan pagination)
    try {
        var rk = await supabaseClient
            .from('rekap_list')
            .select('*', { count: 'exact' })
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .range(0, CONFIG.PAGINATION.REKAP_PER_PAGE - 1);
        if (rk.error) console.warn('[Supabase] Rekap fetch error:', rk.error.message);
        if (rk.data) {
            Store.set('rekapList', rk.data);
            Store.set('rekapPage', 0);
        }
        var countResult = await supabaseClient.from('rekap_list').select('*', { count: 'exact', head: true });
        Store.set('rekapTotalCount', countResult.count || 0);
    } catch (err) {
        console.error('[Supabase] Rekap exception:', err);
    }

    // Izin List
    try {
        var iz = await supabaseClient.from('izin_list').select('*');
        if (iz.error) console.warn('[Supabase] Izin fetch error:', iz.error.message);
        if (iz.data) Store.set('izinList', iz.data);
    } catch (err) {
        console.error('[Supabase] Izin exception:', err);
    }

    // Emails
    try {
        var em = await supabaseClient.from('emails').select('*').order('created_at', { ascending: false });
        if (em.error) console.warn('[Supabase] Emails fetch error:', em.error.message);
        if (em.data) {
            var readIds = getReadEmailIds();
            Store.set('emailsList', em.data.map(function(e) {
                return {
                    id: e.id,
                    sender: e.sender,
                    sender_name: e.sender_name,
                    receiver: e.recipient,
                    subject: e.subject,
                    message: e.message,
                    created_at: e.created_at,
                    read: readIds.includes(e.id)
                };
            }));
        }
    } catch (err) {
        console.error('[Supabase] Emails exception:', err);
    }

    renderRoles();
    renderEmployees();
    renderRekap();
    renderBasecamps();
    renderAdminIzin();
    populateEmailRecipients();
    renderEmails();
    updateDashboardStats();
    renderEmployeeOfTheMonth();
    renderMobileEOM();
}

async function loadMoreRekap() {
    var currentPage = Store.get('rekapPage');
    var nextPage = currentPage + 1;
    var from = nextPage * CONFIG.PAGINATION.REKAP_PER_PAGE;
    var to = from + CONFIG.PAGINATION.REKAP_PER_PAGE - 1;

    showToast('Memuat data rekap lebih lama...', 'info');

    try {
        var result = await supabaseClient
            .from('rekap_list')
            .select('*')
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .range(from, to);

        if (result.error) throw result.error;
        if (result.data && result.data.length > 0) {
            var rekapList = Store.get('rekapList');
            Store.set('rekapList', rekapList.concat(result.data));
            Store.set('rekapPage', nextPage);
            renderRekap();
            showToast(result.data.length + ' data rekap lama dimuat.', 'success');
        } else {
            showToast('Semua data rekap sudah dimuat.', 'info');
        }
    } catch (err) {
        console.error('Load more rekap error:', err);
        showToast('Gagal memuat data rekap.', 'error');
    }
}

async function refreshAllData() {
    showToast('Memuat ulang data dari server...', 'info');
    await fetchAllDataFromSupabase();
    renderEmployees();
    renderRekap();
    renderBasecamps();
    renderAdminIzin();
    renderEmails();
    updateEmailBadges();
    updateDashboardStats();
    showToast('Data berhasil diperbarui!', 'success');
}
