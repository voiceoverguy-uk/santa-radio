CREATE TABLE IF NOT EXISTS public.santa_dad_recording_support (
  access_key text PRIMARY KEY,
  reference uuid NOT NULL UNIQUE,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  recent_failures jsonb NOT NULL DEFAULT '[]',
  last_failure_at timestamptz NOT NULL DEFAULT now(),
  access_expires_at timestamptz,
  replacement_recorded_at timestamptz
);
CREATE INDEX IF NOT EXISTS santa_dad_recording_support_recent
  ON public.santa_dad_recording_support (last_failure_at DESC);

ALTER TABLE public.santa_dad_recording_support
  ADD COLUMN IF NOT EXISTS recording_completed_at timestamptz;
