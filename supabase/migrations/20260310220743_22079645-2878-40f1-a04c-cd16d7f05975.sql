
-- Create wix_historical_bookings table
CREATE TABLE public.wix_historical_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  price_charged numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Not Paid',
  service_name text NOT NULL,
  service_type text,
  appointment_date timestamp with time zone NOT NULL,
  appointment_end timestamp with time zone,
  booking_status text NOT NULL DEFAULT 'Confirmed',
  groomer_name text,
  wix_order_number text UNIQUE,
  duration_text text,
  dog_name text,
  dog_breed text,
  dog_age text,
  referral_source text,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  excluded_from_revenue boolean NOT NULL DEFAULT false,
  revenue_recognised boolean NOT NULL DEFAULT false,
  migrated_to_main boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.wix_historical_bookings ENABLE ROW LEVEL SECURITY;

-- RLS: director and manager can read all
CREATE POLICY "Directors and managers can manage wix_historical_bookings"
  ON public.wix_historical_bookings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
