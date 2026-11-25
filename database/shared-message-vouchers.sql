ALTER TABLE public.santa_fixed_gift_vouchers
  ADD COLUMN IF NOT EXISTS shared_code text,
  ADD COLUMN IF NOT EXISTS shared_copied_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS santa_fixed_gift_shared_code_idx
  ON public.santa_fixed_gift_vouchers(shared_code) WHERE shared_code IS NOT NULL;

ALTER TABLE public.santa_studio_creation_allowances
  ADD COLUMN IF NOT EXISTS dad_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz;
