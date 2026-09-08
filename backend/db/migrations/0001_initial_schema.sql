PRAGMA foreign_keys = ON;

CREATE TABLE company_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'سجل الإنتاج',
  operator_rate REAL NOT NULL DEFAULT 0.20 CHECK (operator_rate >= 0),
  worker_rate REAL NOT NULL DEFAULT 0.09 CHECK (worker_rate >= 0),
  cycle_start_day INTEGER NOT NULL DEFAULT 21 CHECK (cycle_start_day BETWEEN 2 AND 28),
  currency_code TEXT NOT NULL DEFAULT 'JOD',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO company_settings (id) VALUES (1);

CREATE TABLE app_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'accountant', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX operators_active_name_unique ON operators (name COLLATE NOCASE) WHERE is_active = 1;

CREATE TABLE workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX workers_active_name_unique ON workers (name COLLATE NOCASE) WHERE is_active = 1;

CREATE TABLE additions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO additions (id, code, name_ar, price) VALUES
  ('addition-sarwa', 'sarwa', 'سروة', 5.00),
  ('addition-sahra', 'sahra', 'سهرة', 5.00),
  ('addition-holiday', 'holiday', 'عطلة', 10.00),
  ('addition-dinner', 'dinner', 'العشاء', 3.00);

CREATE TABLE work_records (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  work_date TEXT NOT NULL CHECK (work_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  operator_meters REAL NOT NULL CHECK (operator_meters > 0),
  notes TEXT,
  created_by TEXT REFERENCES app_users(id),
  updated_by TEXT REFERENCES app_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX work_records_operator_date_idx ON work_records (operator_id, work_date);
CREATE INDEX work_records_date_idx ON work_records (work_date);

CREATE TABLE work_record_workers (
  work_record_id TEXT NOT NULL REFERENCES work_records(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  position INTEGER NOT NULL CHECK (position IN (1, 2)),
  PRIMARY KEY (work_record_id, worker_id),
  UNIQUE (work_record_id, position)
);
CREATE INDEX work_record_workers_worker_idx ON work_record_workers (worker_id, work_record_id);

CREATE TABLE work_record_additions (
  work_record_id TEXT NOT NULL REFERENCES work_records(id) ON DELETE CASCADE,
  addition_id TEXT NOT NULL REFERENCES additions(id),
  price_snapshot REAL NOT NULL CHECK (price_snapshot >= 0),
  PRIMARY KEY (work_record_id, addition_id)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_data TEXT,
  after_data TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
