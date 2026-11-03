-- Explicit setup only. No voucher, cookie, IP address or child details.
BEGIN;
CREATE TABLE IF NOT EXISTS public.santa_workshop_usage_sessions (
  access_key char(64) PRIMARY KEY,
  code_id smallint NOT NULL CHECK (code_id BETWEEN 1 AND 6),
  entry_kind text NOT NULL CHECK (entry_kind IN ('entry', 'another')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.santa_workshop_usage_sessions
  DROP CONSTRAINT IF EXISTS santa_workshop_usage_sessions_code_id_check;
ALTER TABLE public.santa_workshop_usage_sessions
  ADD CONSTRAINT santa_workshop_usage_sessions_code_id_check CHECK (code_id BETWEEN 1 AND 6);
ALTER TABLE public.santa_studio_generation_results
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE public.santa_studio_generation_results r
SET created_at=s.created_at
FROM public.santa_workshop_usage_sessions s
WHERE s.access_key=r.access_key AND s.code_id=6 AND s.entry_kind='entry'
  AND r.created_at IS NULL;
COMMIT;
