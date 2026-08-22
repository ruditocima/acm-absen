async function approveEmployeeAccount(index) {
    const emp = employees[index];
    emp.status = 'Approved';
    await supabaseClient.from('employees').update({ status: 'Approved' }).eq('id', emp.id);
    renderEmployees();
    updateDashboardStats();
    populateEmailRecipients();
    showToast('Akun disetujui!', 'success');
}

function resetEmployeeDevice(index) {
    if (!isMasterAdmin()) {
        showToast('Akses Ditolak! Hanya Master Admin yang dapat mereset device.', 'error');
        return;
    }
    showConfirm('Reset Perangkat', 'Reset ikatan perangkat (UUID) untuk ' + employees[index].name + '?', async function() {
        employees[index].deviceId = 'Unbound';
        await supabaseClient.from('employees').update({ device_id: 'Unbound' }).eq('id', employees[index].id);
        renderEmployees();
        showToast('Perangkat ' + employees[index].name + ' berhasil di-reset menjadi Unbound.', 'success');
    }, false);
}

function openAddEmployeeModal() {
    document.getElementById('modal-title').innerText = "Tambah Karyawan Baru";
    document.getElementById('edit-index').value = "-1";
    document.getElementById('inp-id').value = "";
    document.getElementById('inp-id').disabled = false;
    document.getElementById('inp-name').value = "";
    document.getElementById('inp-position').value = "";
    document.getElementById('inp-password').value = "";
    document.getElementById('employee-modal').classList.remove('hidden');
}

function openEditEmployeeModal(index) {
    const emp = employees[index];
    document.getElementById('modal-title').innerText = "Edit Data Karyawan";
    document.getElementById('edit-index').value = index;
    document.getElementById('inp-id').value = emp.id;
    document.getElementById('inp-id').disabled = true;
    document.getElementById('inp-name').value = emp.name;
    document.getElementById('inp-position').value = emp.position;
    document.getElementById('inp-role').value = emp.role;
    document.getElementById('inp-atasan').value = emp.atasan || 'Master Admin';
    document.getElementById('inp-password').value = "••••••••";
    document.getElementById('employee-modal').classList.remove('hidden');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
}

async function saveEmployee() {
    const index = parseInt(document.getElementById('edit-index').value);
    const id = document.getElementById('inp-id').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    const position = document.getElementById('inp-position').value.trim();
    const role = document.getElementById('inp-role').value;
    const atasan = document.getElementById('inp-atasan').value;
    const passInput = document.getElementById('inp-password').value.trim();
    if (!id || !name) { showToast('ID/Email dan Nama wajib diisi!', 'error'); return; }
    if (index === -1) {
        if (!passInput) { showToast('Password wajib diisi untuk karyawan baru!', 'error'); return; }
        const hashedPassword = await hashPassword(passInput);
        const newEmp = {
            id: id, name: name, position: position || 'Staff', role: role, atasan: atasan,
            password: hashedPassword, status: 'Approved', device_id: 'Unbound'
        };
        employees.push({ id: newEmp.id, name: newEmp.name, position: newEmp.position, role: newEmp.role, atasan: newEmp.atasan, password: newEmp.password, status: newEmp.status, deviceId: 'Unbound' });
        await supabaseClient.from('employees').insert([newEmp]);
        showToast('Karyawan baru berhasil ditambahkan.', 'success');
    } else {
        const emp = employees[index];
        let hashedPassword = emp.password;
        if (passInput && passInput !== '••••••••') {
            hashedPassword = await hashPassword(passInput);
        }
        emp.name = name;
        emp.position = position;
        emp.role = role;
        emp.atasan = atasan;
        emp.password = hashedPassword;
        await supabaseClient.from('employees').update({
            name: name, position: position, role: role, atasan: atasan, password: hashedPassword
        }).eq('id', id);
        showToast('Data karyawan berhasil diperbarui.', 'success');
    }
    closeEmployeeModal();
    renderEmployees();
    updateDashboardStats();
    populateEmailRecipients();
}

