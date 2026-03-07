
CREATE TABLE public.migrated_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text UNIQUE,
  phone text,
  supabase_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamp with time zone,
  activated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.migrated_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage migrated_customers"
ON public.migrated_customers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Customers can read own migrated record"
ON public.migrated_customers FOR SELECT TO authenticated
USING (supabase_user_id = auth.uid());

CREATE TABLE public.migrated_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migrated_customer_id uuid REFERENCES public.migrated_customers(id) ON DELETE CASCADE NOT NULL,
  supabase_booking_id uuid,
  dog_name text,
  dog_age text,
  dog_breed text,
  service_name text NOT NULL,
  staff_name text,
  booking_date date NOT NULL,
  booking_time text,
  duration_minutes integer,
  payment_status text,
  is_future_booking boolean NOT NULL DEFAULT false,
  total_price numeric,
  deposit_paid numeric,
  amount_due numeric,
  notes text,
  imported_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.migrated_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage migrated_bookings"
ON public.migrated_bookings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Customers can read own migrated bookings"
ON public.migrated_bookings FOR SELECT TO authenticated
USING (
  migrated_customer_id IN (
    SELECT id FROM public.migrated_customers WHERE supabase_user_id = auth.uid()
  )
);
