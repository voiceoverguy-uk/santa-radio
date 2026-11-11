BEGIN;
CREATE TABLE IF NOT EXISTS christmas_contenders_verifications (
  id uuid PRIMARY KEY,
  competition text NOT NULL,
  voter_key text NOT NULL CHECK (length(voter_key)=64),
  entry_id text NOT NULL,
  mode text NOT NULL DEFAULT 'live' CHECK (mode='live'),
  code_hash text NOT NULL CHECK (length(code_hash)=64),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  FOREIGN KEY (competition,mode,entry_id) REFERENCES christmas_contenders_entries(competition,mode,id)
);
CREATE INDEX IF NOT EXISTS christmas_contenders_verification_expiry ON christmas_contenders_verifications(expires_at);
COMMIT;
