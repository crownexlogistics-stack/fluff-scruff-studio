
-- ============================================================
-- 1) Package payment audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.package_payment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_booking_id uuid REFERENCES public.package_bookings(id) ON DELETE CASCADE,
  package_session_id uuid REFERENCES public.package_sessions(id) ON DELETE SET NULL,
  booking_id uuid,
  stripe_payment_intent_id text,
  amount numeric,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  old_date date,
  old_time time,
  new_date date,
  new_time time,
  performed_by text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.package_payment_audit TO authenticated;
GRANT ALL ON public.package_payment_audit TO service_role;

ALTER TABLE public.package_payment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read package payment audit"
  ON public.package_payment_audit
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'groomer')
  );

CREATE INDEX IF NOT EXISTS idx_ppa_pkg_booking ON public.package_payment_audit(package_booking_id);
CREATE INDEX IF NOT EXISTS idx_ppa_pi ON public.package_payment_audit(stripe_payment_intent_id);

-- ============================================================
-- 2) Trigger: log payment_matched on package_bookings INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_package_payment_matched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stripe_payment_intent_id IS NOT NULL THEN
    INSERT INTO public.package_payment_audit (
      package_booking_id, stripe_payment_intent_id, amount,
      event_type, performed_by, note
    ) VALUES (
      NEW.id, NEW.stripe_payment_intent_id, NEW.total_paid,
      'payment_matched', 'System (Stripe webhook)',
      'Stripe package payment matched to package booking on creation.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_package_payment_matched ON public.package_bookings;
CREATE TRIGGER trg_log_package_payment_matched
AFTER INSERT ON public.package_bookings
FOR EACH ROW EXECUTE FUNCTION public.log_package_payment_matched();

-- ============================================================
-- 3) Update sync_package_session_from_booking to log + use 'rescheduled' status
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_package_session_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pkg_session_id uuid;
  _pkg_booking_id uuid;
  _old_date date;
  _old_time time;
  _old_session_status text;
  _new_status text;
  _completed_count int;
  _total int;
  _rescheduled boolean := false;
BEGIN
  SELECT id, package_booking_id, scheduled_date, scheduled_time, status
    INTO _pkg_session_id, _pkg_booking_id, _old_date, _old_time, _old_session_status
  FROM public.package_sessions
  WHERE booking_id = NEW.id
  LIMIT 1;

  IF _pkg_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reschedule detection (only when staying scheduled-ish)
  IF (NEW.booking_date IS DISTINCT FROM OLD.booking_date
      OR NEW.booking_time IS DISTINCT FROM OLD.booking_time)
     AND NEW.status IN ('Pending','Confirmed') THEN
    _rescheduled := true;
    UPDATE public.package_sessions
    SET scheduled_date = NEW.booking_date,
        scheduled_time = NEW.booking_time,
        status = 'rescheduled'
    WHERE id = _pkg_session_id;

    INSERT INTO public.booking_audit_log (booking_id, event_type, performed_by, note, old_date, old_time, new_date, new_time)
    VALUES (NEW.id, 'package_session_rescheduled', 'System (package sync)',
            'Package session schedule updated to match booking.',
            _old_date, _old_time, NEW.booking_date, NEW.booking_time);

    INSERT INTO public.package_payment_audit (
      package_booking_id, package_session_id, booking_id, event_type,
      old_status, new_status, old_date, old_time, new_date, new_time,
      performed_by, note
    ) VALUES (
      _pkg_booking_id, _pkg_session_id, NEW.id, 'session_rescheduled',
      _old_session_status, 'rescheduled', _old_date, _old_time, NEW.booking_date, NEW.booking_time,
      'System (package sync)', 'Booking date/time changed.'
    );
  END IF;

  -- Status mirror
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _new_status := CASE
      WHEN NEW.status = 'Completed' THEN 'completed'
      WHEN NEW.status = 'Cancelled' THEN 'cancelled'
      WHEN NEW.status IN ('Pending','Confirmed') THEN
        CASE WHEN _rescheduled THEN 'rescheduled' ELSE 'scheduled' END
      ELSE NULL
    END;

    IF _new_status IS NOT NULL AND _new_status IS DISTINCT FROM _old_session_status THEN
      UPDATE public.package_sessions
      SET status = _new_status
      WHERE id = _pkg_session_id;

      INSERT INTO public.package_payment_audit (
        package_booking_id, package_session_id, booking_id, event_type,
        old_status, new_status, performed_by, note
      ) VALUES (
        _pkg_booking_id, _pkg_session_id, NEW.id, 'session_status_changed',
        _old_session_status, _new_status, 'System (package sync)',
        'Mirrored from booking status ' || OLD.status || ' -> ' || NEW.status
      );
    END IF;
  END IF;

  -- Recompute counts
  SELECT COUNT(*) FILTER (WHERE status = 'completed'),
         (SELECT sessions_total FROM public.package_bookings WHERE id = _pkg_booking_id)
    INTO _completed_count, _total
  FROM public.package_sessions
  WHERE package_booking_id = _pkg_booking_id;

  UPDATE public.package_bookings
  SET sessions_used = _completed_count,
      sessions_remaining = GREATEST(_total - _completed_count, 0),
      status = CASE
        WHEN status = 'cancelled' THEN status
        WHEN _completed_count >= _total THEN 'completed'
        ELSE 'active'
      END
  WHERE id = _pkg_booking_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pkg_session ON public.bookings;
