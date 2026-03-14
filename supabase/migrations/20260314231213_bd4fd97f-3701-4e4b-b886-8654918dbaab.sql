ALTER TABLE public.migrated_bookings
  ADD COLUMN sms_24h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_2h_sent boolean NOT NULL DEFAULT false;