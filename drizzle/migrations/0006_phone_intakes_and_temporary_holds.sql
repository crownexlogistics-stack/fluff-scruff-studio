CREATE TABLE public.phone_intakes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL, created_by_name text NOT NULL,
 phone text NOT NULL, status text NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting','submitted','booked','closed')),
 first_name text, surname text, email text, dog_name text, breed text, notes text, alternatives text,
 attachments jsonb NOT NULL DEFAULT '[]', upload_paths text[] NOT NULL DEFAULT '{}', submitted_at timestamptz,
 slot_date date, slot_time time, staff_id uuid REFERENCES public.staff(id), service_id uuid REFERENCES public.services(id),
 duration_minutes integer NOT NULL DEFAULT 90 CHECK (duration_minutes BETWEEN 15 AND 480),
 hold_expires_at timestamptz, hold_released_at timestamptz, booking_id uuid REFERENCES public.bookings(id)
);
GRANT SELECT ON public.phone_intakes TO authenticated;
GRANT ALL ON public.phone_intakes TO service_role;
ALTER TABLE public.phone_intakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own intakes management reads all" ON public.phone_intakes FOR SELECT TO authenticated USING ((created_by=auth.uid() AND public.has_role(auth.uid(),'groomer')) OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director'));
CREATE INDEX phone_intakes_hold_lookup ON public.phone_intakes(staff_id,slot_date,hold_expires_at);
ALTER TABLE public.bookings ADD COLUMN phone_intake_id uuid REFERENCES public.phone_intakes(id);
CREATE UNIQUE INDEX bookings_phone_intake_unique ON public.bookings(phone_intake_id) WHERE phone_intake_id IS NOT NULL;

CREATE FUNCTION public.phone_intake_slot_busy(_staff uuid,_date date,_time time,_duration integer,_exclude uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.phone_intakes i WHERE i.staff_id=_staff AND i.slot_date=_date AND i.id IS DISTINCT FROM _exclude AND i.hold_expires_at>now() AND i.hold_released_at IS NULL AND i.status IN ('awaiting','submitted') AND _time<i.slot_time+make_interval(mins=>i.duration_minutes) AND _time+make_interval(mins=>_duration)>i.slot_time)
 OR EXISTS(SELECT 1 FROM public.bookings b LEFT JOIN public.services s ON s.id=b.service_id LEFT JOIN public.breeds br ON br.id=b.breed_id WHERE b.staff_id=_staff AND b.booking_date=_date AND b.status NOT IN ('Cancelled','No Show','Refunded') AND _time<b.booking_time+make_interval(mins=>coalesce(b.duration_minutes,s.duration_minutes,br.duration_minutes,90)) AND _time+make_interval(mins=>_duration)>b.booking_time)
 OR EXISTS(SELECT 1 FROM public.migrated_bookings m JOIN public.staff s ON s.id=_staff WHERE m.booking_date=_date AND m.is_future_booking AND m.booking_time IS NOT NULL AND coalesce(m.payment_status,'') NOT IN ('Cancelled','No Show','Refunded') AND (lower(m.staff_name)=lower(s.name) OR lower(m.staff_name) LIKE lower(split_part(s.name,' ',1))||'%') AND _time<m.booking_time::time+make_interval(mins=>coalesce(m.duration_minutes,90)) AND _time+make_interval(mins=>_duration)>m.booking_time::time);
