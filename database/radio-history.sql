-- Apply explicitly to the approved history database. Never run by web/worker startup.
CREATE TABLE IF NOT EXISTS radio_history_checkpoint (
  id integer PRIMARY KEY CHECK (id = 1),
  attempted_at timestamptz,
  observed_at timestamptz,
  identity text,
  first_observed_at timestamptz,
  last_error boolean NOT NULL DEFAULT false
);
INSERT INTO radio_history_checkpoint(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS radio_history_plays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  observed_at timestamptz NOT NULL,
  identity text NOT NULL,
  artist text NOT NULL,
  title text NOT NULL
);
CREATE INDEX IF NOT EXISTS radio_history_plays_time ON radio_history_plays(observed_at);
CREATE TABLE IF NOT EXISTS radio_history_coverage (
  started_at timestamptz PRIMARY KEY,
  ended_at timestamptz NOT NULL CHECK (ended_at > started_at)
);
CREATE INDEX IF NOT EXISTS radio_history_coverage_end ON radio_history_coverage(ended_at);
