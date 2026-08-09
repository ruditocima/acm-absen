import { roles } from './state.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm.js';

export function renderRoles() {
    const tbody = document.getElementById('role-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    roles.forEach((r, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-400">${r.id}</td>
            <td class="p-3 font-bold text-white">${r.name}</td>
            <td class="p-3 text-slate-300">${r.access}</td>
            <td class="p-3 space-x-2">
                <button class="edit-role-btn text-gold-400 hover:underline" data-index="${index}">Edit</button>
                <button class="delete-role-btn text-rose-400 hover:underline" data-index="${index}">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openEditRoleModal(parseInt(e.target.dataset.index)));
    });
    tbody.querySelectorAll('.delete-role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteRole(parseInt(e.target.dataset.index)));
    });
}

export function populateRoleDropdown(currentRole = '') {
    const select = document.getElementById('inp-role');
    if (!select) return;
    select.innerHTML = '';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = r.name;
        if(r.name === currentRole) opt.selected = true;
        select.appendChild(opt);
    });
}

export function openRoleModal() {
    document.getElementById('role-modal-title').innerText = 'Tambah Role Baru';
    document.getElementById('role-edit-index').value = '-1';
    document.getElementById('inp-role-id').value = 'ROL-0' + (roles.length + 1);
    document.getElementById('inp-role-name').value = '';
    document.getElementById('inp-role-access').value = '';
    document.getElementById('role-modal').classList.remove('hidden');
}

export function openEditRoleModal(index) {
    const r = roles[index];
    document.getElementById('role-modal-title').innerText = 'Edit Data Role';
    document.getElementById('role-edit-index').value = index;
    document.getElementById('inp-role-id').value = r.id;
    document.getElementById('inp-role-name').value = r.name;
    document.getElementById('inp-role-access').value = r.access;
    document.getElementById('role-modal').classList.remove('hidden');
}

export function closeRoleModal() {
    document.getElementById('role-modal').classList.add('hidden');
}

export function saveRole() {
    const index = parseInt(document.getElementById('role-edit-index').value);
    const id = document.getElementById('inp-role-id').value.trim();
    const name = document.getElementById('inp-role-name').value.trim();
    const access = document.getElementById('inp-role-access').value.trim();

    if (!id || !name) {
        showToast('Kode Role dan Nama Role wajib diisi!', 'error');
        return;
    }

    if (index === -1) {
        roles.push({ id, name, access });
        showToast('Role baru berhasil ditambahkan!', 'success');
    } else {
        roles[index] = { id, name, access };
        showToast('Data role berhasil diperbarui!', 'success');
    }

    closeRoleModal();
    renderRoles();
    populateRoleDropdown();
}

export function deleteRole(index) {
    showConfirm('Hapus Role', `Hapus data role ${roles[index].name}?`, () => {
        roles.splice(index, 1);
        renderRoles();
        showToast('Data role berhasil dihapus.', 'success');
    }, true);
}

export function initRoleEvents() {
    document.getElementById('btn-open-role-modal').addEventListener('click', openRoleModal);
    document.getElementById('btn-save-role').addEventListener('click', saveRole);
    document.getElementById('btn-close-role-modal').addEventListener('click', closeRoleModal);
}