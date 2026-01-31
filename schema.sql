PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS statuses (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS types (
  id INTEGER PRIMARY KEY,
  type_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY,
  type_id INTEGER NOT NULL,
  num_path TEXT NOT NULL,
  display_code TEXT,
  title TEXT NOT NULL,
  description_md TEXT NOT NULL,
  rationale_md TEXT,
  parent_id INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  status_id INTEGER NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES requirements(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (type_id) REFERENCES types(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_req_type_num
  ON requirements(type_id, num_path);

CREATE INDEX IF NOT EXISTS idx_req_parent_order
  ON requirements(parent_id, order_index);

CREATE INDEX IF NOT EXISTS idx_req_status
  ON requirements(status_id);

CREATE TABLE IF NOT EXISTS change_log (
  id INTEGER PRIMARY KEY,
  requirement_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT NOT NULL,
  changed_by TEXT,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS db_version (
  key TEXT PRIMARY KEY,
  value TEXT
);
