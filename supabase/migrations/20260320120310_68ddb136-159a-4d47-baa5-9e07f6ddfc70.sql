CREATE TABLE IF NOT EXISTS public.package_checkout_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES public.packages(id),
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL,
  customer_phone text DEFAULT '',
  dog_name text DEFAULT '',
  breed_id uuid,
  sessions_json jsonb NOT NULL DEFAULT '[]',
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.package_checkout_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert on package_checkout_pending"
  ON public.package_checkout_pending
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow service role all on package_checkout_pending"
  ON public.package_checkout_pending
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);