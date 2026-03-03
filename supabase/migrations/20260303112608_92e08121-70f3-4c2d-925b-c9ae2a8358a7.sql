ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sms_24h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_2h_sent boolean NOT NULL DEFAULT false;