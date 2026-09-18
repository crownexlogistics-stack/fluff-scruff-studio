CREATE OR REPLACE FUNCTION public.normalise_phone(_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  p text;
BEGIN
  IF _phone IS NULL THEN RETURN NULL; END IF;
  p := regexp_replace(_phone, '[^0-9+]', '', 'g');
  IF p = '' THEN RETURN NULL; END IF;
  IF p LIKE '+440%' THEN p := '+44' || substring(p from 5); END IF;
  IF p LIKE '0044%' THEN p := '+44' || substring(p from 5); END IF;
  IF p LIKE '44%' AND p NOT LIKE '+%' THEN p := '+' || p; END IF;
  IF p LIKE '0%' THEN p := '+44' || substring(p from 2); END IF;
  IF p ~ '^7[0-9]{9}$' THEN p := '+44' || p; END IF;
  RETURN p;
END;
$$;

CREATE TABLE public.customer_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  email text,
  phone_raw text,
  phone_normalised text,
  reason text NOT NULL,
  blacklisted_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  blacklisted_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  removed_reason text,
  removed_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  removed_by_name text,
  removed_at timestamptz,
  CONSTRAINT customer_blacklist_status_check CHECK (status IN ('active','removed')),
  CONSTRAINT customer_blacklist_identifier_check CHECK (email IS NOT NULL OR phone_normalised IS NOT NULL)
);

CREATE UNIQUE INDEX customer_blacklist_active_email_idx ON public.customer_blacklist (lower(email)) WHERE status = 'active' AND email IS NOT NULL;
CREATE UNIQUE INDEX customer_blacklist_active_phone_idx ON public.customer_blacklist (phone_normalised) WHERE status = 'active' AND phone_normalised IS NOT NULL;
CREATE INDEX customer_blacklist_status_idx ON public.customer_blacklist (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.customer_blacklist TO authenticated;
GRANT ALL ON public.customer_blacklist TO service_role;

ALTER TABLE public.customer_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view blacklist"
ON public.customer_blacklist FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
);

CREATE POLICY "Staff can add to blacklist"
ON public.customer_blacklist FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'groomer') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
);

CREATE POLICY "Staff can update blacklist"
ON public.customer_blacklist FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
)
WITH CHECK (
  public.has_role(auth.uid(), 'groomer') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
);

CREATE TABLE public.blacklist_block_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blacklist_id uuid REFERENCES public.customer_blacklist(id) ON DELETE SET NULL,
  matched_on text NOT NULL,
  matched_value text,
  channel text NOT NULL,
  attempted_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blacklist_block_events_blacklist_idx ON public.blacklist_block_events (blacklist_id, created_at DESC);

GRANT SELECT ON public.blacklist_block_events TO authenticated;
GRANT ALL ON public.blacklist_block_events TO service_role;

ALTER TABLE public.blacklist_block_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view block events"
ON public.blacklist_block_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
);