
-- Allow groomers to insert schedule overrides for their own calendar
CREATE POLICY "Groomers can insert own schedule overrides"
ON public.staff_schedule_overrides
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND staff_id IN (SELECT id FROM staff WHERE auth_user_id = auth.uid())
);

-- Allow groomers to view own schedule overrides (they already can via "Anyone can read")
-- No change needed for SELECT

-- Allow groomers to insert staff notes for audit trail
CREATE POLICY "Groomers can insert staff notes"
ON public.staff_notes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) 
  AND auth.uid() = created_by
);

-- Allow managers to insert staff notes for audit trail
CREATE POLICY "Managers can insert staff notes"
ON public.staff_notes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND auth.uid() = created_by
);

-- Allow managers to read staff notes
CREATE POLICY "Managers can read staff notes"
ON public.staff_notes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));
