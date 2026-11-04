-- Development schema source; applied by explicit development/post-merge setup.
-- Replit-managed production changes use its approved schema-sync process.
-- Never run this file directly against production, at startup, or during a build.
-- Separate from sandbox, native purchases, vouchers and generated recordings.
BEGIN;
CREATE TABLE IF NOT EXISTS public.santa_studio_live_sales_settings (
  key text PRIMARY KEY CHECK(key='public'),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.santa_studio_live_sales_settings(key) VALUES('public') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.santa_studio_live_attempts (
  claim_sha256 char(64) PRIMARY KEY,
  checkout_session_id text UNIQUE,
  generation integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_purchases (
  checkout_session_id text PRIMARY KEY,
  payment_intent_id text NOT NULL UNIQUE,
  claim_sha256 char(64) NOT NULL,
  email_sha256 char(64) NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS santa_studio_live_purchase_email
  ON public.santa_studio_live_purchases(email_sha256);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_sessions (
  token_sha256 char(64) PRIMARY KEY,
  checkout_session_id text NOT NULL REFERENCES public.santa_studio_live_purchases(checkout_session_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_webhook_health (
  endpoint_id text PRIMARY KEY,
  secret_sha256 char(64) NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_worker_health (
  worker text PRIMARY KEY,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_email_health (
  sender text PRIMARY KEY,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.santa_studio_live_email (
  id uuid PRIMARY KEY,
  request_key text NOT NULL UNIQUE,
  checkout_session_id text NOT NULL REFERENCES public.santa_studio_live_purchases(checkout_session_id),
  nonce text NOT NULL,
  token_sha256 char(64) NOT NULL UNIQUE,
  token_expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS santa_studio_live_email_due
  ON public.santa_studio_live_email(next_attempt_at) WHERE sent_at IS NULL;
CREATE TABLE IF NOT EXISTS public.santa_studio_live_limits (
  bucket_key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
COMMIT;
