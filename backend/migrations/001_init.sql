-- 001_init.sql
-- RO Service Management System — initial schema
-- Run with: psql "$DATABASE_URL" -f migrations/001_init.sql

BEGIN;

-- =========================================================
-- users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'technician', 'customer')),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- soft-disable instead of deleting accounts
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phone_or_email CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- =========================================================
-- customers
-- =========================================================
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT,
  city TEXT,
  pincode TEXT,
  ro_model TEXT,
  installation_date DATE
);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- =========================================================
-- technicians
-- =========================================================
CREATE TABLE IF NOT EXISTS technicians (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  area TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_technicians_user_id ON technicians(user_id);

-- =========================================================
-- jobs
-- =========================================================
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  technician_id INTEGER NOT NULL REFERENCES technicians(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id), -- admin who created the job
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_technician_id ON jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- =========================================================
-- reports
-- =========================================================
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  text_report TEXT,
  audio_url TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT report_has_content CHECK (
    (text_report IS NOT NULL AND length(trim(text_report)) > 0) OR audio_url IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_reports_job_id ON reports(job_id);

-- =========================================================
-- report_images
-- =========================================================
CREATE TABLE IF NOT EXISTS report_images (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_images_report_id ON report_images(report_id);

-- =========================================================
-- complaints
-- =========================================================
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_message TEXT,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_has_content CHECK (
    (customer_message IS NOT NULL AND length(trim(customer_message)) > 0) OR audio_url IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_complaints_job_id ON complaints(job_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

-- =========================================================
-- report_access_tokens
-- One active link per job (regenerating replaces/revokes the old one).
-- The UNIQUE(job_id) constraint is required for the admin route's
-- INSERT ... ON CONFLICT (job_id) DO UPDATE to work at all.
-- =========================================================
CREATE TABLE IF NOT EXISTS report_access_tokens (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_access_tokens_token ON report_access_tokens(token);

-- =========================================================
-- refresh_tokens
-- Stored (hashed) so refresh tokens can be revoked on logout / compromise —
-- the original design trusted any JWT-refresh-secret-signed token forever.
-- =========================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, -- sha256 of the raw refresh token, never store raw
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- =========================================================
-- audit_log
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

COMMIT;
