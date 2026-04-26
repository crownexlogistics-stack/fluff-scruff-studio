-- 1. Add the toggle column on staff (off by default, never null)
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS full_calendar_access boolean NOT NULL DEFAULT false;

-- 2. Helper: does the signed-in user (a groomer) have the toggle on?
--    SECURITY DEFINER + stable, used inside RLS to avoid recursion.
CREATE OR REPLACE FUNCTION public.has_full_calendar_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.auth_user_id = _user_id
      AND s.full_calendar_access = true
  );
$$;

-- 3. Bookings: allow elevated groomers to update any booking
DROP POLICY IF EXISTS "Groomers with full access can update any booking" ON public.bookings;
CREATE POLICY "Groomers with full access can update any booking"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'groomer'::app_role)
    AND public.has_full_calendar_access(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'groomer'::app_role)
    AND public.has_full_calendar_access(auth.uid())
  );

-- 4. SMS messages: allow elevated groomers to read all messages
DROP POLICY IF EXISTS "Groomers with full access can read all sms" ON public.sms_messages;
CREATE POLICY "Groomers with full access can read all sms"
  ON public.sms_messages
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'groomer'::app_role)
    AND public.has_full_calendar_access(auth.uid())
  );

-- 5. SMS messages: allow elevated groomers to insert outbound messages to any customer
DROP POLICY IF EXISTS "Groomers with full access can insert sms" ON public.sms_messages;
CREATE POLICY "Groomers with full access can insert sms"
  ON public.sms_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'groomer'::app_role)
    AND public.has_full_calendar_access(auth.uid())
  );