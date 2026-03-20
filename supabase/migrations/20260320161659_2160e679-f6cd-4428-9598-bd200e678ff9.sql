-- Let groomers read all customer pets (they already have broad customer access)
DROP POLICY IF EXISTS "Groomers can read pets for their own customers" ON public.customer_pets;
CREATE POLICY "Groomers can read all customer pets"
ON public.customer_pets
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));

-- Let groomers update all customer pets
DROP POLICY IF EXISTS "Groomers can update pets for their own customers" ON public.customer_pets;
CREATE POLICY "Groomers can update all customer pets"
ON public.customer_pets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role))
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));