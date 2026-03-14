
-- Purchase Requests table
CREATE TABLE public.purchase_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by uuid REFERENCES public.staff(id) NOT NULL,
  title text NOT NULL,
  description text,
  product_link text,
  image_url text,
  priority text DEFAULT 'normal',
  status text DEFAULT 'pending',
  request_method text DEFAULT 'app',
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  responded_by text,
  decline_reason text
);

-- Purchases table
CREATE TABLE public.purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES public.purchase_requests(id),
  title text NOT NULL,
  description text,
  product_link text,
  image_url text,
  quantity integer DEFAULT 1,
  unit_price numeric,
  total_price numeric,
  supplier text,
  purchased_by text DEFAULT 'Sevak',
  purchased_at timestamptz DEFAULT now(),
  assigned_to uuid REFERENCES public.staff(id),
  assignment_type text DEFAULT 'salon',
  notes text,
  is_returned boolean DEFAULT false,
  returned_at timestamptz,
  requested_by_groomer uuid REFERENCES public.staff(id),
  request_method text
);

-- RLS for purchase_requests
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groomers can read all purchase_requests"
ON public.purchase_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Groomers can insert own purchase_requests"
ON public.purchase_requests FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND requested_by IN (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
);

CREATE POLICY "Directors and managers can manage purchase_requests"
ON public.purchase_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- RLS for purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groomers can read own assigned purchases"
ON public.purchases FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'groomer'::app_role)
  AND assigned_to IN (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
);

CREATE POLICY "Directors and managers can manage purchases"
ON public.purchases FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
