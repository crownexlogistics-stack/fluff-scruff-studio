
DROP POLICY IF EXISTS "Groomers can insert pets for their customers" ON public.customer_pets;
CREATE POLICY "Groomers can insert pets for any customer"
ON public.customer_pets
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));
