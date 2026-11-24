CREATE TABLE IF NOT EXISTS public.santa_dad_vouchers (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^DAD-[A-F0-9]{10}-[A-F0-9]{10}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  redeemed_at timestamptz,
  claimant_sha256 text,
  CHECK ((redeemed_at IS NULL) = (claimant_sha256 IS NULL)),
  CHECK (claimant_sha256 IS NULL OR claimant_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS santa_dad_vouchers_redeemed_idx ON public.santa_dad_vouchers(redeemed_at);
ALTER TABLE public.santa_dad_vouchers ADD COLUMN IF NOT EXISTS copied_at timestamptz;
