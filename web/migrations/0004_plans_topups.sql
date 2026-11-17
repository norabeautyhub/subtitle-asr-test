-- Phase 1.6 — ElevenLabs වගේ plans 6ක් (Free → Business), USD මිල, Extra minutes (top-up) packs සහ orders
-- Premium (user ගේම API key) plan එක අයින් කරනවා.

ALTER TABLE plans ADD COLUMN price_usd REAL NOT NULL DEFAULT 0;

-- මිල ගණන් යෝජිත ඒවා විතරයි — Admin → Plans වලින් වෙනස් කරන්න
INSERT INTO plans (id, name, description, engine, monthly_minutes, unlimited, max_video_seconds, export_quality, watermark, max_projects, render_mode, price_lkr, price_usd, sort_order) VALUES
  ('free',     'Free',     'Test කරලා බලන්න',                'elevenlabs', 12,    0, 300,   '720p',  1, 5,     'browser', 0,      0,   1),
  ('starter',  'Starter',  'පුද්ගලික creators ලට',             'elevenlabs', 91,    0, 900,   '1080p', 0, 30,    'browser', 1800,   6,   2),
  ('creator',  'Creator',  'නිතර videos දාන අයට',             'elevenlabs', 367,   0, 1800,  '1080p', 0, 100,   'browser', 6600,   22,  3),
  ('pro',      'Pro',      'Professional creators / agencies', 'elevenlabs', 1818,  0, 3600,  '4k',    0, 500,   'browser', 29700,  99,  4),
  ('scale',    'Scale',    'Teams සහ ලොකු channels',          'elevenlabs', 5455,  0, 7200,  '4k',    0, 2000,  'browser', 89700,  299, 5),
  ('business', 'Business', 'ලොකු ආයතන',                       'elevenlabs', 18182, 0, 10800, '4k',    0, 10000, 'browser', 297000, 990, 6);

-- දැනට ඉන්න users අලුත් plans වලට
UPDATE users SET plan_id = 'free'    WHERE plan_id = 'basic';
UPDATE users SET plan_id = 'starter' WHERE plan_id = 'standard';
UPDATE users SET plan_id = 'pro'     WHERE plan_id = 'premium';
DELETE FROM plans WHERE id IN ('basic', 'standard', 'premium');

-- Premium users ලගේ keys තවදුරටත් ඕනේ නෑ
DELETE FROM user_api_keys;

-- Extra minutes packs (මාසික විනාඩි ඉවර වුණාම මිලදී ගන්න)
CREATE TABLE topup_packs (
  id         TEXT PRIMARY KEY,
  minutes    REAL NOT NULL,
  price_lkr  INTEGER NOT NULL DEFAULT 0,
  price_usd  REAL NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO topup_packs (id, minutes, price_lkr, price_usd, sort_order) VALUES
  ('pk_60',  60,  300,  1,  1),
  ('pk_300', 300, 1200, 4,  2),
  ('pk_600', 600, 2100, 7,  3);

-- Extra minutes ඇණවුම්. Payment gateway එක (PayHere / Stripe) පස්සේ — දැනට admin "Paid" කරනවා.
CREATE TABLE topup_orders (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id     TEXT,
  minutes     REAL NOT NULL,
  currency    TEXT NOT NULL,                 -- 'LKR' | 'USD'
  amount      REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'cancelled'
  method      TEXT NOT NULL DEFAULT '',      -- 'manual' | 'payhere' | 'stripe' (පස්සේ)
  payment_ref TEXT,
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  paid_at     INTEGER,
  paid_by     TEXT                           -- admin user id (manual)
);
CREATE INDEX idx_topup_orders_user ON topup_orders(user_id, created_at);
CREATE INDEX idx_topup_orders_status ON topup_orders(status, created_at);
