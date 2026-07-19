
ALTER TABLE public.package_bookings
  ADD COLUMN IF NOT EXISTS amount_received numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_collected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_collected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_by_staff_id uuid REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill from legacy stripe_payment_status
UPDATE public.package_bookings
SET amount_received = total_paid,
    payment_method = 'stripe',
    paid_at = COALESCE(paid_at, created_at)
WHERE stripe_payment_status = 'paid'
  AND amount_received = 0;

UPDATE public.package_bookings
SET amount_received = total_paid,
    payment_method = 'card',
    paid_at = COALESCE(paid_at, created_at)
WHERE stripe_payment_status = 'paid_in_salon'
  AND total_paid > 0
  AND amount_received = 0;

UPDATE public.package_bookings
SET payment_method = 'unpaid'
WHERE payment_method IS NULL;
