
-- =========================================================
-- Part C: reinstate the "dave" booking wrongly auto-cancelled
-- =========================================================
UPDATE public.bookings
SET status = 'Pending'
WHERE id = '4f89c3f6-f329-4414-b1a4-d03fa70065ce'
  AND status = 'Cancelled';

INSERT INTO public.booking_audit_log (booking_id, event_type, performed_by, note)
VALUES (
  '4f89c3f6-f329-4414-b1a4-d03fa70065ce',
  'reinstated',
  'System (maintenance)',
  'Reinstated by maintenance — wrongly auto-cancelled by Stripe webhook expired-checkout branch (which did not guard on booking_source or created_at). Please verify with the customer and confirm or rebook as needed.'
);

-- =========================================================
-- Part D: trigger to keep package_sessions + package_bookings
-- in sync with their underlying bookings
-- =========================================================
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
  _old_time time without time zone;
  _new_status text;
  _completed_count int;
  _total int;
BEGIN
  -- Find the package_session this booking belongs to (if any)
  SELECT id, package_booking_id, scheduled_date, scheduled_time
    INTO _pkg_session_id, _pkg_booking_id, _old_date, _old_time
  FROM public.package_sessions
  WHERE booking_id = NEW.id
  LIMIT 1;

  IF _pkg_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Status mirror
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _new_status := CASE
      WHEN NEW.status = 'Completed' THEN 'completed'
      WHEN NEW.status = 'Cancelled' THEN 'cancelled'
      WHEN NEW.status = 'Pending' OR NEW.status = 'Confirmed' THEN 'scheduled'
      ELSE NULL
    END;

    IF _new_status IS NOT NULL THEN
      UPDATE public.package_sessions
      SET status = _new_status
      WHERE id = _pkg_session_id;
    END IF;
  END IF;

  -- 2) Reschedule mirror (date or time changed)
  IF NEW.booking_date IS DISTINCT FROM OLD.booking_date
     OR NEW.booking_time IS DISTINCT FROM OLD.booking_time THEN
    UPDATE public.package_sessions
    SET scheduled_date = NEW.booking_date,
        scheduled_time = NEW.booking_time
    WHERE id = _pkg_session_id;

    INSERT INTO public.booking_audit_log (booking_id, event_type, performed_by, note, old_date, old_time, new_date, new_time)
    VALUES (
      NEW.id,
      'package_session_rescheduled',
      'System (package sync)',
      'Package session schedule updated to match booking.',
      _old_date, _old_time, NEW.booking_date, NEW.booking_time
    );
  END IF;

  -- 3) Recompute parent package_bookings counts
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

DROP TRIGGER IF EXISTS trg_sync_package_session_from_booking ON public.bookings;
CREATE TRIGGER trg_sync_package_session_from_booking
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_package_session_from_booking();

-- =========================================================
-- Realtime: surface package changes to staff dashboards
-- =========================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.package_bookings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.package_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
