CREATE TABLE IF NOT EXISTS santa_catalogue_artwork_images (
  hash text PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
  webp bytea NOT NULL CHECK (octet_length(webp) BETWEEN 1 AND 2097152)
);

CREATE TABLE IF NOT EXISTS santa_catalogue_artwork_assignments (
  scope text NOT NULL CHECK (scope IN ('artist','song')),
  target_key text NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  hash text NOT NULL REFERENCES santa_catalogue_artwork_images(hash),
  PRIMARY KEY (scope, target_key)
);

-- Explicit selections override the original curated gallery, including removals.
CREATE TABLE IF NOT EXISTS santa_catalogue_gallery (
  song_id integer PRIMARY KEY,
  enabled boolean NOT NULL,
  scope text NOT NULL CHECK (scope IN ('artist','song'))
);
