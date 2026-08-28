// ============================================================
// ROLES: Render, Add, Edit
// ============================================================

function renderRoles() {
    const tbody = document.getElementById('role-tbody');
    if (!tbody) return;

    const roles = Store.get('roles');
    tbody.innerHTML = roles.map((r, i) => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3 font-mono text-gold-400">${escapeHtml(r.id)}</td>
            <td class="p-3 font-semibold text-white">${escapeHtml(r.name)}</td>
            <td class="p-3 text-slate-300">${escapeHtml(r.access)}</td>
            <td class="p-3">
                <button onclick="openEditRoleModal(${i})" class="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[11px] font-semibold transition">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
            </td>
        </tr>
    `).join('');

    const roleSelect = document.getElementById('inp-role');
    if (roleSelect) {
        roleSelect.innerHTML = roles.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
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
    const roles = Store.get('roles');
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

    if (!id || !name) {
        showToast('ID dan Nama Role wajib diisi!', 'error');
        return;
    }

    const roles = Store.get('roles');

    if (index === -1) {
        const newRole = { id, name, access };
        roles.push(newRole);
        await supabaseClient.from('roles').insert([newRole]);
        showToast('Role baru ditambahkan.', 'success');
    } else {
        roles[index] = { id, name, access };
        await supabaseClient.from('roles').update({ name, access }).eq('id', id);
        showToast('Role diperbarui.', 'success');
    }

    Store.set('roles', [...roles]);
    closeRoleModal();
    renderRoles();
}