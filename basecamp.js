
# ============================================================
# FILE 11: basecamp.js — Basecamp & Map Management
# ============================================================
basecamp_js = r'''// ============================================================
// BASECAMP: Render, Map, Add, Edit, Delete
// ============================================================

function deleteBasecamp(index) {
    const session = Store.get('activeEmployeeSession');
    if (session.role === 'Karyawan / Field') return showToast('Akses Ditolak! View Only.', 'error');
    if (session.role !== 'Master Admin') return showToast('Akses Ditolak! Hanya Master Admin.', 'error');

    const basecamps = Store.get('basecamps');
    const bc = basecamps[index];
    showConfirm('Hapus Basecamp', `Hapus basecamp "${escapeHtml(bc.name)}"? Tindakan ini tidak dapat dibatalkan.`, async () => {
        await supabaseClient.from('basecamps').delete().eq('id', bc.id);
        basecamps.splice(index, 1);
        Store.set('basecamps', [...basecamps]);
        renderBasecamps();
        showToast('Basecamp berhasil dihapus.', 'success');
    }, true);
}

function renderBasecamps() {
    const container = document.getElementById('basecamp-container');
    if (!container) return;

    const basecamps = Store.get('basecamps');
    const roleName = Store.get('activeEmployeeSession').role;
    let canEdit = false;
    let canDelete = false;

    if (roleName === 'Master Admin') {
        canEdit = true;
        canDelete = true;
    } else if (roleName === 'Supervisor Field') {
        canEdit = true;
        canDelete = false;
    }

    container.innerHTML = basecamps.map((b, i) => `
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-start">
                <h5 class="text-xs font-bold text-white">${escapeHtml(b.name)}</h5>
                ${(canEdit || canDelete) ? `
                <div class="flex items-center gap-2">
                    ${canEdit ? `<button onclick="openEditBasecampModal(${i})" class="text-blue-400 hover:text-blue-300 text-xs px-1.5 py-0.5 rounded hover:bg-blue-500/10 transition"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${canDelete ? `<button onclick="deleteBasecamp(${i})" class="text-rose-400 hover:text-rose-300 text-xs px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition" title="Hapus Basecamp"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
                ` : ''}
            </div>
            <p class="text-[11px] text-slate-400 font-mono">Lat/Lng: ${b.lat}, ${b.lng}</p>
            <p class="text-[11px] text-gold-400">Radius GPS: ${b.radius} Meter</p>
        </div>
    `).join('');

    // Map handling
    let bcMap = Store.get('bcMap');
    let bcMarkers = Store.get('bcMarkers');

    if (!bcMap) {
        bcMap = L.map('basecamp-map').setView([0.434291, 101.466385], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(bcMap);
        Store.set('bcMap', bcMap);
    } else {
        bcMarkers.forEach(layer => { if (bcMap.hasLayer(layer)) bcMap.removeLayer(layer); });
        bcMarkers = [];
    }

    basecamps.forEach(b => {
        const m = L.marker([b.lat, b.lng]).addTo(bcMap).bindPopup(`<b>${escapeHtml(b.name)}</b><br>Radius: ${b.radius}m`);
        const c = L.circle([b.lat, b.lng], { radius: b.radius, color: '#d4af37', fillColor: '#d4af37', fillOpacity: 0.2 }).addTo(bcMap);
        bcMarkers.push(m, c);
    });

    Store.set('bcMarkers', bcMarkers);
}

// --------------------------------------------------------
// BASECAMP MODAL
// --------------------------------------------------------
function openAddBasecampModal() {
    const roleName = Store.get('activeEmployeeSession').role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') {
        return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    }
    document.getElementById('bc-modal-title').innerText = "Tambah Basecamp";
    document.getElementById('bc-edit-index').value = "-1";
    document.getElementById('bc-inp-name').value = "";
    document.getElementById('bc-inp-lat').value = "";
    document.getElementById('bc-inp-lng').value = "";
    document.getElementById('bc-inp-radius').value = "";
    document.getElementById('basecamp-modal').classList.remove('hidden');
}

function openEditBasecampModal(index) {
    const roleName = Store.get('activeEmployeeSession').role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') {
        return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    }
    const basecamps = Store.get('basecamps');
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
    const roleName = Store.get('activeEmployeeSession').role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') {
        return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    }

    const index = parseInt(document.getElementById('bc-edit-index').value);
    const name = document.getElementById('bc-inp-name').value.trim();
    const lat = parseFloat(document.getElementById('bc-inp-lat').value);
    const lng = parseFloat(document.getElementById('bc-inp-lng').value);
    const radius = parseInt(document.getElementById('bc-inp-radius').value);

    if (!name || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        showToast('Harap isi data basecamp dengan benar!', 'error');
        return;
    }

    const basecamps = Store.get('basecamps');

    if (index === -1) {
        const newBc = { id: Date.now(), name, lat, lng, radius };
        basecamps.push(newBc);
        await supabaseClient.from('basecamps').insert([newBc]);
        showToast('Basecamp baru ditambahkan.', 'success');
    } else {
        const b = basecamps[index];
        b.name = name;
        b.lat = lat;
        b.lng = lng;
        b.radius = radius;
        await supabaseClient.from('basecamps').update({ name, lat, lng, radius }).eq('id', b.id);
        showToast('Basecamp diperbarui.', 'success');
    }

    Store.set('basecamps', [...basecamps]);
    closeBasecampModal();
    renderBasecamps();
}
'''

with open('/mnt/agents/output/basecamp.js', 'w', encoding='utf-8') as f:
    f.write(basecamp_js)

print("✅ basecamp.js created")
