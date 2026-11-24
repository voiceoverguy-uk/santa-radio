-- Preserve original issue numbers and their signed sessions. Each new Kids
-- issue advances by 20, keeping the same display position and a fresh allowance.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.santa_friend_vouchers'::regclass
    AND conname = 'santa_friend_vouchers_slot_check') THEN
    ALTER TABLE public.santa_friend_vouchers
      DROP CONSTRAINT santa_friend_vouchers_slot_check,
      ADD CONSTRAINT santa_friend_vouchers_positive_slot CHECK (slot > 0);
  END IF;
END
$migration$;

ALTER TABLE public.santa_friend_vouchers ADD COLUMN IF NOT EXISTS copied_at timestamptz;
CREATE INDEX IF NOT EXISTS santa_friend_vouchers_latest_issue
  ON public.santa_friend_vouchers (((slot - 1) % 20), slot DESC);

-- Individually issued gift codes use the same two-creation Studio allowance.
-- Only a digest is stored. These gifts never rotate through the dashboard pool.
CREATE TABLE IF NOT EXISTS public.santa_fixed_gift_vouchers (
  code_sha256 text PRIMARY KEY CHECK (code_sha256 ~ '^[a-f0-9]{64}$'),
  valid_until timestamptz NOT NULL,
  redeemed_at timestamptz,
  claimant_sha256 text CHECK (claimant_sha256 ~ '^[a-f0-9]{64}$'),
  CHECK ((redeemed_at IS NULL) = (claimant_sha256 IS NULL))
);
