-- Development schema only. Replit Publish applies the reviewed schema diff to production.
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
