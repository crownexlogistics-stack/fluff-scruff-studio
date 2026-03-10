
-- Allow groomers to update migrated bookings (date, time, notes, duration, staff)
CREATE POLICY "Groomers can update migrated bookings"
ON public.migrated_bookings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role))
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));
