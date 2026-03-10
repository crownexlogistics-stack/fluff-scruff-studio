
-- Allow commission_records to reference migrated bookings
ALTER TABLE public.commission_records 
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE public.commission_records 
  ADD COLUMN migrated_booking_id uuid REFERENCES public.migrated_bookings(id) ON DELETE SET NULL;
