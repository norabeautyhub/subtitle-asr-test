-- Phase 1.1 — Users, sessions, plans, minutes credits

CREATE TABLE plans (
  id                TEXT PRIMARY KEY,           -- 'basic' | 'standard' | 'premium' | (පස්සේ) 'free'
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  engine            TEXT NOT NULL,              -- 'elevenlabs' (අපේ key) | 'elevenlabs_byok' (user ගේ key) | පස්සේ 'whisper_sinhala'
  monthly_minutes   REAL NOT NULL DEFAULT 0,    -- හැම මාසෙම ලැබෙන විනාඩි (මාසය ඉවර වුණාම reset)
  unlimited         INTEGER NOT NULL DEFAULT 0, -- 1 = minutes limit නෑ (BYOK)
  max_video_seconds INTEGER NOT NULL DEFAULT 600,
  export_quality    TEXT NOT NULL DEFAULT '1080p', -- '720p' | '1080p' | '4k'
  watermark         INTEGER NOT NULL DEFAULT 0,
  max_projects      INTEGER NOT NULL DEFAULT 50,
  render_mode       TEXT NOT NULL DEFAULT 'browser', -- 'browser' | 'server'
  price_lkr         INTEGER NOT NULL DEFAULT 0,  -- පෙන්වන්න විතරයි (payments Phase 3)
  sort_order        INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1
);

INSERT INTO plans (id, name, description, engine, monthly_minutes, unlimited, max_video_seconds, export_quality, watermark, max_projects, render_mode, price_lkr, sort_order) VALUES
  ('basic',    'Basic',    'Minutes credits වලින් පාවිච්චි කරන්න', 'elevenlabs',      0,   0, 300,  '720p',  1, 10,  'browser', 0, 1),
  ('standard', 'Standard', 'හැම මාසෙම විනාඩි 120ක්',             'elevenlabs',      120, 0, 900,  '1080p', 0, 100, 'browser', 0, 2),
  ('premium',  'Premium',  'ඔයාගේම ElevenLabs API key එක — limit නෑ', 'elevenlabs_byok', 0,   1, 3600, '4k',    0, 500, 'server',  0, 3);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  plan_id       TEXT NOT NULL DEFAULT 'basic' REFERENCES plans(id),
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'blocked'
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,                  -- token එකේ SHA-256 hash එක (token එක database එකේ save කරන්නේ නෑ)
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- මිලදී ගත්/bonus/admin credits සහ ඒවායින් අඩු වුණු ප්‍රමාණ. Balance = SUM(minutes)
CREATE TABLE credit_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minutes    REAL NOT NULL,                     -- + එකතු වීම / - අඩු වීම
  type       TEXT NOT NULL,                     -- 'signup_bonus' | 'purchase' | 'admin' | 'usage' | 'refund'
  note       TEXT NOT NULL DEFAULT '',
  ref        TEXT,                              -- usage id / payment id
  created_by TEXT,                              -- admin user id (admin වෙනස්කම් වලට)
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_ledger_user ON credit_ledger(user_id, created_at);

-- හැම video process කිරීමක්ම. Plan එකේ මාසික විනාඩි මුලින්ම, ඊට පස්සේ credits.
CREATE TABLE usage (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period         TEXT NOT NULL,                 -- 'YYYY-MM'
  seconds        REAL NOT NULL,
  minutes        REAL NOT NULL,
  from_allowance REAL NOT NULL DEFAULT 0,
  from_credits   REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL,                 -- 'reserved' | 'committed' | 'refunded'
  engine         TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_usage_user_period ON usage(user_id, period);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('signup_bonus_minutes', '5'),
  ('signups_enabled', '1');
