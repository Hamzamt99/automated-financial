CREATE TABLE attendance_employees (
  employee_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL REFERENCES attendance_employees(employee_code),
  attendance_date TEXT NOT NULL CHECK (attendance_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  check_in TEXT CHECK (check_in IS NULL OR (length(check_in) = 5 AND check_in GLOB '[0-2][0-9]:[0-5][0-9]' AND CAST(substr(check_in, 1, 2) AS INTEGER) <= 23)),
  check_out TEXT CHECK (check_out IS NULL OR (length(check_out) = 5 AND check_out GLOB '[0-2][0-9]:[0-5][0-9]' AND CAST(substr(check_out, 1, 2) AS INTEGER) <= 23)),
  created_by TEXT REFERENCES app_users(id),
  updated_by TEXT REFERENCES app_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_code, attendance_date)
);

CREATE INDEX attendance_records_date_idx ON attendance_records (attendance_date, employee_code);

INSERT INTO attendance_employees (employee_code, name, sort_order) VALUES
  ('7065', 'محمود زهدي كامل الزعبي', 1),
  ('7066', 'محمد مصطفى ابراهيم المناصري', 2),
  ('7067', 'محمد هلال خضر ابو نصير', 3),
  ('7070', 'عبدالله امجد يحيى محمد', 4),
  ('7088', 'خميس عوده غمار الحوامده', 5),
  ('7105', 'مفيد محمد موسى شناق', 6),
  ('7125', 'ياسين كمال سليمان ابو صبيح', 7),
  ('7130', 'عمر محمد حمدان الحوامده', 8),
  ('7137', 'ياسين سلامه عبد الخالق العدوي', 9),
  ('7142', 'معاذ سعيد محمد', 10),
  ('7157', 'ابراهيم احمد ناجي الحجاج', 11),
  ('7171', 'مروان سمير قطيش قطاشات', 12),
  ('7192', 'ايمن محمد سالم ابو قديح', 13),
  ('7195', 'احمد حسني محمد عوده', 14),
  ('7200', 'محمود محمد ابراهيم عفانه', 15),
  ('1000093', 'عيد شحاده مسعد السكاكر', 16),
  ('1000094', 'عيد نسيم فارس بدروس', 17);
