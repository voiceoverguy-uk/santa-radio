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
