
CREATE OR REPLACE FUNCTION public.enforce_package_online_staff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_source = 'package_online' AND NEW.staff_id IS NULL THEN
    RAISE EXCEPTION 'Package online bookings must have a staff_id assigned (booking_source=package_online)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_package_online_staff ON public.bookings;
CREATE TRIGGER trg_enforce_package_online_staff
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_package_online_staff();
