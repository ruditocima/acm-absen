import { rekapList, setRekapList } from './state.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm.js';

export function exportToExcel() {
    if (!rekapList || rekapList.length === 0) {
        showToast('Tidak ada data rekap untuk diexport!', 'warning');
        return;
    }

    const excelData = rekapList.map((item, index) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = item.status;
        const statusText = tempDiv.textContent || tempDiv.innerText || 'N/A';

        return {
            "No": index + 1,
            "Tanggal": item.date,
            "Nama Karyawan": item.name,
            "Basecamp": item.basecamp,
            "Jam Masuk": item.time,
            "Status": statusText,
            "Jumlah Keterlambatan": item.late
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    XLSX.writeFile(workbook, "Rekap_Absensi_Enterprise.xlsx");
    showToast('Data rekap berhasil di-export ke Excel (.xlsx)!', 'success');
}

export function renderRekap(dataToRender = null) {
    const tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const list = dataToRender || rekapList;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500"><div class="flex flex-col items-center justify-center space-y-2"><i class="fa-solid fa-folder-open text-2xl text-slate-600"></i><p class="text-xs font-medium text-slate-400">Belum ada rekapitulasi absensi.</p></div></td></tr>`;
        return;
    }

    list.forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-300">${item.date}</td>
            <td class="p-3 font-medium text-white">${item.name}</td>
            <td class="p-3 text-slate-400">${item.basecamp}</td>
            <td class="p-3 font-mono">${item.time}</td>
            <td class="p-3">${item.status}</td>
            <td class="p-3 ${item.late !== '-' ? 'text-amber-400 font-bold' : 'text-slate-500'}">${item.late}</td>
        `;
        tbody.appendChild(tr);
    });
}

export function filterRekap() {
    const startDate = document.getElementById('rekap-start-date').value;
    const endDate = document.getElementById('rekap-end-date').value;
    if (!startDate || !endDate) {
        showToast('Pilih tanggal awal dan akhir filter terlebih dahulu!', 'warning');
        return;
    }
    const filtered = rekapList.filter(item => item.date >= startDate && item.date <= endDate);
    renderRekap(filtered);
    showToast(`Filter berhasil diterapkan (${filtered.length} data ditemukan).`, 'success');
}

export function resetRekapData() {
    showConfirm('Reset Rekap Absensi', 'Hapus seluruh data rekapitulasi absensi yang ditampilkan?', () => {
        setRekapList([]);
        renderRekap();
        showToast('Data rekap berhasil direset.', 'success');
    }, true);
}

export function initRekapEvents() {
    document.getElementById('btn-filter-rekap').addEventListener('click', filterRekap);
    document.getElementById('btn-reset-rekap').addEventListener('click', resetRekapData);
    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
}