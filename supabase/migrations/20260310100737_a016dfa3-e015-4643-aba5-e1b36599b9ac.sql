
-- Allow groomers to read all migrated bookings for calendar visibility
CREATE POLICY "Groomers can view all migrated bookings for calendar"
ON public.migrated_bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));