CREATE TRIGGER trg_sync_pkg_session
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_package_session_from_booking();

-- ============================================================
-- 4) Backfill historical Completed/Cancelled bookings → sessions
-- ============================================================
WITH updates AS (
  UPDATE public.package_sessions ps
  SET status = CASE
    WHEN b.status = 'Completed' THEN 'completed'
    WHEN b.status = 'Cancelled' THEN 'cancelled'
    ELSE ps.status
  END
  FROM public.bookings b
  WHERE ps.booking_id = b.id
    AND b.status IN ('Completed','Cancelled')
    AND ps.status IS DISTINCT FROM (CASE WHEN b.status='Completed' THEN 'completed' ELSE 'cancelled' END)
  RETURNING ps.id AS session_id, ps.package_booking_id, ps.booking_id, ps.status AS new_status
)
INSERT INTO public.package_payment_audit (
  package_booking_id, package_session_id, booking_id, event_type,
  new_status, performed_by, note
)
SELECT package_booking_id, session_id, booking_id, 'session_status_changed',
       new_status, 'System (backfill)',
       'Historical sync — booking already in this status before trigger existed.'
FROM updates;

-- Recompute counts for every package_booking
UPDATE public.package_bookings pb
SET sessions_used = sub.completed,
    sessions_remaining = GREATEST(pb.sessions_total - sub.completed, 0),
    status = CASE
      WHEN pb.status = 'cancelled' THEN pb.status
      WHEN sub.completed >= pb.sessions_total THEN 'completed'
      ELSE 'active'
    END
FROM (
  SELECT package_booking_id, COUNT(*) FILTER (WHERE status='completed') AS completed
  FROM public.package_sessions
  GROUP BY package_booking_id
) sub
WHERE pb.id = sub.package_booking_id;

-- Backfill payment_matched audit entries for existing package_bookings with PI
INSERT INTO public.package_payment_audit (
  package_booking_id, stripe_payment_intent_id, amount,
  event_type, performed_by, note, created_at
)
SELECT pb.id, pb.stripe_payment_intent_id, pb.total_paid,
       'payment_matched', 'System (backfill)',
       'Backfilled — Stripe package payment recorded prior to audit log.',
       pb.created_at
FROM public.package_bookings pb
WHERE pb.stripe_payment_intent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.package_payment_audit a
    WHERE a.package_booking_id = pb.id AND a.event_type = 'payment_matched'
  );

-- ============================================================
-- 5) Realtime
-- ============================================================
ALTER TABLE public.package_payment_audit REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='package_payment_audit'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.package_payment_audit';
  END IF;
END $$;
