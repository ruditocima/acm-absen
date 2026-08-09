import { basecamps } from './state.js';
import { showToast } from './toast.js';

let bcMap = null;
let bcLayerGroup = null;

export function initMap() {
    if (bcMap) return;
    const mapContainer = document.getElementById('basecamp-map');
    if (!mapContainer) return;
    bcMap = L.map('basecamp-map').setView([0.434291, 101.466385], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(bcMap);
    bcLayerGroup = L.layerGroup().addTo(bcMap);
}

export function updateMapData() {
    if (!bcMap || !bcLayerGroup) return;
    bcLayerGroup.clearLayers();
    const bounds = [];

    basecamps.forEach(bc => {
        const marker = L.marker([bc.lat, bc.lng]).bindPopup(`<b>${bc.name}</b><br>Radius: ${bc.radius}m`);
        bcLayerGroup.addLayer(marker);
        
        const circle = L.circle([bc.lat, bc.lng], {
            color: '#d4af37',
            fillColor: '#d4af37',
            fillOpacity: 0.15,
            radius: bc.radius
        });
        bcLayerGroup.addLayer(circle);
        bounds.push([bc.lat, bc.lng]);
    });

    if (bounds.length > 0) {
        bcMap.fitBounds(bounds, { padding: [30, 30] });
    }
}

export function renderBasecamps() {
    const container = document.getElementById('basecamp-container');
    if (!container) return;
    container.innerHTML = '';

    if (basecamps.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center text-slate-500 py-8">Belum ada basecamp terdaftar.</div>`;
    } else {
        basecamps.forEach((bc, index) => {
            const card = document.createElement('div');
            card.className = "glass-card p-4 rounded-2xl space-y-2 border border-slate-800 flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start">
                        <h5 class="font-bold text-white">${bc.name}</h5>
                        <button class="edit-bc-btn text-gold-400 hover:text-gold-300 text-xs font-semibold" data-index="${index}">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                    </div>
                    <p class="text-xs text-slate-400 mt-1">Koordinat: ${bc.lat}, ${bc.lng}</p>
                    <span class="inline-block mt-2 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Radius: ${Number(bc.radius).toLocaleString('id-ID')} Meter</span>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll('.edit-bc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                openEditBasecampModal(idx);
            });
        });
    }
    updateMapData();
}

export function openAddBasecampModal() {
    document.getElementById('bc-modal-title').innerText = 'Tambah Basecamp Baru';
    document.getElementById('bc-edit-index').value = '-1';
    document.getElementById('bc-inp-name').value = '';
    document.getElementById('bc-inp-lat').value = '';
    document.getElementById('bc-inp-lng').value = '';
    document.getElementById('bc-inp-radius').value = '15000';
    document.getElementById('basecamp-modal').classList.remove('hidden');
}

export function openEditBasecampModal(index) {
    const bc = basecamps[index];
    document.getElementById('bc-modal-title').innerText = 'Edit Data Basecamp';
    document.getElementById('bc-edit-index').value = index;
    document.getElementById('bc-inp-name').value = bc.name;
    document.getElementById('bc-inp-lat').value = bc.lat;
    document.getElementById('bc-inp-lng').value = bc.lng;
    document.getElementById('bc-inp-radius').value = bc.radius;
    document.getElementById('basecamp-modal').classList.remove('hidden');
}

export function closeBasecampModal() {
    document.getElementById('basecamp-modal').classList.add('hidden');
}

export function saveBasecamp() {
    const index = parseInt(document.getElementById('bc-edit-index').value);
    const name = document.getElementById('bc-inp-name').value.trim();
    const lat = parseFloat(document.getElementById('bc-inp-lat').value);
    const lng = parseFloat(document.getElementById('bc-inp-lng').value);
    const radius = parseInt(document.getElementById('bc-inp-radius').value);

    if (!name || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        showToast('Harap isi semua data basecamp dengan benar!', 'error');
        return;
    }

    if (index === -1) {
        basecamps.push({ id: Date.now(), name, lat, lng, radius });
        showToast('Basecamp baru berhasil ditambahkan!', 'success');
    } else {
        basecamps[index] = { ...basecamps[index], name, lat, lng, radius };
        showToast('Data basecamp berhasil diperbarui!', 'success');
    }

    closeBasecampModal();
    renderBasecamps();
}

export function getMapInstance() {
    return bcMap;
}

export function initBasecampEvents() {
    document.getElementById('btn-open-basecamp-modal').addEventListener('click', openAddBasecampModal);
    document.getElementById('btn-save-basecamp').addEventListener('click', saveBasecamp);
    document.getElementById('btn-close-basecamp-modal').addEventListener('click', closeBasecampModal);
}