
-- Allow groomers to insert commission records for their own bookings
CREATE POLICY "Groomers can insert own commission_records"
ON public.commission_records
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);
