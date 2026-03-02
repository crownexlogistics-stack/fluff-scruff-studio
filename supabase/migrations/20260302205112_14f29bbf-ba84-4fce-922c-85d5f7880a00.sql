-- Allow groomers to access pets for customers they have groomed
CREATE OR REPLACE FUNCTION public.groomer_can_access_customer(_customer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.bookings b ON b.staff_id = s.id
    JOIN auth.users u ON u.id = _customer_user_id
    WHERE s.auth_user_id = auth.uid()
      AND b.customer_email IS NOT NULL
      AND lower(b.customer_email) = lower(u.email)
  );
$$;

CREATE POLICY "Groomers can read pets for their own customers"
ON public.customer_pets
FOR SELECT
USING (
  has_role(auth.uid(), 'groomer'::app_role)
  AND public.groomer_can_access_customer(user_id)
);

CREATE POLICY "Groomers can update pets for their own customers"
ON public.customer_pets
FOR UPDATE
USING (
  has_role(auth.uid(), 'groomer'::app_role)
  AND public.groomer_can_access_customer(user_id)
)
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role)
  AND public.groomer_can_access_customer(user_id)
);