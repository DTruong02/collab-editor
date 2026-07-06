CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS doc_updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     TEXT NOT NULL,
  update_blob BLOB NOT NULL,
  created_at  DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_updates_room ON doc_updates(room_id);
