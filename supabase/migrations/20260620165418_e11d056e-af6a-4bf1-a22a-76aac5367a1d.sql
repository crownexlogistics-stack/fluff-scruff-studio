ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash','card','split'));
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_payment_method_check;
ALTER TABLE public.commission_records ADD CONSTRAINT commission_records_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash','card','split'));