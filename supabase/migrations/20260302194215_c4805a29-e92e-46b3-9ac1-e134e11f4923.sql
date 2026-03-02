
-- Allow directors and managers to update and delete customer pets
CREATE POLICY "Directors and managers can update pets"
ON public.customer_pets
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Directors and managers can insert pets"
ON public.customer_pets
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Directors and managers can delete all pets"
ON public.customer_pets
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
