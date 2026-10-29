BEGIN;
CREATE TABLE IF NOT EXISTS christmas_contenders_settings (
  competition text PRIMARY KEY CHECK (competition = 'christmas-contenders-2026'),
  settings jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS christmas_contenders_entries (
  competition text NOT NULL REFERENCES christmas_contenders_settings(competition),
  id text NOT NULL CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  mode text NOT NULL CHECK (mode IN ('demo','live')),
  artist text NOT NULL CHECK (length(artist) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  artwork text NOT NULL CHECK (length(artwork) <= 400),
  audio text NOT NULL CHECK (length(audio) <= 400),
  approved boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 180),
  CHECK (id <> 'bob-the-elf' OR mode = 'demo'),
  PRIMARY KEY (competition, mode, id)
  ,UNIQUE (competition, id)
);
-- Explicit setup migration only; never executed by the request server.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='christmas_contenders_entries'::regclass
    AND attname='description' AND NOT attisdropped) THEN
    ALTER TABLE christmas_contenders_entries ADD COLUMN description text NOT NULL DEFAULT '' CHECK (length(description) <= 180);
    UPDATE christmas_contenders_entries
      SET description='A cheerful festive singalong from the North Pole’s own Bob the Elf.'
      WHERE id='bob-the-elf' AND mode='demo';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS christmas_contenders_ballots (
  id uuid PRIMARY KEY,
  competition text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('demo','live')),
  voter_key text NOT NULL CHECK (length(voter_key) = 64),
  entry_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','confirmed','invalidated')),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  UNIQUE (competition, mode, voter_key),
  FOREIGN KEY (competition,mode,entry_id) REFERENCES christmas_contenders_entries(competition,mode,id)
);
CREATE TABLE IF NOT EXISTS christmas_contenders_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
-- Legacy frozen table only. Existing records are preserved, never newly written,
-- subscribed, exported or promoted live by the contender vote flow.
CREATE TABLE IF NOT EXISTS christmas_contenders_marketing_consents (
  competition text NOT NULL REFERENCES christmas_contenders_settings(competition),
  mode text NOT NULL CHECK (mode IN ('demo','live')),
  email_key text NOT NULL CHECK (length(email_key) = 64),
  encrypted_email text NOT NULL CHECK (length(encrypted_email) BETWEEN 32 AND 1024),
  ballot_id uuid NOT NULL REFERENCES christmas_contenders_ballots(id),
  consented_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  consent_text text NOT NULL,
  PRIMARY KEY (competition,mode,email_key)
);
-- Minimal notification/consent metadata only: no email, name or retry payload.
CREATE TABLE IF NOT EXISTS christmas_contenders_notifications (
  ballot_id uuid PRIMARY KEY REFERENCES christmas_contenders_ballots(id),
  state text NOT NULL CHECK (state IN ('sending','accepted','simulated','failed','unknown')),
  attempt_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  consent_source text,
  consent_text text,
  CHECK (marketing_opt_in = (consented_at IS NOT NULL))
);
INSERT INTO christmas_contenders_settings VALUES ('christmas-contenders-2026',
  '{"opensAt":"2026-11-01T00:00:00.000Z","closesAt":"2026-11-30T23:59:59.999Z","availability":"scheduled","demoAvailability":"open","submissionCutoff":null}')
ON CONFLICT DO NOTHING;
INSERT INTO christmas_contenders_entries(competition,id,mode,artist,title,artwork,audio,approved,description) VALUES
 ('christmas-contenders-2026','bob-the-elf','demo','Bob the Elf','We Wish You a Merry Christmas',
 '/contenders/bob-the-elf.png','/contenders/test-song.mp3',true,
 'A cheerful festive singalong from the North Pole’s own Bob the Elf.') ON CONFLICT DO NOTHING;
-- Owner-supplied genuine contender; live ballots remain disabled independently.
INSERT INTO christmas_contenders_entries(competition,id,mode,artist,title,artwork,audio,approved,description) VALUES
 ('christmas-contenders-2026','sam-ringer-lonely-little-christmas-tree','live','Sam Ringer','Lonely Little Christmas Tree',
 '/contenders/sam-ringer-lonely-little-christmas-tree.jpeg','/contenders/sam-ringer-lonely-little-christmas-tree.mp3',true,
 'Sam Ringer is an artist presenting “Lonely Little Christmas Tree,” an original Christmas song created for the holiday season.') ON CONFLICT DO NOTHING;
INSERT INTO christmas_contenders_entries(competition,id,mode,artist,title,artwork,audio,approved,description) VALUES
 ('christmas-contenders-2026','sichi-xmas-in-milan','live','Sichi','Xmas in Milan',
 '/contenders/sichi-xmas-in-milan.jpeg','/contenders/sichi-xmas-in-milan.mp3',true,
 'An original Christmas song by Milanese independent artist Sichi, celebrating Milan’s Duomo, Galleria Vittorio Emanuele, Montenapoleone, Corso Como and the Navigli.') ON CONFLICT DO NOTHING;
-- Additional owner-supplied recordings for the preview, with no public descriptions.
-- These genuine entries remain ineligible for isolated demo ballots.
INSERT INTO christmas_contenders_entries(competition,id,mode,artist,title,artwork,audio,approved) VALUES
 ('christmas-contenders-2026','paul-byers-the-thought-that-counts','live','Paul Byers','The Thought That Counts',
 '/contenders/paul-byers-the-thought-that-counts.jpeg','/contenders/paul-byers-the-thought-that-counts.mp3',true),
 ('christmas-contenders-2026','rich-stolp-i-cant-wait-for-christmas','live','Rich Stolp','I Can''t Wait for Christmas',
 '/contenders/rich-stolp-i-cant-wait-for-christmas.jpg','/contenders/rich-stolp-i-cant-wait-for-christmas.mp3',true),
 ('christmas-contenders-2026','rob-dalton-snow-is-falling-on-this-christmas-day','live','Rob Dalton','Snow Is Falling on This Christmas Day',
 '/contenders/rob-dalton-snow-is-falling.jpeg','/contenders/rob-dalton-snow-is-falling-on-this-christmas-day.mp3',true),
 ('christmas-contenders-2026','louhi-no-time-to-say-goodbye','live','Louhi','No Time to Say Goodbye',
 '/contenders/louhi-no-time-to-say-goodbye.jpg','/contenders/louhi-no-time-to-say-goodbye.mp3',true),
 ('christmas-contenders-2026','ken-sealey-its-christmas-shake-your-bum','live','Ken Sealey','It’s Christmas, Shake Your Bum',
 '/contenders/ken-sealey-its-christmas-shake-your-bum.jpeg','/contenders/ken-sealey-its-christmas-shake-your-bum.mp3',true),
 ('christmas-contenders-2026','phillip-streets-a-little-bit-of-christmas-radio-mix','live','Phillip Streets','A Little Bit of Christmas (Radio Mix)',
 '/contenders/santa-no-artwork.jpeg','/contenders/phillip-streets-a-little-bit-of-christmas-radio-mix.mp3',true)
ON CONFLICT DO NOTHING;
COMMIT;
