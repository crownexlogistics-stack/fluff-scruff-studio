
-- Step 1: Create booking_audit_log table
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  performed_by text,
  performed_at timestamptz DEFAULT now(),
  old_date date,
  old_time time,
  new_date date,
  new_time time,
  note text
);

CREATE INDEX ON booking_audit_log (booking_id);
CREATE INDEX ON booking_audit_log (performed_at);

ALTER TABLE booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read booking_audit_log"
ON booking_audit_log FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Staff can insert booking_audit_log"
ON booking_audit_log FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'groomer'::app_role)
);

-- Step 2: Add booking_source and created_by_staff to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'unknown';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_staff text DEFAULT null;
