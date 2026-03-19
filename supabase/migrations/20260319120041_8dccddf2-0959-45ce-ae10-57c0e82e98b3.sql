
-- Create packages table
CREATE TABLE public.packages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  package_type text NOT NULL,
  session_count integer NOT NULL,
  discount_percentage numeric NOT NULL,
  price_per_session numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active packages" ON public.packages
  FOR SELECT TO public USING (true);

CREATE POLICY "Directors can manage packages" ON public.packages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

-- Create package_bookings table
CREATE TABLE public.package_bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid REFERENCES public.packages(id),
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  dog_name text,
  total_paid numeric NOT NULL,
  sessions_total integer NOT NULL,
  sessions_used integer DEFAULT 0,
  sessions_remaining integer,
  status text DEFAULT 'active',
  stripe_payment_intent_id text,
  stripe_payment_status text,
  notes text,
  created_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  refund_amount numeric,
  refund_reason text
);

ALTER TABLE public.package_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage package_bookings" ON public.package_bookings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can read package_bookings" ON public.package_bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Customers can read own package_bookings" ON public.package_bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'customer'::app_role) AND customer_email = (auth.jwt() ->> 'email'::text));

-- Create package_sessions table
CREATE TABLE public.package_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  package_booking_id uuid REFERENCES public.package_bookings(id),
  booking_id uuid REFERENCES public.bookings(id),
  session_number integer NOT NULL,
  service_type text,
  scheduled_date date,
  scheduled_time time,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.package_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage package_sessions" ON public.package_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can read package_sessions" ON public.package_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Customers can read own package_sessions" ON public.package_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'customer'::app_role) AND package_booking_id IN (
    SELECT id FROM public.package_bookings WHERE customer_email = (auth.jwt() ->> 'email'::text)
  ));

-- Seed the three packages
INSERT INTO public.packages (name, description, package_type, session_count, discount_percentage, price_per_session) VALUES
(
  'Grooming Package — 4 Sessions',
  'Pre-book 4 grooming sessions and save 10%. Mix of full groom and bath & brush welcome. Dates can be rescheduled with notice.',
  'grooming',
  4,
  10,
  NULL
),
(
  'Grooming Package — 6 Sessions',
  'Pre-book 6 grooming sessions and save 15%. Mix of full groom and bath & brush welcome. Dates can be rescheduled with notice.',
  'grooming',
  6,
  15,
  NULL
),
(
  'Teeth Cleaning Package — 5 Sessions',
  'Pre-book 5 ultrasonic teeth cleaning sessions at £20 each (normally £25). Pay £100 upfront and save £25.',
  'teeth_cleaning',
  5,
  20,
  20
);
