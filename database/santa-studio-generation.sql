-- Explicit setup only; never create schema inside a request handler.
CREATE TABLE IF NOT EXISTS public.santa_studio_generation_access (
  access_key char(64) PRIMARY KEY,
  successes integer NOT NULL DEFAULT 0 CHECK (successes BETWEEN 0 AND 2),
  locked_identity jsonb,
  latest_choices jsonb,
  reservation uuid,
  operation uuid,
  request_hash char(64),
  reserved_until timestamptz,
  CHECK ((successes = 0) = (locked_identity IS NULL))
);
CREATE TABLE IF NOT EXISTS public.santa_studio_generation_results (
  access_key char(64) NOT NULL REFERENCES public.santa_studio_generation_access(access_key),
  operation uuid NOT NULL,
  request_hash char(64) NOT NULL,
  sequence integer NOT NULL CHECK (sequence BETWEEN 1 AND 2),
  audio bytea NOT NULL,
  PRIMARY KEY (access_key, operation),
  UNIQUE (access_key, sequence)
);
