
-- Allow directors and managers to read customer pets for the profile page
CREATE POLICY "Directors and managers can read all pets"
ON public.customer_pets
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
