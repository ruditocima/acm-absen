-- ============================================================
-- SQL SETUP: REFACTOR AUTH KE SUPABASE AUTH (FIXED v4)
-- Jalankan di SQL Editor Supabase (urut dari atas ke bawah)
-- ============================================================

-- --------------------------------------------------------
-- 0. FORCE DROP SEMUA POLICY (bersihkan sisa policy lama)
-- --------------------------------------------------------

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop semua policy di tabel employees
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'employees' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON employees', pol.policyname);
    END LOOP;
    -- Drop semua policy di tabel rekap_list
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'rekap_list' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON rekap_list', pol.policyname);
    END LOOP;
    -- Drop semua policy di tabel izin_list
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'izin_list' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON izin_list', pol.policyname);
    END LOOP;
    -- Drop semua policy di tabel emails
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'emails' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON emails', pol.policyname);
    END LOOP;
    -- Drop semua policy di tabel roles
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'roles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON roles', pol.policyname);
    END LOOP;
    -- Drop semua policy di tabel basecamps
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'basecamps' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON basecamps', pol.policyname);
    END LOOP;
END $$;

-- --------------------------------------------------------
-- 1. UPDATE TABEL EMPLOYEES
-- --------------------------------------------------------

-- Hapus kolom password (tidak lagi dipakai, auth dihandle Supabase)
ALTER TABLE employees DROP COLUMN IF EXISTS password;

-- Tambah kolom auth_id untuk link ke supabase.auth.users
ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_id uuid;

-- Tambah kolom device_id jika belum ada
ALTER TABLE employees ADD COLUMN IF NOT EXISTS device_id text DEFAULT 'Unbound';

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
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      -- Jika insert gagal (misalnya constraint violation), tetap return NEW
      -- agar auth user tetap terbuat meski link ke employees gagal
      RAISE WARNING 'Auto-link employee failed: %', SQLERRM;
    END;
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
-- 4. RLS POLICIES (NON-RECURSIVE)
-- --------------------------------------------------------

-- EMPLOYEES
-- SELECT: semua user yang login bisa baca semua employees (untuk dropdown, daftar, etc.)
-- INI MENCEGAH RECURSIVE RLS dan memungkinkan admin/manajer lihat daftar karyawan
CREATE POLICY "employees_select_auth"
  ON employees FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "employees_insert_admin"
  ON employees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

CREATE POLICY "employees_update_self"
  ON employees FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "employees_update_admin"
  ON employees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

CREATE POLICY "employees_delete_admin"
  ON employees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- REKAP LIST (Absensi)
-- SELECT: user lihat data sendiri. Admin/Manajer lihat semua.
CREATE POLICY "rekap_select_self"
  ON rekap_list FOR SELECT
  USING (
    name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "rekap_select_manager"
  ON rekap_list FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND (e.role = 'Master Admin' OR e.role LIKE '%Manajer%')
    )
  );

CREATE POLICY "rekap_insert_self"
  ON rekap_list FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "rekap_delete_admin"
  ON rekap_list FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- IZIN LIST
CREATE POLICY "izin_select_self"
  ON izin_list FOR SELECT
  USING (
    name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "izin_select_atasan"
  ON izin_list FOR SELECT
  USING (
    atasan = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "izin_select_admin"
  ON izin_list FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

CREATE POLICY "izin_insert_self"
  ON izin_list FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND name = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "izin_update_atasan"
  ON izin_list FOR UPDATE
  USING (
    atasan = (SELECT e.name FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "izin_update_admin"
  ON izin_list FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- EMAILS
CREATE POLICY "emails_select_self"
  ON emails FOR SELECT
  USING (
    sender = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
    OR recipient = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
    OR recipient = 'BROADCAST'
  );

CREATE POLICY "emails_insert_self"
  ON emails FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "emails_delete_self"
  ON emails FOR DELETE
  USING (
    sender = (SELECT e.id FROM employees e WHERE e.auth_id = auth.uid())
  );

CREATE POLICY "emails_delete_admin"
  ON emails FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- ROLES: SELECT untuk semua (public read), write hanya admin
-- INI MENCEGAH ERROR 500 SAAT STARTUP KARENA TIDAK ADA SUBQUERY RECURSIVE
CREATE POLICY "roles_select_public"
  ON roles FOR SELECT
  USING (true);

CREATE POLICY "roles_write_admin"
  ON roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.auth_id = auth.uid() AND e.role = 'Master Admin'
    )
  );

-- BASECAMPS: SELECT untuk semua (public read), write hanya admin
CREATE POLICY "basecamps_select_public"
  ON basecamps FOR SELECT
  USING (true);

CREATE POLICY "basecamps_write_admin"
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
  ('ROL-03', 'Karyawan / Field', 'Dashboard, Rekap, Basecamp, Email')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 7. SEED BASECAMP DEFAULT (jika belum ada)
-- --------------------------------------------------------

INSERT INTO basecamps (id, name, lat, lng, radius)
VALUES (1, 'Basecamp Pekanbaru Pusat', 0.434291, 101.466385, 1500)
ON CONFLICT (id) DO NOTHING;
