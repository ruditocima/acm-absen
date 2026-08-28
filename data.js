
# ============================================================
# FILE 6: data.js — Fetch Data dengan Pagination & Fallback
# ============================================================
data_js = r'''// ============================================================
// DATA: Fetch dari Supabase dengan Pagination & Fallback
// ============================================================

function loadFallbackData() {
    const roles = Store.get('roles');
    const basecamps = Store.get('basecamps');

    if (roles.length === 0) {
        Store.set('roles', [
            { id: 'ROL-01', name: 'Master Admin', access: 'Dashboard, Rekap, Role, Karyawan, Basecamp, Izin, Email' },
            { id: 'ROL-02', name: 'Manajer Lapangan', access: 'Dashboard, Rekap, Karyawan, Basecamp, Izin, Email' },
            { id: 'ROL-03', name: 'Karyawan / Field', access: 'Dashboard, Rekap, Basecamp, Email' },
            { id: 'ROL-04', name: 'Supervisor Field', access: 'Dashboard, Rekap, Basecamp, Izin, Email' },
            { id: 'ROL-05', name: 'Admin', access: 'Dashboard, Rekap, Basecamp, Izin, Email' }
        ]);
    }
    if (basecamps.length === 0) {
        Store.set('basecamps', [{ id: 1, name: 'Basecamp Pekanbaru Pusat', lat: 0.434291, lng: 101.466385, radius: 1500 }]);
    }
}

// --------------------------------------------------------
// FETCH ALL DATA (dengan pagination untuk rekap)
// --------------------------------------------------------
async function fetchAllDataFromSupabase() {
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
        showToast("Tidak dapat terhubung ke Supabase. Menggunakan data lokal.", "warning");
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

    // 1. ROLES
    try {
        const { data: rData, error: rErr } = await supabaseClient.from('roles').select('*');
        if (rErr) console.warn('[Supabase] Roles fetch error:', rErr.message, rErr.code);
        if (rData && rData.length > 0) Store.set('roles', rData);
        else loadFallbackData();
        const kfRole = Store.get('roles').find(r => r.name === 'Karyawan / Field');
        if (kfRole) kfRole.access = 'Dashboard, Rekap, Basecamp, Email';
    } catch (err) {
        console.error('[Supabase] Roles exception:', err);
        loadFallbackData();
    }

    // 2. BASECAMPS
    try {
        const { data: bData, error: bErr } = await supabaseClient.from('basecamps').select('*');
        if (bErr) console.warn('[Supabase] Basecamps fetch error:', bErr.message);
        if (bData && bData.length > 0) Store.set('basecamps', bData);
        else if (Store.get('basecamps').length === 0) loadFallbackData();
    } catch (err) {
        console.error('[Supabase] Basecamps exception:', err);
    }

    // 3. EMPLOYEES
    try {
        const { data: eData, error: eErr } = await supabaseClient.from('employees').select('*');
        if (eErr) {
            console.warn('[Supabase] Employees fetch error:', eErr.message, eErr.code);
            Store.set('employees', []);
        } else {
            Store.set('employees', (eData || []).map(e => ({
                id: e.id,
                name: e.name,
                position: e.position || '-',
                role: e.role,
                atasan: e.atasan,
                status: e.status,
                deviceId: e.device_id || 'Unbound',
                auth_id: e.auth_id
            })));
        }
    } catch (err) {
        console.error('[Supabase] Employees exception:', err);
        Store.set('employees', []);
    }

    // 4. REKAP LIST (dengan pagination — ambil 50 terbaru)
    try {
        const { data: rkData, error: rkErr } = await supabaseClient
            .from('rekap_list')
            .select('*', { count: 'exact' })
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .range(0, CONFIG.PAGINATION.REKAP_PER_PAGE - 1);

        if (rkErr) console.warn('[Supabase] Rekap fetch error:', rkErr.message);
        if (rkData) {
            Store.set('rekapList', rkData);
            Store.set('rekapPage', 0);
        }
        // Count total untuk pagination info
        const { count } = await supabaseClient.from('rekap_list').select('*', { count: 'exact', head: true });
        Store.set('rekapTotalCount', count || 0);
    } catch (err) {
        console.error('[Supabase] Rekap exception:', err);
    }

    // 5. IZIN LIST
    try {
        const { data: iData, error: iErr } = await supabaseClient.from('izin_list').select('*');
        if (iErr) console.warn('[Supabase] Izin fetch error:', iErr.message);
        if (iData) Store.set('izinList', iData);
    } catch (err) {
        console.error('[Supabase] Izin exception:', err);
    }

    // 6. EMAILS
    try {
        const { data: emData, error: emErr } = await supabaseClient.from('emails').select('*').order('created_at', { ascending: false });
        if (emErr) console.warn('[Supabase] Emails fetch error:', emErr.message);
        if (emData) {
            const readIds = getReadEmailIds();
            Store.set('emailsList', emData.map(e => ({
                id: e.id,
                sender: e.sender,
                sender_name: e.sender_name,
                receiver: e.recipient,
                subject: e.subject,
                message: e.message,
                created_at: e.created_at,
                read: readIds.includes(e.id)
            })));
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

// --------------------------------------------------------
// LOAD MORE REKAP (Pagination)
// --------------------------------------------------------
async function loadMoreRekap() {
    const currentPage = Store.get('rekapPage');
    const nextPage = currentPage + 1;
    const from = nextPage * CONFIG.PAGINATION.REKAP_PER_PAGE;
    const to = from + CONFIG.PAGINATION.REKAP_PER_PAGE - 1;

    showToast('Memuat data rekap lebih lama...', 'info');

    try {
        const { data, error } = await supabaseClient
            .from('rekap_list')
            .select('*')
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .range(from, to);

        if (error) throw error;
        if (data && data.length > 0) {
            const rekapList = Store.get('rekapList');
            Store.set('rekapList', [...rekapList, ...data]);
            Store.set('rekapPage', nextPage);
            renderRekap();
            showToast(`${data.length} data rekap lama dimuat.`, 'success');
        } else {
            showToast('Semua data rekap sudah dimuat.', 'info');
        }
    } catch (err) {
        console.error('Load more rekap error:', err);
        showToast('Gagal memuat data rekap.', 'error');
    }
}

// --------------------------------------------------------
// REFRESH ALL DATA
// --------------------------------------------------------
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
'''

with open('/mnt/agents/output/data.js', 'w', encoding='utf-8') as f:
    f.write(data_js)

print("✅ data.js created")
