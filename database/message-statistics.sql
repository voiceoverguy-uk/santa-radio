-- Anonymous operational counters. No visitor identity, email, IP or audio.
CREATE TABLE IF NOT EXISTS santa_message_daily (
  day date NOT NULL, name text NOT NULL,
  creations bigint NOT NULL DEFAULT 0 CHECK (creations >= 0),
  download_clicks bigint NOT NULL DEFAULT 0 CHECK (download_clicks >= 0),
  PRIMARY KEY(day,name)
);
CREATE TABLE IF NOT EXISTS santa_message_receipts (
  id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  downloaded_at timestamptz
);
CREATE INDEX IF NOT EXISTS santa_message_receipts_expiry ON santa_message_receipts(created_at);

ALTER TABLE santa_message_receipts ADD COLUMN IF NOT EXISTS listened_at timestamptz;
ALTER TABLE santa_message_receipts ADD COLUMN IF NOT EXISTS shared_at timestamptz;
ALTER TABLE santa_message_daily ADD COLUMN IF NOT EXISTS listens bigint NOT NULL DEFAULT 0 CHECK (listens >= 0);
ALTER TABLE santa_message_daily ADD COLUMN IF NOT EXISTS shares bigint NOT NULL DEFAULT 0 CHECK (shares >= 0);

-- Anonymous PDF handoffs; random ID is per download, never per person.
CREATE TABLE IF NOT EXISTS santa_checker_downloads (
  id uuid PRIMARY KEY,
  day date NOT NULL
);
CREATE INDEX IF NOT EXISTS santa_checker_downloads_day ON santa_checker_downloads(day);

-- Aggregate Apple reports only; never store the signing key or raw account reports.
CREATE TABLE IF NOT EXISTS santa_apple_download_days (
  app_id text NOT NULL,
  day date NOT NULL,
  downloads integer NOT NULL,
  redownloads integer NOT NULL,
  updates integer NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, day)
);

CREATE TABLE IF NOT EXISTS santa_apple_app_status (
  app_id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('released','pending','unknown')),
  checked_at timestamptz NOT NULL DEFAULT now()
);
