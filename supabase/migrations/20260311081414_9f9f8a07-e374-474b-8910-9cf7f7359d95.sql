
CREATE TABLE IF NOT EXISTS public.groomer_visibility_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  groomer_name text UNIQUE NOT NULL,
  hidden boolean DEFAULT false,
  hidden_at timestamptz DEFAULT now()
);

ALTER TABLE public.groomer_visibility_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and directors can select groomer_visibility"
  ON public.groomer_visibility_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

CREATE POLICY "Managers and directors can insert groomer_visibility"
  ON public.groomer_visibility_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

CREATE POLICY "Managers and directors can update groomer_visibility"
  ON public.groomer_visibility_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );
