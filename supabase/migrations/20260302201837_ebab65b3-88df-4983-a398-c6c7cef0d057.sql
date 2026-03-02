-- Allow groomers to see all bookings so they can view calendar availability
-- The frontend masks non-own booking details as "Booked"
CREATE POLICY "Groomers can view all bookings for calendar"
ON public.bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));