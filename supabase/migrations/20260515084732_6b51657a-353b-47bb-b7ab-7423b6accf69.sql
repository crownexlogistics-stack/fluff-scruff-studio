
-- Tables
CREATE TABLE public.ai_inbox_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type text NOT NULL CHECK (case_type IN ('missed_opportunity','message','callback_requested','running_late','ai_booking_notification')),
  status text NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned','assigned','resolved')),
  caller_number text,
  caller_name text,
  dog_name text,
  summary text,
  full_transcript jsonb,
  call_duration_seconds integer,
  assigned_to uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  resolved_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  appointment_time text,
  minutes_late integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_inbox_cases_status_type ON public.ai_inbox_cases(status, case_type, created_at DESC);
CREATE INDEX idx_ai_inbox_cases_assigned ON public.ai_inbox_cases(assigned_to, status);

CREATE TRIGGER trg_ai_inbox_cases_updated_at
BEFORE UPDATE ON public.ai_inbox_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_inbox_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.ai_inbox_cases(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_inbox_notifications_staff ON public.ai_inbox_notifications(staff_id, is_read, created_at DESC);

-- RLS
ALTER TABLE public.ai_inbox_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inbox_notifications ENABLE ROW LEVEL SECURITY;

-- Helper: current user's staff id
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ai_inbox_cases policies
CREATE POLICY "Staff can read unassigned or resolved cases"
ON public.ai_inbox_cases FOR SELECT
TO authenticated
USING (status IN ('unassigned','resolved'));

CREATE POLICY "Staff can read their assigned cases"
ON public.ai_inbox_cases FOR SELECT
TO authenticated
USING (assigned_to = public.current_staff_id());

CREATE POLICY "Directors can read all cases"
ON public.ai_inbox_cases FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Authenticated can insert cases"
ON public.ai_inbox_cases FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can update unassigned or own cases"
ON public.ai_inbox_cases FOR UPDATE
TO authenticated
USING (status = 'unassigned' OR assigned_to = public.current_staff_id())
WITH CHECK (true);

CREATE POLICY "Directors can update all cases"
ON public.ai_inbox_cases FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'director'))
WITH CHECK (true);

-- ai_inbox_notifications policies
CREATE POLICY "Staff can read their own notifications"
ON public.ai_inbox_notifications FOR SELECT
TO authenticated
USING (staff_id = public.current_staff_id());

CREATE POLICY "Staff can update their own notifications"
ON public.ai_inbox_notifications FOR UPDATE
TO authenticated
USING (staff_id = public.current_staff_id())
WITH CHECK (staff_id = public.current_staff_id());

-- (No INSERT policy: only service role / SECURITY DEFINER triggers may insert.)

-- Trigger: auto-create missed_opportunity case from ai_call_logs
CREATE OR REPLACE FUNCTION public.auto_create_inbox_case_from_ai_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text := COALESCE(NEW.summary, '');
BEGIN
  IF NEW.outcome = 'transferred'
     OR s ILIKE '%unable%'
     OR s ILIKE '%technical%'
     OR s ILIKE '%difficulty%' THEN
    INSERT INTO public.ai_inbox_cases (
      case_type, status, caller_number, summary, full_transcript, call_duration_seconds
    ) VALUES (
      'missed_opportunity', 'unassigned', NEW.caller_number, NEW.summary, NEW.transcript, NEW.duration_seconds
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_inbox_case_from_ai_call
AFTER INSERT ON public.ai_call_logs
FOR EACH ROW EXECUTE FUNCTION public.auto_create_inbox_case_from_ai_call();

-- Realtime
ALTER TABLE public.ai_inbox_cases REPLICA IDENTITY FULL;
ALTER TABLE public.ai_inbox_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_inbox_cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_inbox_notifications;
