CREATE POLICY "Groomers can insert pets for their customers"
ON public.customer_pets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role)
  AND groomer_can_access_customer(user_id)
);