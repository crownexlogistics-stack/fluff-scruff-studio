ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cash_collected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_collected numeric DEFAULT 0;

ALTER TABLE public.commission_records
  ADD COLUMN IF NOT EXISTS cash_collected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_collected numeric DEFAULT 0;