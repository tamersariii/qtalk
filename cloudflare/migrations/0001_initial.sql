CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY(channel_id, user_id)
);
CREATE TABLE IF NOT EXISTS presence (
  user_id TEXT PRIMARY KEY,
  channel_id TEXT,
  last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS device_tokens (
  user_id TEXT PRIMARY KEY,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO channels (id, name, member_count) VALUES ('team', 'Saha Ekibi', 4), ('dispatch', 'Merkez', 1);
