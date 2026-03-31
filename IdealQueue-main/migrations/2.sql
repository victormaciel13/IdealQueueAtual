DROP INDEX IF EXISTS idx_queue_patients_check_in;
DROP INDEX IF EXISTS idx_queue_patients_priority;
DROP INDEX IF EXISTS idx_queue_patients_status;
DROP TABLE IF EXISTS queue_patients;
DROP TABLE IF EXISTS queue_settings;

CREATE TABLE queue_persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rg TEXT NOT NULL,
  is_pregnant INTEGER DEFAULT 0,
  has_infant INTEGER DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal',
  ticket_reception TEXT NOT NULL,
  ticket_dp TEXT,
  stage TEXT NOT NULL DEFAULT 'reception',
  assigned_baia INTEGER,
  check_in_time DATETIME NOT NULL,
  called_reception_at DATETIME,
  called_dp_at DATETIME,
  completed_at DATETIME,
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

CREATE INDEX idx_queue_persons_stage ON queue_persons(stage);
CREATE INDEX idx_queue_persons_priority ON queue_persons(priority);
CREATE INDEX idx_queue_persons_check_in ON queue_persons(check_in_time);

INSERT INTO queue_settings (setting_key, setting_value) VALUES ('normal_served_count', '0');
INSERT INTO queue_settings (setting_key, setting_value) VALUES ('ticket_counter_R', '0');
INSERT INTO queue_settings (setting_key, setting_value) VALUES ('ticket_counter_DP', '0');