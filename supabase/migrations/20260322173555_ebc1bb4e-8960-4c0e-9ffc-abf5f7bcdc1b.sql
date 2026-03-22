
CREATE TABLE public.academy_enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  programme_interest TEXT,
  message TEXT,
  referral_source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can view academy enquiries"
ON public.academy_enquiries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Directors and managers can update academy enquiries"
ON public.academy_enquiries
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Anyone can insert academy enquiries"
ON public.academy_enquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
