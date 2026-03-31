ALTER TABLE queue_persons ADD COLUMN started_at DATETIME;
ALTER TABLE queue_persons ADD COLUMN finished_at DATETIME;
ALTER TABLE queue_persons ADD COLUMN duration_seconds INTEGER;
ALTER TABLE queue_persons ADD COLUMN attendant_user_id INTEGER;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  guiche_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  guiche_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  duration_seconds INTEGER,
  forwarded_to_dp INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, username, password, role, guiche_id) VALUES
('Atendente Guichê 1', 'guiche1', '1234', 'guiche', 1),
('Atendente Guichê 2', 'guiche2', '1234', 'guiche', 2),
('Atendente Guichê 3', 'guiche3', '1234', 'guiche', 3),
('Atendente Guichê 4', 'guiche4', '1234', 'guiche', 4),
('Atendente Guichê 5', 'guiche5', '1234', 'guiche', 5),
('Recepção', 'recepcao', '1234', 'reception', NULL),
('DP', 'dp', '1234', 'dp', NULL),
('Administrador', 'admin', '1234', 'admin', NULL);
