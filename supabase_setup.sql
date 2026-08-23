-- ============================================================
-- SQL SETUP: REFACTOR AUTH KE SUPABASE AUTH
-- Jalankan di SQL Editor Supabase (urut dari atas ke bawah)
-- ============================================================

-- --------------------------------------------------------
-- 1. UPDATE TABEL EMPLOYEES
-- --------------------------------------------------------

-- Hapus kolom password (tidak lagi dipakai, auth dihandle Supabase)
ALTER TABLE employees DROP COLUMN IF EXISTS password;

-- Tambah kolom auth_id untuk link ke supabase.auth.users
ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_id uuid;

-- Tambah index untuk performa
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON employees(auth_id);

-- --------------------------------------------------------
-- 2. TRIGGER: AUTO-LINK AUTH USER KE EMPLOYEES SAAT SIGNUP
-- --------------------------------------------------------

-- Fungsi: saat user baru confirm email, link ke employees jika email cocok
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Cek apakah sudah ada di employees (dari admin insert atau register manual)
  UPDATE public.employees
  SET auth_id = NEW.id,
      status = COALESCE(status, 'Pending')
  WHERE id = NEW.email;

  -- Jika belum ada di employees, insert baru (register dari mobile)
  IF NOT FOUND THEN
    INSERT INTO public.employees (id, auth_id, name, position, role, atasan, status, device_id)
    VALUES (
      NEW.email,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'User Baru'),
      'Staff',
      'Karyawan / Field',
      'Master Admin',
      'Pending',
      'Unbound'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger setelah user confirm email
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- 3. ENABLE RLS DI SEMUA TABEL
-- --------------------------------------------------------

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE rekap_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE izin_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE basecamps ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 4. RLS POLICIES
-- --------------------------------------------------------

-- EMPLOYEES
-- Admin bisa lihat semua, user biasa hanya lihat diri sendiri
DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select"
  ON employees FOR SELECT
  USING (
    auth.uid() = auth_id 
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert"
  ON employees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update"
  ON employees FOR UPDATE
  USING (
    auth.uid() = auth_id 
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete"
  ON employees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- REKAP LIST (Absensi)
-- Semua user bisa insert (absen), tapi hanya bisa insert data sendiri
-- Admin bisa lihat semua, user hanya lihat data sendiri
DROP POLICY IF EXISTS "rekap_select" ON rekap_list;
CREATE POLICY "rekap_select"
  ON rekap_list FOR SELECT
  USING (
    name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND (e.role = 'Master Admin' OR e.role LIKE '%Manajer%')
    )
  );

DROP POLICY IF EXISTS "rekap_insert" ON rekap_list;
CREATE POLICY "rekap_insert"
  ON rekap_list FOR INSERT
  WITH CHECK (
    name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "rekap_delete" ON rekap_list;
CREATE POLICY "rekap_delete"
  ON rekap_list FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- IZIN LIST
DROP POLICY IF EXISTS "izin_select" ON izin_list;
CREATE POLICY "izin_select"
  ON izin_list FOR SELECT
  USING (
    name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
    OR atasan = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

DROP POLICY IF EXISTS "izin_insert" ON izin_list;
CREATE POLICY "izin_insert"
  ON izin_list FOR INSERT
  WITH CHECK (
    name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "izin_update" ON izin_list;
CREATE POLICY "izin_update"
  ON izin_list FOR UPDATE
  USING (
    atasan = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- EMAILS
DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select"
  ON emails FOR SELECT
  USING (
    sender = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
    OR recipient = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
    OR recipient = 'BROADCAST'
  );

DROP POLICY IF EXISTS "emails_insert" ON emails;
CREATE POLICY "emails_insert"
  ON emails FOR INSERT
  WITH CHECK (
    sender = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "emails_delete" ON emails;
CREATE POLICY "emails_delete"
  ON emails FOR DELETE
  USING (
    sender = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- ROLES (Hanya Admin)
DROP POLICY IF EXISTS "roles_all" ON roles;
CREATE POLICY "roles_all"
  ON roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- BASECAMPS (Hanya Admin)
DROP POLICY IF EXISTS "basecamps_all" ON basecamps;
CREATE POLICY "basecamps_all"
  ON basecamps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- --------------------------------------------------------
-- 5. REALTIME ENABLE (untuk subscriptions)
-- --------------------------------------------------------

ALTER TABLE izin_list REPLICA IDENTITY FULL;
ALTER TABLE emails REPLICA IDENTITY FULL;
ALTER TABLE employees REPLICA IDENTITY FULL;

-- --------------------------------------------------------
-- 6. SEED DATA ROLE (jika belum ada)
-- --------------------------------------------------------

INSERT INTO roles (id, name, access)
VALUES 
  ('ROL-01', 'Master Admin', 'Dashboard, Rekap, Role, Karyawan, Basecamp, Izin, Email'),
  ('ROL-02', 'Manajer Lapangan', 'Dashboard, Rekap, Karyawan, Basecamp, Izin, Email'),
  ('ROL-03', 'Karyawan / Field', 'Dashboard, Izin, Email')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 7. SEED BASECAMP DEFAULT (jika belum ada)
-- --------------------------------------------------------

INSERT INTO basecamps (id, name, lat, lng, radius)
VALUES (1, 'Basecamp Pekanbaru Pusat', 0.434291, 101.466385, 1500)
ON CONFLICT (id) DO NOTHING;
