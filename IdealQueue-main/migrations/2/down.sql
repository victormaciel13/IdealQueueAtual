DROP INDEX IF EXISTS idx_queue_persons_check_in;
DROP INDEX IF EXISTS idx_queue_persons_priority;
DROP INDEX IF EXISTS idx_queue_persons_stage;
DROP TABLE IF EXISTS queue_persons;
DROP TABLE IF EXISTS queue_settings;

CREATE TABLE queue_patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  priority TEXT NOT NULL,
  priority_reason TEXT,
  ticket_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  check_in_time DATETIME NOT NULL,
  called_at DATETIME,
  attended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE queue_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_patients_status ON queue_patients(status);
CREATE INDEX idx_queue_patients_priority ON queue_patients(priority);
CREATE INDEX idx_queue_patients_check_in ON queue_patients(check_in_time);

INSERT INTO queue_settings (setting_key, setting_value) VALUES ('normal_served_count', '0');
INSERT INTO queue_settings (setting_key, setting_value) VALUES ('ticket_counter_E', '0');
INSERT INTO queue_settings (setting_key, setting_value) VALUES ('ticket_counter_P', '0');
INSERT INTO queue_settings (setting_key, setting_value) VALUES ('ticket_counter_N', '0');