$$;
REVOKE ALL ON FUNCTION public.phone_intake_slot_busy(uuid,date,time,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phone_intake_slot_busy(uuid,date,time,integer,uuid) TO service_role;

CREATE FUNCTION public.create_phone_intake(_phone text,_date date DEFAULT NULL,_time time DEFAULT NULL,_staff uuid DEFAULT NULL,_service uuid DEFAULT NULL,_duration integer DEFAULT 90,_hold boolean DEFAULT false) RETURNS public.phone_intakes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.phone_intakes; who text;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'groomer') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director')) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 IF _phone !~ '^(07[0-9]{9}|\+447[0-9]{9})$' THEN RAISE EXCEPTION 'Enter a valid UK mobile number'; END IF;
 IF public.has_role(auth.uid(),'groomer') AND NOT (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director')) AND _staff IS NOT NULL AND _staff IS DISTINCT FROM public.current_staff_id() THEN RAISE EXCEPTION 'Please select yourself'; END IF;
 IF _duration NOT BETWEEN 15 AND 480 THEN RAISE EXCEPTION 'Invalid appointment length'; END IF;
 IF (_date IS NULL) <> (_time IS NULL) OR (_date IS NOT NULL AND _staff IS NULL) THEN RAISE EXCEPTION 'Select date, time and groomer together'; END IF;
 IF _date IS NOT NULL AND ((_date+_time) AT TIME ZONE 'Europe/London')<=now() THEN RAISE EXCEPTION 'Please choose a future time'; END IF;
 IF _hold AND _date IS NULL THEN RAISE EXCEPTION 'Select a slot to hold'; END IF;
 IF _hold THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(_staff::text||_date::text,0));
  IF public.phone_intake_slot_busy(_staff,_date,_time,_duration) THEN RAISE EXCEPTION 'This slot has already been taken. Choose another time or send a details-only link.'; END IF;
 END IF;
 SELECT coalesce(s.name,p.full_name,'Staff') INTO who FROM public.profiles p LEFT JOIN public.staff s ON s.auth_user_id=p.id WHERE p.id=auth.uid();
 INSERT INTO public.phone_intakes(created_by,created_by_name,phone,slot_date,slot_time,staff_id,service_id,duration_minutes,hold_expires_at)
 VALUES(auth.uid(),coalesce(who,'Staff'),_phone,_date,_time,_staff,_service,_duration,CASE WHEN _hold THEN now()+interval '60 minutes' END) RETURNING * INTO r;
 RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.create_phone_intake(text,date,time,uuid,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_phone_intake(text,date,time,uuid,uuid,integer,boolean) TO authenticated;

CREATE FUNCTION public.close_phone_intake(_id uuid,_close boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.phone_intakes SET hold_released_at=now(),status=CASE WHEN _close THEN 'closed' ELSE status END WHERE id=_id AND status IN ('awaiting','submitted') AND ((created_by=auth.uid() AND public.has_role(auth.uid(),'groomer')) OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director'));
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not available'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.close_phone_intake(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_phone_intake(uuid,boolean) TO authenticated;

CREATE FUNCTION public.submit_phone_intake(_token text,_details jsonb,_attachments jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.phone_intakes;
BEGIN
 SELECT * INTO r FROM public.phone_intakes WHERE token=_token FOR UPDATE;
 IF NOT FOUND OR r.status<>'awaiting' THEN RAISE EXCEPTION 'This link is no longer accepting details'; END IF;
 IF jsonb_array_length(_attachments)>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(_attachments) a WHERE NOT (a->>'path'=ANY(r.upload_paths))) THEN RAISE EXCEPTION 'Invalid photos'; END IF;
 UPDATE public.phone_intakes SET first_name=_details->>'first_name',surname=_details->>'surname',email=_details->>'email',dog_name=_details->>'dog_name',breed=_details->>'breed',notes=_details->>'notes',alternatives=_details->>'alternatives',attachments=_attachments,submitted_at=now(),status='submitted',hold_released_at=CASE WHEN coalesce(_details->>'alternatives','')<>'' THEN now() ELSE hold_released_at END WHERE id=r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_phone_intake(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_phone_intake(text,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.guard_phone_intake_holds() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.phone_intakes; dur integer;
BEGIN
 IF NEW.staff_id IS NULL OR NEW.status IN ('Cancelled','No Show','Refunded') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.staff_id,NEW.booking_date,NEW.booking_time,NEW.duration_minutes,NEW.status,NEW.phone_intake_id) IS NOT DISTINCT FROM (OLD.staff_id,OLD.booking_date,OLD.booking_time,OLD.duration_minutes,OLD.status,OLD.phone_intake_id) THEN RETURN NEW; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.staff_id::text||NEW.booking_date::text,0));
 SELECT coalesce(NEW.duration_minutes,s.duration_minutes,b.duration_minutes,90) INTO dur FROM (SELECT 1) x LEFT JOIN public.services s ON s.id=NEW.service_id LEFT JOIN public.breeds b ON b.id=NEW.breed_id;
 IF NEW.phone_intake_id IS NOT NULL AND TG_OP='INSERT' THEN
  SELECT * INTO i FROM public.phone_intakes WHERE id=NEW.phone_intake_id FOR UPDATE;
  IF NOT FOUND OR i.status<>'submitted' OR NOT ((i.created_by=auth.uid() AND public.has_role(auth.uid(),'groomer')) OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director')) THEN RAISE EXCEPTION 'This enquiry cannot be booked by this account'; END IF;
  IF public.has_role(auth.uid(),'groomer') AND NOT (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director')) AND NEW.staff_id IS DISTINCT FROM public.current_staff_id() THEN RAISE EXCEPTION 'Please assign this booking to yourself'; END IF;
  IF public.phone_intake_slot_busy(NEW.staff_id,NEW.booking_date,NEW.booking_time,dur,i.id) THEN RAISE EXCEPTION 'This appointment is no longer available. Agree another time.'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.phone_intakes h WHERE h.staff_id=NEW.staff_id AND h.slot_date=NEW.booking_date AND h.id IS DISTINCT FROM NEW.phone_intake_id AND h.status IN ('awaiting','submitted') AND h.hold_released_at IS NULL AND h.hold_expires_at>now() AND NEW.booking_time<h.slot_time+make_interval(mins=>h.duration_minutes) AND NEW.booking_time+make_interval(mins=>dur)>h.slot_time) THEN RAISE EXCEPTION 'This time is temporarily held for a phone enquiry. Please choose another time.'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_phone_intake_holds BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_phone_intake_holds();
CREATE FUNCTION public.mark_phone_intake_booked() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.phone_intake_id IS NOT NULL THEN UPDATE public.phone_intakes SET status='booked',booking_id=NEW.id,hold_released_at=now() WHERE id=NEW.phone_intake_id; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER mark_phone_intake_booked AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.mark_phone_intake_booked();
CREATE FUNCTION public.active_phone_intake_holds(_from date,_to date) RETURNS TABLE(id uuid,staff_id uuid,booking_date date,booking_time time,duration_minutes integer,expires_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.id,i.staff_id,i.slot_date,i.slot_time,i.duration_minutes,i.hold_expires_at FROM public.phone_intakes i WHERE (public.has_role(auth.uid(),'groomer') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director')) AND i.slot_date BETWEEN _from AND _to AND i.hold_expires_at>now() AND i.hold_released_at IS NULL AND i.status IN ('awaiting','submitted');
$$;
REVOKE ALL ON FUNCTION public.active_phone_intake_holds(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.active_phone_intake_holds(date,date) TO authenticated;
CREATE POLICY "Phone intake staff photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='phone-intakes' AND EXISTS(SELECT 1 FROM public.phone_intakes i WHERE i.id::text=(storage.foldername(name))[1] AND ((i.created_by=auth.uid() AND public.has_role(auth.uid(),'groomer')) OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director'))));