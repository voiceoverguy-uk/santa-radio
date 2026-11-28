CREATE TABLE IF NOT EXISTS santa_artist_backgrounds (
  artist_key text PRIMARY KEY,
  background text NOT NULL CHECK (char_length(background) BETWEEN 1 AND 8000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
