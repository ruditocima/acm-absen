import { employees } from './state.js';
import { populateRoleDropdown } from './role.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm.js';

export function populateAtasanDropdown(currentEmployeeName = '') {
    const select = document.getElementById('inp-atasan');
    if (!select) return;
    select.innerHTML = '<option value="-">-- Pilih Atasan (Opsional) --</option>';
    employees.forEach(emp => {
        if (emp.name !== currentEmployeeName) {
            const opt = document.createElement('option');
            opt.value = emp.name;
            opt.textContent = emp.name;
            select.appendChild(opt);
        }
    });
}

export function renderEmployees() {
    const tbody = document.getElementById('karyawan-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500"><div class="flex flex-col items-center justify-center space-y-2"><i class="fa-solid fa-users-slash text-2xl text-slate-600"></i><p class="text-xs font-medium text-slate-400">Belum ada data karyawan terdaftar.</p></div></td></tr>`;
        return;
    }

    employees.forEach((emp, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-400">${emp.id}</td>
            <td class="p-3 font-medium text-white">${emp.name}</td>
            <td class="p-3 text-slate-300 font-semibold">${emp.role}</td>
            <td class="p-3 text-gold-400 font-medium">${emp.atasan || '-'}</td>
            <td class="p-3 text-slate-500 font-mono">${emp.password}</td>
            <td class="p-3 font-mono text-emerald-400">${emp.deviceId}</td>
            <td class="p-3 space-x-2">
                <button class="edit-emp-btn text-gold-400 hover:underline" data-index="${index}">Edit</button>
                <button class="reset-dev-btn text-amber-400 hover:underline" data-index="${index}">Reset Device</button>
                <button class="delete-emp-btn text-rose-400 hover:underline" data-index="${index}">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-emp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openEditEmployeeModal(parseInt(e.target.dataset.index)));
    });
    tbody.querySelectorAll('.reset-dev-btn').forEach(btn => {
        btn.addEventListener('click', (e) => resetEmployeeDevice(parseInt(e.target.dataset.index)));
    });
    tbody.querySelectorAll('.delete-emp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteEmployee(parseInt(e.target.dataset.index)));
    });
}

export function openAddEmployeeModal() {
    populateRoleDropdown();
    populateAtasanDropdown('');
    document.getElementById('modal-title').innerText = 'Tambah Karyawan Baru';
    document.getElementById('edit-index').value = '-1';
    document.getElementById('inp-id').value = 'USR-00' + (employees.length + 1);
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-atasan').value = '-';
    document.getElementById('inp-password').value = '••••••••';
    document.getElementById('inp-device').value = 'DEV-' + Math.floor(1000 + Math.random() * 9000) + ' (Locked)';
    document.getElementById('employee-modal').classList.remove('hidden');
}

export function openEditEmployeeModal(index) {
    const emp = employees[index];
    populateRoleDropdown(emp.role);
    populateAtasanDropdown(emp.name);
    document.getElementById('modal-title').innerText = 'Edit Data Karyawan';
    document.getElementById('edit-index').value = index;
    document.getElementById('inp-id').value = emp.id;
    document.getElementById('inp-name').value = emp.name;
    document.getElementById('inp-atasan').value = emp.atasan || '-';
    document.getElementById('inp-password').value = emp.password;
    document.getElementById('inp-device').value = emp.deviceId;
    document.getElementById('employee-modal').classList.remove('hidden');
}

export function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
}

export function saveEmployee() {
    const index = parseInt(document.getElementById('edit-index').value);
    const id = document.getElementById('inp-id').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    const role = document.getElementById('inp-role').value.trim();
    const atasan = document.getElementById('inp-atasan').value;
    const password = document.getElementById('inp-password').value.trim();
    const deviceId = document.getElementById('inp-device').value.trim();

    if (!id || !name) {
        showToast('ID User dan Nama Karyawan wajib diisi!', 'error');
        return;
    }

    if (index === -1) {
        employees.push({ id, name, role, atasan, password, deviceId });
        showToast('Karyawan baru berhasil ditambahkan!', 'success');
    } else {
        employees[index] = { id, name, role, atasan, password, deviceId };
        showToast('Data karyawan berhasil diperbarui!', 'success');
    }

    closeEmployeeModal();
    renderEmployees();
}

export function resetEmployeeDevice(index) {
    showConfirm('Reset Device ID', `Apakah Anda yakin ingin mereset Device ID untuk ${employees[index].name}?`, () => {
        employees[index].deviceId = 'Belum Terikat (Reset)';
        renderEmployees();
        showToast('Device ID berhasil direset.', 'success');
    }, false);
}

export function deleteEmployee(index) {
    showConfirm('Hapus Karyawan', `Hapus data karyawan ${employees[index].name}?`, () => {
        employees.splice(index, 1);
        renderEmployees();
        showToast('Data karyawan berhasil dihapus.', 'success');
    }, true);
}

export function initEmployeeEvents() {
    document.getElementById('btn-open-employee-modal').addEventListener('click', openAddEmployeeModal);
    document.getElementById('btn-save-employee').addEventListener('click', saveEmployee);
    document.getElementById('btn-close-employee-modal').addEventListener('click', closeEmployeeModal);
}