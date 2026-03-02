-- Add stripe_payment_id to bookings for payment audit trail
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_payment_id text;

-- Add index for lookup
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_id ON public.bookings(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;