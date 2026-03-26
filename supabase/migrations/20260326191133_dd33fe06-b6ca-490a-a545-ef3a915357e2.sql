-- FIX 1: Package booking RLS policies for groomers
CREATE POLICY "Groomers can create package_bookings"
ON public.package_bookings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'groomer'));

CREATE POLICY "Groomers can create package_sessions"
ON public.package_sessions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'groomer'));

-- FIX 3: Activity log table
CREATE TABLE public.groomer_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid REFERENCES public.staff(id),
  action_type text NOT NULL,
  action_summary text NOT NULL,
  booking_id uuid REFERENCES public.bookings(id),
  customer_name text,
  dog_name text,
  booking_date date,
  booking_time time,
  service_name text,
  extra_details jsonb,
  performed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_groomer_activity_staff_time ON public.groomer_activity_log(staff_id, performed_at DESC);

ALTER TABLE public.groomer_activity_log ENABLE ROW LEVEL SECURITY;

-- Groomers can only see their own activity
CREATE POLICY "Groomers can view own activity"
ON public.groomer_activity_log
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'groomer') AND
  staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

-- Groomers can insert their own activity
CREATE POLICY "Groomers can insert own activity"
ON public.groomer_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'groomer') AND
  staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

-- Directors and managers can view all activity
CREATE POLICY "Directors and managers can view all activity"
ON public.groomer_activity_log
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'manager')
);

-- Directors and managers can insert activity (for system-generated logs)
CREATE POLICY "Directors and managers can insert activity"
ON public.groomer_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'manager')
);

-- Delete test record from debugging
DELETE FROM public.package_bookings WHERE id = '0db9dd1e-414a-4a2d-a0c7-3081024e889f';