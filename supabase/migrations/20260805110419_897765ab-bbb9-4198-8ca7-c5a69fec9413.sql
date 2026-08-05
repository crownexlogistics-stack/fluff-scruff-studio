CREATE OR REPLACE FUNCTION public.sync_package_payment_to_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _price numeric := COALESCE(NEW.total_paid, 0);
  _received numeric := COALESCE(NEW.amount_received, 0);
  _ratio numeric;
  _updated int := 0;
  _rec record;
  _new_dep numeric;
BEGIN
  IF _price <= 0 THEN
    _ratio := 0;
  ELSE
    _ratio := LEAST(_received / _price, 1);
  END IF;

  FOR _rec IN
    SELECT b.id, b.total_price, b.deposit_paid
    FROM public.package_sessions ps
    JOIN public.bookings b ON b.id = ps.booking_id
    WHERE ps.package_booking_id = NEW.id
      AND b.status NOT IN ('Cancelled', 'No Show', 'Refunded')
  LOOP
    _new_dep := ROUND(LEAST(COALESCE(_rec.total_price, 0) * _ratio, COALESCE(_rec.total_price, 0)), 2);
    IF _new_dep IS DISTINCT FROM COALESCE(_rec.deposit_paid, 0) THEN
      UPDATE public.bookings SET deposit_paid = _new_dep WHERE id = _rec.id;
      _updated := _updated + 1;
    END IF;
  END LOOP;

  IF _updated > 0 THEN
    INSERT INTO public.package_payment_audit (
      package_booking_id, event_type, amount, performed_by, note
    ) VALUES (
      NEW.id, 'sessions_payment_synced', _received, 'System (package payment sync)',
      _updated || ' session appointment(s) updated to reflect £' || _received::text || ' received of £' || _price::text || '.'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_package_payment_to_bookings ON public.package_bookings;

CREATE TRIGGER trg_sync_package_payment_to_bookings
AFTER UPDATE OF amount_received, total_paid, payment_method ON public.package_bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_package_payment_to_bookings();