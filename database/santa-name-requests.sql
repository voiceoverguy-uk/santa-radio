-- Additive schema applied by scripts/migrate-name-requests.mjs during production builds.
CREATE TABLE IF NOT EXISTS santa_name_requests (
  request_key text PRIMARY KEY, name text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  first_requested_at timestamptz NOT NULL, last_requested_at timestamptz NOT NULL
);
ALTER TABLE santa_name_requests ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
CREATE TABLE IF NOT EXISTS santa_name_request_submissions (
  visitor_key text NOT NULL, request_key text NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(visitor_key, request_key)
);
CREATE TABLE IF NOT EXISTS santa_name_request_limits (
  bucket_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS santa_name_request_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_key text NOT NULL REFERENCES santa_name_requests(request_key),
  name text NOT NULL, request_count integer NOT NULL,
  first_requested_at timestamptz NOT NULL, last_requested_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS santa_name_recording_suggestions (
  request_key text NOT NULL REFERENCES santa_name_requests(request_key),
  recording_id text NOT NULL, recorded_name text NOT NULL, recording_file text NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (request_key, recording_id)
);
ALTER TABLE santa_name_request_history
  ADD COLUMN IF NOT EXISTS recording_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE santa_name_requests ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
CREATE TABLE IF NOT EXISTS santa_name_request_notifications (
  request_key text NOT NULL REFERENCES santa_name_requests(request_key),
  recipient_key text NOT NULL, contact text, source text NOT NULL,
  state text NOT NULL DEFAULT 'waiting', attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(request_key,recipient_key)
);
