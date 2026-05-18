
-- 1. booking_flow_events table
CREATE TABLE public.booking_flow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  booking_id uuid NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_email text,
  customer_phone text,
  step text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bfe_session ON public.booking_flow_events(session_id);
CREATE INDEX idx_bfe_booking ON public.booking_flow_events(booking_id);
CREATE INDEX idx_bfe_created_at ON public.booking_flow_events(created_at DESC);

ALTER TABLE public.booking_flow_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (public booking flow runs unauthenticated)
CREATE POLICY "Anyone can log booking flow events"
ON public.booking_flow_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only staff / admins (anyone with a staff row) can read
CREATE POLICY "Staff can read booking flow events"
ON public.booking_flow_events
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_user_id = auth.uid()));

-- 2. Integrity trigger
CREATE OR REPLACE FUNCTION public.enforce_booking_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Rule 1: online bookings must have a specific service
  IF NEW.booking_source = 'online' AND NEW.service_id IS NULL THEN
    RAISE EXCEPTION 'Online bookings require a specific service_id (got NULL). Sub-service was not resolved before submit.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Rule 2: if staff has any staff_services rows, the booking's service must be one of them
  IF NEW.staff_id IS NOT NULL AND NEW.service_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.staff_services WHERE staff_id = NEW.staff_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.staff_services
         WHERE staff_id = NEW.staff_id AND service_id = NEW.service_id
       )
    THEN
      RAISE EXCEPTION 'Staff % is not approved to perform service % (staff_services restriction).', NEW.staff_id, NEW.service_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_integrity_trg ON public.bookings;
CREATE TRIGGER enforce_booking_integrity_trg
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_integrity();
