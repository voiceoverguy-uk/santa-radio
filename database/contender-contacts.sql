ALTER TABLE christmas_contenders_entries
  ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invitation_state text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;
