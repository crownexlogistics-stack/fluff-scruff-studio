
-- Allow groomers to update their own schedule overrides
CREATE POLICY "Groomers can update own schedule overrides"
ON public.staff_schedule_overrides
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND staff_id IN (SELECT id FROM staff WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND staff_id IN (SELECT id FROM staff WHERE auth_user_id = auth.uid())
);

-- Allow groomers to delete their own schedule overrides
CREATE POLICY "Groomers can delete own schedule overrides"
ON public.staff_schedule_overrides
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND staff_id IN (SELECT id FROM staff WHERE auth_user_id = auth.uid())
);
