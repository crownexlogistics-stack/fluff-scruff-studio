
ALTER TABLE public.wix_historical_bookings 
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'wix',
  ADD COLUMN IF NOT EXISTS created_month integer,
  ADD COLUMN IF NOT EXISTS created_year integer,
  ADD COLUMN IF NOT EXISTS customer_message text,
  ADD COLUMN IF NOT EXISTS registration_date timestamptz,
  ADD COLUMN IF NOT EXISTS price_option text;

CREATE INDEX IF NOT EXISTS idx_whb_year_month ON public.wix_historical_bookings (created_year, created_month);
CREATE INDEX IF NOT EXISTS idx_whb_email ON public.wix_historical_bookings (customer_email);
