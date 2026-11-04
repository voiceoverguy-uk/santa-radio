-- Explicit managed migration only. Never run schema changes in a request.
-- Existing purchases start with zero known creations; no historical backfill.
CREATE TABLE IF NOT EXISTS public.santa_studio_creation_allowances (
  access_key char(64) PRIMARY KEY,
  operations uuid[] NOT NULL DEFAULT '{}',
  reservation uuid,
  operation uuid,
  reserved_until timestamptz,
  expires_at timestamptz,
  CHECK (cardinality(operations) BETWEEN 0 AND 2),
  CHECK ((reservation IS NULL) = (operation IS NULL)),
  CHECK ((reservation IS NULL) = (reserved_until IS NULL))
);
CREATE INDEX IF NOT EXISTS santa_studio_creation_expiry
  ON public.santa_studio_creation_allowances(expires_at) WHERE expires_at IS NOT NULL;
