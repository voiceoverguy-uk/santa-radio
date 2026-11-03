-- Mobile-only credentials and usage accounting. No name, contact, choices,
-- MP3, product catalogue, or entitlement mirror is stored in these tables.
CREATE TABLE IF NOT EXISTS santa_mobile_sessions (
  token_hash text PRIMARY KEY,
  customer_id text NOT NULL UNIQUE,
  free_grant text,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS santa_mobile_sessions_expiry ON santa_mobile_sessions(expires_at);
CREATE TABLE IF NOT EXISTS santa_mobile_generations (
  request_key text PRIMARY KEY,
  customer_id text NOT NULL,
  purchase_key text,
  completed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS santa_mobile_purchase_once
  ON santa_mobile_generations(purchase_key) WHERE purchase_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS santa_mobile_generation_active
  ON santa_mobile_generations(customer_id) WHERE completed = false;
