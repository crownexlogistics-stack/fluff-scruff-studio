
-- Add pricing and duration columns to breeds
ALTER TABLE public.breeds 
  ADD COLUMN IF NOT EXISTS price_bath_brush numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_full_groom numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;

-- Restrict breeds management to director only (drop existing manager+director policy)
DROP POLICY IF EXISTS "Directors and managers can manage breeds" ON public.breeds;

CREATE POLICY "Directors can manage breeds"
ON public.breeds
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'director'::app_role));
