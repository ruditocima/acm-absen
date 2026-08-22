// ============================================================
// KaryaOne ACM - Service Layer
// Pemisahan business logic dari UI layer
// ============================================================

const DB = {
  // ─── Employees ───
  employees: {
    async getAll() {
      const { data, error } = await supabaseClient.from('employees').select('*').order('name');
      if (error) throw error;
      return data.map(e => ({
        id: e.id, name: e.name, position: e.position || '-',
        role: e.role, atasan: e.atasan, password: e.password,
        status: e.status, deviceId: e.device_id || 'Unbound'
      }));
    },
    async getById(id) {
      const { data, error } = await supabaseClient.from('employees').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async create(emp) {
      const { data, error } = await supabaseClient.from('employees').insert([emp]).select();
      if (error) throw error;
      return data[0];
    },
    async update(id, payload) {
      const { error } = await supabaseClient.from('employees').update(payload).eq('id', id);
      if (error) throw error;
      return true;
    },
    async updateDevice(id, deviceId) {
      return this.update(id, { device_id: deviceId });
    },
    async approve(id) {
      return this.update(id, { status: 'Approved' });
    },
    async resetDevice(id) {
      return this.update(id, { device_id: 'Unbound' });
    }
  },

  // ─── Roles ───
  roles: {
    async getAll() {
      const { data, error } = await supabaseClient.from('roles').select('*');
      if (error) throw error;
      return data || [];
    },
    async create(role) {
      const { data, error } = await supabaseClient.from('roles').insert([role]).select();
      if (error) throw error;
      return data[0];
    },
    async update(id, payload) {
      const { error } = await supabaseClient.from('roles').update(payload).eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  // ─── Basecamps ───
  basecamps: {
    async getAll() {
      const { data, error } = await supabaseClient.from('basecamps').select('*');
      if (error) throw error;
      return data || [];
    },
    async create(bc) {
      const { data, error } = await supabaseClient.from('basecamps').insert([bc]).select();
      if (error) throw error;
      return data[0];
    },
    async update(id, payload) {
      const { error } = await supabaseClient.from('basecamps').update(payload).eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  // ─── Attendance (Rekap) ───
  attendance: {
    async getAll() {
      const { data, error } = await supabaseClient.from('rekap_list').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async getTodayByName(name) {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabaseClient
        .from('rekap_list')
        .select('*')
        .eq('date', today)
        .eq('name', name)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    async getByDateRange(start, end, page = 1, pageSize = 50) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await supabaseClient
        .from('rekap_list')
        .select('*', { count: 'exact' })
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    async checkIn(record) {
      const { data, error } = await supabaseClient.from('rekap_list').insert([record]).select();
      if (error) throw error;
      return data[0];
    },
    async checkOut(recordId, payload) {
      const { data, error } = await supabaseClient
        .from('rekap_list')
        .update(payload)
        .eq('id', recordId)
        .select();
      if (error) throw error;
      return data[0];
    },
    async deleteAll() {
      const { error } = await supabaseClient.from('rekap_list').delete().neq('id', 0);
      if (error) throw error;
      return true;
    }
  },

  // ─── Leaves (Izin) ───
  leaves: {
    async getAll() {
      const { data, error } = await supabaseClient.from('izin_list').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async create(izin) {
      const { data, error } = await supabaseClient.from('izin_list').insert([izin]).select();
      if (error) throw error;
      return data[0];
    },
    async updateStatus(id, status) {
      const { error } = await supabaseClient.from('izin_list').update({ status }).eq('id', id);
      if (error) throw error;
      return true;
    },
    async getPendingForApprover(approverName, isMasterAdmin = false) {
      let query = supabaseClient.from('izin_list').select('*').eq('status', 'Pending');
      if (!isMasterAdmin) query = query.eq('atasan', approverName);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  },

  // ─── Emails ───
  emails: {
    async getAll() {
      const { data, error } = await supabaseClient.from('emails').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(e => ({
        id: e.id, sender: e.sender, sender_name: e.sender_name,
        receiver: e.recipient, subject: e.subject, message: e.message,
        created_at: e.created_at, read: false
      }));
    },
    async send(email) {
      const { data, error } = await supabaseClient.from('emails').insert([email]).select();
      if (error) throw error;
      return data[0];
    },
    async delete(id) {
      const { error } = await supabaseClient.from('emails').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  // ─── Settings ───
  settings: {
    async getAll() {
      const { data, error } = await supabaseClient.from('app_settings').select('*');
      if (error) throw error;
      const map = {};
      (data || []).forEach(s => map[s.key] = s.value);
      return map;
    },
    async get(key) {
      const { data, error } = await supabaseClient.from('app_settings').select('value').eq('key', key).single();
      if (error) return null;
      return data?.value;
    }
  },

  // ─── Storage ───
  storage: {
    async uploadSelfie(blob, fileName) {
      const { data, error } = await supabaseClient
        .storage
        .from('absensi-bucket')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return data;
    },
    async getPublicUrl(fileName) {
      const { data } = supabaseClient.storage.from('absensi-bucket').getPublicUrl(fileName);
      return data.publicUrl;
    }
  }
};

// ============================================================
// Utility Helpers
// ============================================================

const AppUtils = {
  // Debounce untuk search input
  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  },

  // Format waktu Indonesia
  formatTime(date) {
    return date.toLocaleTimeString('id-ID', { hour12: false });
  },

  // Format tanggal ISO ke local
  formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  // Hitung durasi kerja
  calcWorkDuration(checkIn, checkOut) {
    const start = new Date(`2000-01-01T${checkIn}`);
    const end = new Date(`2000-01-01T${checkOut}`);
    let diffMs = end - start;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // shift malam
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}j ${mins}m`;
  },

  // Hitung keterlambatan
  calcLateStatus(checkInTime, limitTimeStr) {
    const [limitH, limitM, limitS] = limitTimeStr.split(':').map(Number);
    const limitSeconds = limitH * 3600 + limitM * 60 + limitS;
    const [h, m, s] = checkInTime.split(':').map(Number);
    const currentSeconds = h * 3600 + m * 60 + s;

    if (currentSeconds <= limitSeconds) {
      return { status: 'Tepat Waktu', late: '-' };
    }
    const diff = currentSeconds - limitSeconds;
    const dh = Math.floor(diff / 3600);
    const dm = Math.floor((diff % 3600) / 60);
    const ds = diff % 60;
    return {
      status: 'Terlambat',
      late: `${dh}:${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')}`
    };
  },

  // Generate nama file selfie unik
  generateSelfieFileName(date, userId) {
    const ts = Date.now();
    const safeId = userId.replace(/[^a-zA-Z0-9]/g, '_');
    return `selfies/${date}_${safeId}_${ts}.jpg`;
  },

  // Set button loading state
  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || btn.innerText;
    }
  }
};

// Export untuk module (jika pakai type="module")
// window.DB = DB; window.AppUtils = AppUtils;
