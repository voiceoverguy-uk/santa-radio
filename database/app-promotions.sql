-- Additive app-banner library. Images are normalised JPEGs, bounded to 1 MB.
CREATE TABLE IF NOT EXISTS santa_app_promotions (
 id uuid PRIMARY KEY,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
 label text NOT NULL CHECK (length(label) BETWEEN 1 AND 240),
 link_url text NOT NULL,
 image_data bytea NOT NULL CHECK (octet_length(image_data) <= 1048576),
 thumbnail bytea NOT NULL CHECK (octet_length(thumbnail) <= 65536),
 width integer NOT NULL, height integer NOT NULL,
 ever_published boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS santa_app_promotion_live (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 campaign jsonb,
 revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO santa_app_promotion_live(singleton) VALUES(true) ON CONFLICT DO NOTHING;
