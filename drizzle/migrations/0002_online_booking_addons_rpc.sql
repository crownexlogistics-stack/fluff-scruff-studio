CREATE OR REPLACE FUNCTION public.attach_online_booking_addons(_booking_id uuid, _addon_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ok boolean;
  _n integer := 0;
  _names text;
BEGIN
  IF _addon_ids IS NULL OR array_length(_addon_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = _booking_id
      AND booking_source = 'online'
      AND created_at > now() - interval '30 minutes'
  ) AND NOT EXISTS (SELECT 1 FROM public.booking_addons WHERE booking_id = _booking_id)
  INTO _ok;
  IF NOT _ok THEN
    RETURN 0;
  END IF;

  INSERT INTO public.booking_addons (booking_id, addon_id, added_by_staff)
  SELECT _booking_id, a.id, false
  FROM public.add_ons a
  WHERE a.id = ANY(_addon_ids) AND a.is_active = true;
  GET DIAGNOSTICS _n = ROW_COUNT;

  IF _n > 0 THEN
    SELECT string_agg(a.name, ', ') INTO _names FROM public.add_ons a WHERE a.id = ANY(_addon_ids) AND a.is_active = true;
    INSERT INTO public.booking_audit_log (booking_id, event_type, performed_by, note)
    VALUES (_booking_id, 'addons_added', 'Customer (online)', 'Extras chosen online: ' || _names);
  END IF;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_online_booking_addons(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.attach_online_booking_addons(uuid, uuid[]) TO anon, authenticated, service_role;