function renderEmployees() {
    const tbody = document.getElementById('karyawan-tbody');
    if (!tbody) return;
    const pendingCount = employees.filter(function(e) { return e.status === 'Pending'; }).length;
    const badge = document.getElementById('karyawan-pending-badge');
    if (badge) {
        if (pendingCount > 0) { badge.innerText = pendingCount + ' Pending'; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
    }
    tbody.innerHTML = employees.map(function(e, index) {
        const statusClass = e.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        const approveBtn = e.status === 'Pending' ? `<button onclick="approveEmployeeAccount(${index})" class="px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-[11px] font-semibold transition">Approve</button>` : '';
        return `
            <tr class="hover:bg-slate-900/50">
                <td class="p-3 font-mono text-white">${e.id}</td>
                <td class="p-3 font-semibold text-white">${e.name}</td>
                <td class="p-3 text-slate-300">${e.position}</td>
                <td class="p-3 text-slate-300">${e.role}</td>
                <td class="p-3 text-slate-300">${e.atasan || '-'}</td>
                <td class="p-3 font-mono text-slate-400 truncate max-w-[100px]">${e.password.substring(0,15)}...</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${e.status}</span>
                </td>
                <td class="p-3">
                    <div class="flex flex-wrap items-center gap-1.5">
                        ${approveBtn}
                        <button onclick="openEditEmployeeModal(${index})" class="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button onclick="resetEmployeeDevice(${index})" class="px-2 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded text-[11px] font-semibold transition" title="Reset Device UUID"><i class="fa-solid fa-mobile-screen"></i> Reset</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
    const atasanSelect = document.getElementById('inp-atasan');
    if (atasanSelect) {
        atasanSelect.innerHTML = '<option value="Master Admin">Master Admin</option>' + employees.map(function(emp) { return '<option value="' + emp.name + '">' + emp.name + '</option>'; }).join('');
    }
}

function renderRoles() {
    const tbody = document.getElementById('role-tbody');
    if (!tbody) return;
    tbody.innerHTML = roles.map(function(r, i) {
        return `
            <tr class="hover:bg-slate-900/50">
                <td class="p-3 font-mono text-gold-400">${r.id}</td>
                <td class="p-3 font-semibold text-white">${r.name}</td>
                <td class="p-3 text-slate-300">${r.access}</td>
                <td class="p-3">
                    <button onclick="openEditRoleModal(${i})" class="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition"><i class="fa-solid fa-pen"></i> Edit</button>
                </td>
            </tr>`;
    }).join('');
    const roleSelect = document.getElementById('inp-role');
    if (roleSelect) {
        roleSelect.innerHTML = roles.map(function(r) { return '<option value="' + r.name + '">' + r.name + '</option>'; }).join('');
    }
}

function openRoleModal() {
    document.getElementById('role-modal-title').innerText = "Tambah Role Baru";
    document.getElementById('role-edit-index').value = "-1";
    document.getElementById('inp-role-id').value = "";
    document.getElementById('inp-role-name').value = "";
    document.getElementById('inp-role-access').value = "";
    document.getElementById('role-modal').classList.remove('hidden');
}

function openEditRoleModal(index) {
    const r = roles[index];
    document.getElementById('role-modal-title').innerText = "Edit Role";
    document.getElementById('role-edit-index').value = index;
    document.getElementById('inp-role-id').value = r.id;
    document.getElementById('inp-role-name').value = r.name;
    document.getElementById('inp-role-access').value = r.access;
    document.getElementById('role-modal').classList.remove('hidden');
}

function closeRoleModal() {
    document.getElementById('role-modal').classList.add('hidden');
}

async function saveRole() {
    const index = parseInt(document.getElementById('role-edit-index').value);
    const id = document.getElementById('inp-role-id').value.trim();
    const name = document.getElementById('inp-role-name').value.trim();
    const access = document.getElementById('inp-role-access').value.trim();
    if (!id || !name) { showToast('ID dan Nama Role wajib diisi!', 'error'); return; }
    if (index === -1) {
        const newRole = { id: id, name: name, access: access };
        roles.push(newRole);
        await supabaseClient.from('roles').insert([newRole]);
        showToast('Role baru berhasil ditambahkan.', 'success');
    } else {
        roles[index] = { id: id, name: name, access: access };
        await supabaseClient.from('roles').update({ name: name, access: access }).eq('id', id);
        showToast('Role berhasil diperbarui.', 'success');
    }
    closeRoleModal();
    renderRoles();
}

function renderBasecamps() {
    const container = document.getElementById('basecamp-container');
    if (!container) return;
    container.innerHTML = basecamps.map(function(b, i) {
        return `
            <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2">
                <div class="flex justify-between items-start">
                    <h5 class="text-xs font-bold text-white">${b.name}</h5>
                    <button onclick="openEditBasecampModal(${i})" class="text-blue-400 hover:text-blue-300 text-xs"><i class="fa-solid fa-pen"></i></button>
                </div>
                <p class="text-[11px] text-slate-400 font-mono">Lat/Lng: ${b.lat}, ${b.lng}</p>
                <p class="text-[11px] text-gold-400">Radius GPS: ${b.radius} Meter</p>
            </div>`;
    }).join('');
    if (!bcMap) {
        bcMap = L.map('basecamp-map').setView([0.434291, 101.466385], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(bcMap);
    }
    basecamps.forEach(function(b) {
        L.marker([b.lat, b.lng]).addTo(bcMap).bindPopup(`<b>${b.name}</b><br>Radius: ${b.radius}m`);
        L.circle([b.lat, b.lng], { radius: b.radius, color: '#d4af37', fillColor: '#d4af37', fillOpacity: 0.2 }).addTo(bcMap);
    });
}

function openAddBasecampModal() {
    document.getElementById('bc-modal-title').innerText = "Tambah Basecamp";
    document.getElementById('bc-edit-index').value = "-1";
    document.getElementById('bc-inp-name').value = "";
    document.getElementById('bc-inp-lat').value = "";
    document.getElementById('bc-inp-lng').value = "";
    document.getElementById('bc-inp-radius').value = "";
    document.getElementById('basecamp-modal').classList.remove('hidden');
}

function openEditBasecampModal(index) {
    const b = basecamps[index];
    document.getElementById('bc-modal-title').innerText = "Edit Basecamp";
    document.getElementById('bc-edit-index').value = index;
    document.getElementById('bc-inp-name').value = b.name;
    document.getElementById('bc-inp-lat').value = b.lat;
    document.getElementById('bc-inp-lng').value = b.lng;
    document.getElementById('bc-inp-radius').value = b.radius;
    document.getElementById('basecamp-modal').classList.remove('hidden');
}

function closeBasecampModal() {
    document.getElementById('basecamp-modal').classList.add('hidden');
}

async function saveBasecamp() {
    const index = parseInt(document.getElementById('bc-edit-index').value);
    const name = document.getElementById('bc-inp-name').value.trim();
    const lat = parseFloat(document.getElementById('bc-inp-lat').value);
    const lng = parseFloat(document.getElementById('bc-inp-lng').value);
    const radius = parseInt(document.getElementById('bc-inp-radius').value);
    if (!name || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        showToast('Harap isi data basecamp dengan benar!', 'error');
        return;
    }
    if (index === -1) {
        const newBc = { id: Date.now(), name: name, lat: lat, lng: lng, radius: radius };
        basecamps.push(newBc);
        await supabaseClient.from('basecamps').insert([newBc]);
        showToast('Basecamp baru ditambahkan.', 'success');
    } else {
        const b = basecamps[index];
        b.name = name; b.lat = lat; b.lng = lng; b.radius = radius;
        await supabaseClient.from('basecamps').update({ name: name, lat: lat, lng: lng, radius: radius }).eq('id', b.id);
        showToast('Basecamp diperbarui.', 'success');
    }
    closeBasecampModal();
    renderBasecamps();
}