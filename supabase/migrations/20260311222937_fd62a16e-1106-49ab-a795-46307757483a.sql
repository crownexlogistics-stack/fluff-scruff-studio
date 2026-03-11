
CREATE TABLE public.academy_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  course_interest text,
  about_me text,
  referral_source text,
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'new'
);

ALTER TABLE public.academy_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert academy applications"
ON public.academy_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Directors and managers can read academy applications"
ON public.academy_applications
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Directors and managers can update academy applications"
ON public.academy_applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);
