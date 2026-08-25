-- Replace the restrictive groomer update rules with a team-wide scheduling rule
DROP POLICY IF EXISTS "Groomers can update assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Groomers with full access can update any booking" ON public.bookings;

CREATE POLICY "Groomers can update any booking for scheduling"
ON public.bookings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role))
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));

-- Groomers need to manage add-ons on appointments they edit
CREATE POLICY "Groomers can insert booking_addons"
ON public.booking_addons
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Groomers can delete booking_addons"
ON public.booking_addons
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));