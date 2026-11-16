-- Short-lived, browser-bound email challenges. No plaintext email or code.
CREATE TABLE IF NOT EXISTS santa_free_message_verifications (
  id uuid PRIMARY KEY,
  binding_hash text NOT NULL,
  code_hash text NOT NULL,
  contact text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  delivered boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS santa_free_message_verifications_expiry ON santa_free_message_verifications(expires_at);

-- Auditable wording and confirmation time; no readable contact data.
CREATE TABLE IF NOT EXISTS santa_free_message_consents (
  verification_id uuid PRIMARY KEY,
  email_key text NOT NULL,
  consent_version text NOT NULL,
  consent_copy text NOT NULL,
  subscription_status text NOT NULL CHECK (subscription_status IN ('subscribed','suppressed')),
  confirmed_at timestamptz NOT NULL
);
