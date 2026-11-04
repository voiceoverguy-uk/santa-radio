-- Reviewed development/release schema. Never run automatically on startup/build.
-- Apply to the intended database only; production requires separate approval.
CREATE TABLE IF NOT EXISTS santa_name_catalogue (
  catalogue_key text PRIMARY KEY CHECK (catalogue_key = 'recorded-names'),
  version text CHECK (version IS NULL OR version ~ '^[a-f0-9]{64}$'),
  payload text CHECK (octet_length(payload) <= 2097152),
  record_count integer CHECK (record_count BETWEEN 1 AND 20000),
  refreshed_at timestamptz,
  next_refresh_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  retry_after timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  CHECK ((version IS NULL) = (payload IS NULL))
);
INSERT INTO santa_name_catalogue(catalogue_key) VALUES ('recorded-names')
  ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS santa_name_request_limits_expiry
  ON santa_name_request_limits(expires_at);

-- One network round trip. An exception rolls back BOTH buckets, just as the
-- previous explicit BEGIN/upsert/upsert/cleanup/COMMIT transaction did.
-- Invoker permissions only: this grants no elevated database access.
CREATE OR REPLACE FUNCTION santa_consume_name_access(
  global_key text, address_key text, global_max integer, address_max integer,
  bucket_expires timestamptz, checked_at timestamptz, access_scope text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE used_global integer; used_address integer; metadata jsonb;
BEGIN
  INSERT INTO santa_name_request_limits(bucket_key, expires_at)
    VALUES(global_key, bucket_expires) ON CONFLICT(bucket_key) DO UPDATE
    SET attempts=santa_name_request_limits.attempts+1
    WHERE santa_name_request_limits.attempts < global_max
    RETURNING attempts INTO used_global;
  IF used_global IS NULL THEN
    RAISE EXCEPTION 'NAME_ACCESS_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO santa_name_request_limits(bucket_key, expires_at)
    VALUES(address_key, bucket_expires) ON CONFLICT(bucket_key) DO UPDATE
    SET attempts=santa_name_request_limits.attempts+1
    WHERE santa_name_request_limits.attempts < address_max
    RETURNING attempts INTO used_address;
  IF used_address IS NULL THEN
    RAISE EXCEPTION 'NAME_ACCESS_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  -- Indexed, bounded housekeeping, not a separate trip on every request.
  IF used_global = 1 OR used_global % 100 = 0 THEN
    DELETE FROM santa_name_request_limits WHERE bucket_key IN (
      SELECT bucket_key FROM santa_name_request_limits
      WHERE expires_at <= checked_at ORDER BY expires_at, bucket_key
      LIMIT 100 FOR UPDATE SKIP LOCKED
    );
  END IF;
  IF access_scope IN ('search', 'count') THEN
    SELECT jsonb_build_object(
      'version', version,
      'nextRefreshAt', COALESCE(extract(epoch FROM next_refresh_at)*1000, 0),
      'retryAfter', COALESCE(extract(epoch FROM retry_after)*1000, 0)
    ) INTO metadata FROM santa_name_catalogue WHERE catalogue_key='recorded-names';
  END IF;
  RETURN metadata;
END $$;
