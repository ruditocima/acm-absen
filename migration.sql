-- ============================================================
-- KaryaOne ACM - Database Migration
-- RLS Policies + Audit Log + App Settings
-- Jalankan di SQL Editor Supabase (New Query)
-- ============================================================

-- 1. Tabel App Settings (konfigurasi runtime)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description) VALUES
    ('absen_open', '07:45:00', 'Jam mulai dibukanya absen masuk'),
    ('absen_max', '09:40:00', 'Jam batas maksimal absen masuk (terlambat)'),
    ('absen_min_out', '16:00:00', 'Jam minimal absen pulang'),
    ('company_name', 'PT Acero Cetha Metalindo', 'Nama perusahaan'),
    ('timezone', 'Asia/Jakarta', 'Zona waktu aplikasi')
ON CONFLICT (key) DO NOTHING;

-- 2. Tambah kolom check_out ke rekap_list
ALTER TABLE rekap_list 
    ADD COLUMN IF NOT EXISTS check_out_time TEXT,
    ADD COLUMN IF NOT EXISTS work_duration TEXT,
    ADD COLUMN IF NOT EXISTS check_out_selfie_url TEXT;

-- 3. Tambah kolom kuota cuti ke employees
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS leave_quota INTEGER DEFAULT 12,
    ADD COLUMN IF NOT EXISTS leave_used INTEGER DEFAULT 0;

-- 4. Tabel Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,           -- INSERT / UPDATE / DELETE
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 5. Function & Trigger Audit Log
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (user_id, user_name, action, table_name, record_id, old_data)
        VALUES (
            current_setting('app.current_user_id', true),
            current_setting('app.current_user_name', true),
            TG_OP,
            TG_TABLE_NAME,
            OLD.id::text,
            to_jsonb(OLD)
        );
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (user_id, user_name, action, table_name, record_id, old_data, new_data)
        VALUES (
            current_setting('app.current_user_id', true),
            current_setting('app.current_user_name', true),
            TG_OP,
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (user_id, user_name, action, table_name, record_id, new_data)
        VALUES (
            current_setting('app.current_user_id', true),
            current_setting('app.current_user_name', true),
            TG_OP,
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger ke tabel penting
DROP TRIGGER IF EXISTS trg_audit_employees ON employees;
CREATE TRIGGER trg_audit_employees
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_rekap ON rekap_list;
CREATE TRIGGER trg_audit_rekap
    AFTER INSERT OR UPDATE OR DELETE ON rekap_list
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_izin ON izin_list;
CREATE TRIGGER trg_audit_izin
    AFTER INSERT OR UPDATE OR DELETE ON izin_list
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_emails ON emails;
CREATE TRIGGER trg_audit_emails
    AFTER INSERT OR UPDATE OR DELETE ON emails
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- 6. Storage Bucket untuk Selfie
INSERT INTO storage.buckets (id, name, public)
VALUES ('absensi-bucket', 'absensi-bucket', true)
ON CONFLICT (id) DO NOTHING;

-- 7. RLS Policies

-- Employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select_all" ON employees;
CREATE POLICY "employees_select_all" ON employees
    FOR SELECT USING (true);  -- Semua user approved perlu lihat daftar karyawan

DROP POLICY IF EXISTS "employees_insert_admin" ON employees;
CREATE POLICY "employees_insert_admin" ON employees
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

DROP POLICY IF EXISTS "employees_update_admin" ON employees;
CREATE POLICY "employees_update_admin" ON employees
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

DROP POLICY IF EXISTS "employees_delete_admin" ON employees;
CREATE POLICY "employees_delete_admin" ON employees
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- Rekap List (Attendance)
ALTER TABLE rekap_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rekap_select_own" ON rekap_list;
CREATE POLICY "rekap_select_own" ON rekap_list
    FOR SELECT USING (
        name = current_setting('app.current_user_name', true)
        OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
        OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND name = rekap_list.atasan)
    );

DROP POLICY IF EXISTS "rekap_insert_own" ON rekap_list;
CREATE POLICY "rekap_insert_own" ON rekap_list
    FOR INSERT WITH CHECK (
        name = current_setting('app.current_user_name', true)
    );

DROP POLICY IF EXISTS "rekap_update_own" ON rekap_list;
CREATE POLICY "rekap_update_own" ON rekap_list
    FOR UPDATE USING (
        name = current_setting('app.current_user_name', true)
        OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- Izin List
ALTER TABLE izin_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "izin_select_all" ON izin_list;
CREATE POLICY "izin_select_all" ON izin_list
    FOR SELECT USING (
        name = current_setting('app.current_user_name', true)
        OR atasan = current_setting('app.current_user_name', true)
        OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

DROP POLICY IF EXISTS "izin_insert_own" ON izin_list;
CREATE POLICY "izin_insert_own" ON izin_list
    FOR INSERT WITH CHECK (
        name = current_setting('app.current_user_name', true)
    );

DROP POLICY IF EXISTS "izin_update_approver" ON izin_list;
CREATE POLICY "izin_update_approver" ON izin_list
    FOR UPDATE USING (
        atasan = current_setting('app.current_user_name', true)
        OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- Emails
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emails_select_all" ON emails;
CREATE POLICY "emails_select_all" ON emails
    FOR SELECT USING (
        sender = auth.uid()::text
        OR recipient = auth.uid()::text
        OR recipient = 'BROADCAST'
        OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

DROP POLICY IF EXISTS "emails_insert_all" ON emails;
CREATE POLICY "emails_insert_all" ON emails
    FOR INSERT WITH CHECK (sender = auth.uid()::text);

DROP POLICY IF EXISTS "emails_delete_own" ON emails;
CREATE POLICY "emails_delete_own" ON emails
    FOR DELETE USING (sender = auth.uid()::text);

-- Basecamps
ALTER TABLE basecamps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "basecamps_select_all" ON basecamps;
CREATE POLICY "basecamps_select_all" ON basecamps
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "basecamps_modify_admin" ON basecamps;
CREATE POLICY "basecamps_modify_admin" ON basecamps
    FOR ALL USING (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- Roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_all" ON roles;
CREATE POLICY "roles_select_all" ON roles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "roles_modify_admin" ON roles;
CREATE POLICY "roles_modify_admin" ON roles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON app_settings;
CREATE POLICY "settings_select_all" ON app_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_modify_admin" ON app_settings;
CREATE POLICY "settings_modify_admin" ON app_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- Audit Logs (hanya admin)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON audit_logs;
CREATE POLICY "audit_select_admin" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role = 'Master Admin')
    );

-- 8. Storage RLS (Selfie bucket)
CREATE POLICY "storage_selfie_select_all"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'absensi-bucket');

CREATE POLICY "storage_selfie_insert_auth"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'absensi-bucket');

-- 9. Function helper untuk set context user
CREATE OR REPLACE FUNCTION set_app_user(user_id TEXT, user_name TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, false);
    PERFORM set_config('app.current_user_name', user_name, false);
END;
$$ LANGUAGE plpgsql;
