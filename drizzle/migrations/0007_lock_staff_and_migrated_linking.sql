DROP POLICY IF EXISTS "Anyone can read staff" ON public.staff;
REVOKE SELECT ON public.staff FROM anon;
CREATE POLICY "Staff team can read staff" ON public.staff FOR SELECT TO authenticated
USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(),'groomer') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'volunteer') OR public.has_role(auth.uid(),'work_placement'));

CREATE OR REPLACE VIEW public.staff_public AS
SELECT id, name, role, description, booking_priority, is_accepting_bookings, employment_end_date, account_blocked, block_new_bookings
FROM public.staff;
GRANT SELECT ON public.staff_public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_staff_for_signing(_id uuid)
RETURNS TABLE(id uuid, name text, role text, is_self_employed boolean, start_date date, contract_status text, signed_at timestamptz, hs_status text, hs_signed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT s.id,s.name,s.role::text,s.is_self_employed,s.start_date::date,s.contract_status::text,s.signed_at::timestamptz,s.hs_status::text,s.hs_signed_at::timestamptz FROM public.staff s WHERE s.id=_id $$;
GRANT EXECUTE ON FUNCTION public.get_staff_for_signing(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_merge_migrated_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  -- Linking now requires proof of email ownership via claim_migrated_customer()
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_migrated_customer()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _email text := lower(auth.jwt()->>'email'); _ok boolean; _n integer;
BEGIN
  IF auth.uid() IS NULL OR _email IS NULL THEN RETURN 0; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
    WHERE a->>'method' IN ('recovery','otp','magiclink','invite')) INTO _ok;
  IF NOT _ok THEN RAISE EXCEPTION 'Please open the set-up link we emailed you'; END IF;
  UPDATE public.migrated_customers SET status='activated', activated_at=now(), supabase_user_id=auth.uid()
  WHERE lower(email)=_email AND (supabase_user_id IS NULL OR supabase_user_id=auth.uid() OR status<>'activated');
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_migrated_customer() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_migrated_customer() TO authenticated;