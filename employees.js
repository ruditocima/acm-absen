
# ============================================================
# FILE 7: employees.js — Render & Manage Employees
# ============================================================
employees_js = r'''// ============================================================
// EMPLOYEES: Render, Add, Edit, Approve, Reset Device
// ============================================================

function renderEmployees() {
    const tbody = document.getElementById('karyawan-tbody');
    if (!tbody) return;

    const employees = Store.get('employees');

    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-500 text-xs"><i class="fa-solid fa-circle-info text-slate-600 mb-1 block text-lg"></i>Tidak ada data karyawan yang dapat ditampilkan.<br><span class="text-[10px] text-slate-600">Pastikan Anda sudah login dan memiliki hak akses.</span></td></tr>';
        const badge = document.getElementById('karyawan-pending-badge');
        if (badge) badge.classList.add('hidden');
        const atasanSelect = document.getElementById('inp-atasan');
        if (atasanSelect) {
            atasanSelect.innerHTML = '<option value="">--- (Tidak Ada Atasan)</option><option value="Master Admin">Master Admin</option>';
        }
        return;
    }

    const pendingCount = employees.filter(e => e.status === 'Pending').length;
    const badge = document.getElementById('karyawan-pending-badge');
    if (badge) {
        if (pendingCount > 0) {
            badge.innerText = `${pendingCount} Pending`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    tbody.innerHTML = employees.map((e, index) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 font-mono text-white">${escapeHtml(e.id)}</td>
            <td class="p-3 font-semibold text-white">${escapeHtml(e.name)}</td>
            <td class="p-3 text-slate-300">${escapeHtml(e.position)}</td>
            <td class="p-3 text-slate-300">${escapeHtml(e.role)}</td>
            <td class="p-3 text-slate-300">${escapeHtml(e.atasan) || '-'}</td>
            <td class="p-3 font-mono text-slate-400 truncate max-w-[100px]">${e.auth_id ? escapeHtml(e.auth_id.substring(0, 8)) + '...' : 'Belum Aktif'}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${escapeHtml(e.status)}</span>
            </td>
            <td class="p-3">
                <div class="flex flex-wrap items-center gap-1.5">
                    ${e.status === 'Pending' ? `<button onclick="approveEmployeeAccount(${index})" class="px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-[11px] font-semibold transition">Approve</button>` : ''}
                    <button onclick="openEditEmployeeModal(${index})" class="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition flex items-center gap-1"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button onclick="resetEmployeeDevice(${index})" class="px-2 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded text-[11px] font-semibold transition" title="Reset Device UUID"><i class="fa-solid fa-mobile-screen"></i> Reset</button>
                </div>
            </td>
        </tr>
    `).join('');

    const atasanSelect = document.getElementById('inp-atasan');
    if (atasanSelect) {
        const opts = new Map();
        opts.set('', '--- (Tidak Ada Atasan)');
        opts.set('Master Admin', 'Master Admin');
        employees.forEach(emp => {
            if (emp.name && !opts.has(emp.name)) {
                opts.set(emp.name, emp.name);
            }
        });
        atasanSelect.innerHTML = Array.from(opts.entries())
            .map(([val, txt]) => `<option value="${escapeHtml(val)}">${escapeHtml(txt)}</option>`)
            .join('');
    }
}

async function approveEmployeeAccount(index) {
    const employees = Store.get('employees');
    const emp = employees[index];
    emp.status = 'Approved';
    await supabaseClient.from('employees').update({ status: 'Approved' }).eq('id', emp.id);
    Store.set('employees', [...employees]);
    renderEmployees();
    updateDashboardStats();
    populateEmailRecipients();
    showToast('Akun disetujui!', 'success');
}

function resetEmployeeDevice(index) {
    if (!Store.get('activeEmployeeSession').role === 'Master Admin') {
        return showToast('Akses Ditolak! Hanya Master Admin.', 'error');
    }
    const employees = Store.get('employees');
    showConfirm('Reset Perangkat', `Reset ikatan perangkat untuk ${escapeHtml(employees[index].name)}?`, async () => {
        employees[index].deviceId = 'Unbound';
        await supabaseClient.from('employees').update({ device_id: 'Unbound' }).eq('id', employees[index].id);
        Store.set('employees', [...employees]);
        renderEmployees();
        showToast(`Perangkat ${escapeHtml(employees[index].name)} berhasil di-reset.`, 'success');
    }, false);
}

// --------------------------------------------------------
// EMPLOYEE MODAL
// --------------------------------------------------------
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
    const employees = Store.get('employees');
    const emp = employees[index];
    document.getElementById('modal-title').innerText = "Edit Data Karyawan";
    document.getElementById('edit-index').value = index;
    document.getElementById('inp-id').value = emp.id;
    document.getElementById('inp-id').disabled = true;
    document.getElementById('inp-name').value = emp.name;
    document.getElementById('inp-position').value = emp.position;
    document.getElementById('inp-role').value = emp.role;
    document.getElementById('inp-atasan').value = emp.atasan || '';
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

    if (!id || !name) {
        showToast('ID/Email dan Nama wajib diisi!', 'error');
        return;
    }

    const employees = Store.get('employees');

    if (index === -1) {
        const newEmp = { id, name, position: position || 'Staff', role, atasan, status: 'Pending', device_id: 'Unbound' };
        employees.push({ ...newEmp, deviceId: 'Unbound' });
        await supabaseClient.from('employees').insert([newEmp]);
        showToast('Karyawan baru ditambahkan. User harus register via mobile.', 'success');
    } else {
        const emp = employees[index];
        emp.name = name;
        emp.position = position;
        emp.role = role;
        emp.atasan = atasan;
        await supabaseClient.from('employees').update({ name, position, role, atasan }).eq('id', id);
        showToast('Data karyawan diperbarui.', 'success');
    }

    Store.set('employees', [...employees]);
    closeEmployeeModal();
    renderEmployees();
    updateDashboardStats();
    populateEmailRecipients();
}
'''

with open('/mnt/agents/output/employees.js', 'w', encoding='utf-8') as f:
    f.write(employees_js)

print("✅ employees.js created")
