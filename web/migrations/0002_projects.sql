-- Phase 1.2 — Video projects, subtitles (transcripts), Premium users ලගේ API keys

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  video_key     TEXT NOT NULL,                 -- R2 එකේ file එක තියෙන තැන
  upload_id     TEXT,                          -- R2 multipart upload id (upload වෙන අතරතුර)
  content_type  TEXT NOT NULL DEFAULT 'video/mp4',
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  duration      REAL NOT NULL DEFAULT 0,       -- තත්පර
  width         INTEGER NOT NULL DEFAULT 0,
  height        INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'uploading', -- 'uploading' | 'uploaded' | 'ready'
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_projects_user ON projects(user_id, created_at);

CREATE TABLE transcripts (
  project_id  TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  language    TEXT NOT NULL DEFAULT 'si',
  engine      TEXT NOT NULL DEFAULT '',
  words_json  TEXT NOT NULL,                   -- [{"text":"...","start":0.5,"end":0.9}, ...]
  text        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE user_api_keys (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,                   -- 'elevenlabs'
  ciphertext  TEXT NOT NULL,                   -- AES-GCM encrypt කරපු key එක
  iv          TEXT NOT NULL,
  last4       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider)
);
