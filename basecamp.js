# ============================================================
# FILE 11: basecamp.js
# ============================================================
basecamp_js = '''// ============================================================
// BASECAMP: Render, Map, Add, Edit, Delete
// ============================================================

function deleteBasecamp(index) {
    var session = Store.get('activeEmployeeSession');
    if (session.role === 'Karyawan / Field') return showToast('Akses Ditolak! View Only.', 'error');
    if (session.role !== 'Master Admin') return showToast('Akses Ditolak! Hanya Master Admin.', 'error');

    var basecamps = Store.get('basecamps');
    var bc = basecamps[index];
    showConfirm('Hapus Basecamp', 'Hapus basecamp "' + escapeHtml(bc.name) + '"? Tindakan ini tidak dapat dibatalkan.', async function() {
        await supabaseClient.from('basecamps').delete().eq('id', bc.id);
        basecamps.splice(index, 1);
        Store.set('basecamps', basecamps.slice());
        renderBasecamps();
        showToast('Basecamp berhasil dihapus.', 'success');
    }, true);
}

function renderBasecamps() {
    var container = document.getElementById('basecamp-container');
    if (!container) return;

    var basecamps = Store.get('basecamps');
    var roleName = Store.get('activeEmployeeSession').role;
    var canEdit = false;
    var canDelete = false;

    if (roleName === 'Master Admin') {
        canEdit = true;
        canDelete = true;
    } else if (roleName === 'Supervisor Field') {
        canEdit = true;
        canDelete = false;
    }

    container.innerHTML = basecamps.map(function(b, i) {
        return '<div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2">' +
            '<div class="flex justify-between items-start">' +
            '<h5 class="text-xs font-bold text-white">' + escapeHtml(b.name) + '</h5>' +
            ((canEdit || canDelete) ? '<div class="flex items-center gap-2">' +
            (canEdit ? '<button onclick="openEditBasecampModal(' + i + ')" class="text-blue-400 hover:text-blue-300 text-xs px-1.5 py-0.5 rounded hover:bg-blue-500/10 transition"><i class="fa-solid fa-pen"></i></button>' : '') +
            (canDelete ? '<button onclick="deleteBasecamp(' + i + ')" class="text-rose-400 hover:text-rose-300 text-xs px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition" title="Hapus Basecamp"><i class="fa-solid fa-trash"></i></button>' : '') +
            '</div>' : '') +
            '</div>' +
            '<p class="text-[11px] text-slate-400 font-mono">Lat/Lng: ' + b.lat + ', ' + b.lng + '</p>' +
            '<p class="text-[11px] text-gold-400">Radius GPS: ' + b.radius + ' Meter</p></div>';
    }).join('');

    var bcMap = Store.get('bcMap');
    var bcMarkers = Store.get('bcMarkers');

    if (!bcMap) {
        bcMap = L.map('basecamp-map').setView([0.434291, 101.466385], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(bcMap);
        Store.set('bcMap', bcMap);
    } else {
        bcMarkers.forEach(function(layer) { if (bcMap.hasLayer(layer)) bcMap.removeLayer(layer); });
        bcMarkers = [];
    }

    basecamps.forEach(function(b) {
        var m = L.marker([b.lat, b.lng]).addTo(bcMap).bindPopup('<b>' + escapeHtml(b.name) + '</b><br>Radius: ' + b.radius + 'm');
        var c = L.circle([b.lat, b.lng], { radius: b.radius, color: '#d4af37', fillColor: '#d4af37', fillOpacity: 0.2 }).addTo(bcMap);
        bcMarkers.push(m, c);
    });

    Store.set('bcMarkers', bcMarkers);
}

function openAddBasecampModal() {
    var roleName = Store.get('activeEmployeeSession').role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') {
        return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    }
    document.getElementById('bc-modal-title').innerText = 'Tambah Basecamp';
    document.getElementById('bc-edit-index').value = '-1';
    document.getElementById('bc-inp-name').value = '';
    document.getElementById('bc-inp-lat').value = '';
    document.getElementById('bc-inp-lng').value = '';
    document.getElementById('bc-inp-radius').value = '';
    document.getElementById('basecamp-modal').classList.remove('hidden');
}

function openEditBasecampModal(index) {
    var roleName = Store.get('activeEmployeeSession').role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') {
        return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    }
    var basecamps = Store.get('basecamps');
    var b = basecamps[index];
    document.getElementById('bc-modal-title').innerText = 'Edit Basecamp';
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
    var roleName = Store.get('activeEmployeeSession').role;
    if (roleName !== 'Master Admin' && roleName !== 'Supervisor Field') {
        return showToast('Akses Ditolak! Anda tidak memiliki izin.', 'error');
    }

    var index = parseInt(document.getElementById('bc-edit-index').value);
    var name = document.getElementById('bc-inp-name').value.trim();
    var lat = parseFloat(document.getElementById('bc-inp-lat').value);
    var lng = parseFloat(document.getElementById('bc-inp-lng').value);
    var radius = parseInt(document.getElementById('bc-inp-radius').value);

    if (!name || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        showToast('Harap isi data basecamp dengan benar!', 'error');
        return;
    }

    var basecamps = Store.get('basecamps');

    if (index === -1) {
        var newBc = { id: Date.now(), name: name, lat: lat, lng: lng, radius: radius };
        basecamps.push(newBc);
        await supabaseClient.from('basecamps').insert([newBc]);
        showToast('Basecamp baru ditambahkan.', 'success');
    } else {
        var b = basecamps[index];
        b.name = name;
        b.lat = lat;
        b.lng = lng;
        b.radius = radius;
        await supabaseClient.from('basecamps').update({ name: name, lat: lat, lng: lng, radius: radius }).eq('id', b.id);
        showToast('Basecamp diperbarui.', 'success');
    }

    Store.set('basecamps', basecamps.slice());
    closeBasecampModal();
    renderBasecamps();
}
'''

with open('/mnt/agents/output/basecamp.js', 'w', encoding='utf-8') as f:
    f.write(basecamp_js)