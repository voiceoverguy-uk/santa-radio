CREATE TABLE IF NOT EXISTS santa_message_reviews (
 id uuid PRIMARY KEY,
 recipient_key text NOT NULL UNIQUE,
 contact text,
 receipt_id uuid NOT NULL,
 display_name text NOT NULL DEFAULT '',
 rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
 body text NOT NULL CHECK (char_length(body) BETWEEN 50 AND 2000),
 consent boolean NOT NULL DEFAULT false,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
 email_state text NOT NULL DEFAULT 'not_sent' CHECK (email_state IN ('not_sent','sending','sent','failed','uncertain')),
 featured boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 sent_at timestamptz,
 CHECK (NOT featured OR (consent AND state='approved'))
);
CREATE INDEX IF NOT EXISTS santa_message_reviews_created ON santa_message_reviews(created_at DESC);

ALTER TABLE santa_message_reviews ADD COLUMN IF NOT EXISTS reward_email_requested boolean NOT NULL DEFAULT true;
