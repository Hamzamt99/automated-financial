CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name text NOT NULL DEFAULT 'سجل الإنتاج',
  operator_rate numeric(10,4) NOT NULL DEFAULT 0.20 CHECK (operator_rate >= 0),
  worker_rate numeric(10,4) NOT NULL DEFAULT 0.09 CHECK (worker_rate >= 0),
  cycle_start_day smallint NOT NULL DEFAULT 21 CHECK (cycle_start_day BETWEEN 2 AND 28),
  currency_code varchar(3) NOT NULL DEFAULT 'JOD',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'accountant', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_users_email_unique ON app_users (lower(email));

CREATE TABLE operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX operators_active_name_unique ON operators (lower(name)) WHERE is_active;

CREATE TABLE workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workers_active_name_unique ON workers (lower(name)) WHERE is_active;

CREATE TABLE additions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO additions (code, name_ar, price) VALUES
  ('sarwa', 'سروة', 5.00),
  ('sahra', 'سهرة', 5.00),
  ('holiday', 'عطلة', 10.00),
  ('dinner', 'العشاء', 3.00)
ON CONFLICT (code) DO UPDATE SET name_ar = EXCLUDED.name_ar, price = EXCLUDED.price;

CREATE TABLE work_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES operators(id),
  work_date date NOT NULL,
  operator_meters numeric(12,2) NOT NULL CHECK (operator_meters > 0),
  notes text,
  created_by uuid REFERENCES app_users(id),
  updated_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_records_operator_date_idx ON work_records (operator_id, work_date);
CREATE INDEX work_records_date_idx ON work_records (work_date);

CREATE TABLE work_record_workers (
  work_record_id uuid NOT NULL REFERENCES work_records(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id),
  position smallint NOT NULL CHECK (position IN (1, 2)),
  PRIMARY KEY (work_record_id, worker_id),
  UNIQUE (work_record_id, position)
);
CREATE INDEX work_record_workers_worker_idx ON work_record_workers (worker_id, work_record_id);

CREATE TABLE work_record_additions (
  work_record_id uuid NOT NULL REFERENCES work_records(id) ON DELETE CASCADE,
  addition_id uuid NOT NULL REFERENCES additions(id),
  price_snapshot numeric(10,2) NOT NULL CHECK (price_snapshot >= 0),
  PRIMARY KEY (work_record_id, addition_id)
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER operators_updated_at BEFORE UPDATE ON operators FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workers_updated_at BEFORE UPDATE ON workers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER additions_updated_at BEFORE UPDATE ON additions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER records_updated_at BEFORE UPDATE ON work_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
