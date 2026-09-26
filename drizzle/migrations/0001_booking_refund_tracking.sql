ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS refunded_at timestamptz;