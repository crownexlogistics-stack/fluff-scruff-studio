
CREATE TABLE public.customer_pay_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  amount NUMERIC NOT NULL,
  notes TEXT,
  stripe_payment_link_id TEXT,
  stripe_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customer_pay_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage pay links"
ON public.customer_pay_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can view own pay links"
ON public.customer_pay_links FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Groomers can insert pay links"
ON public.customer_pay_links FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
