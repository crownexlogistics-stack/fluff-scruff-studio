-- Resolve customer identity IDs for auth + migrated records
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT COALESCE(
    (
      SELECT u.id
      FROM auth.users u
      WHERE lower(u.email) = lower(_email)
      LIMIT 1
    ),
    (
      SELECT mc.supabase_user_id
      FROM public.migrated_customers mc
      WHERE lower(mc.email) = lower(_email)
        AND mc.supabase_user_id IS NOT NULL
      ORDER BY mc.created_at DESC
      LIMIT 1
    ),
    (
      SELECT mc.id
      FROM public.migrated_customers mc
      WHERE lower(mc.email) = lower(_email)
      ORDER BY mc.created_at DESC
      LIMIT 1
    )
  );
$function$;

-- Allow groomer access checks to work with both auth IDs and migrated customer IDs
CREATE OR REPLACE FUNCTION public.groomer_can_access_customer(_customer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  WITH target_emails AS (
    SELECT lower(u.email) AS email
    FROM auth.users u
    WHERE u.id = _customer_user_id
      AND u.email IS NOT NULL

    UNION

    SELECT lower(mc.email) AS email
    FROM public.migrated_customers mc
    WHERE mc.id = _customer_user_id
      AND mc.email IS NOT NULL

    UNION

    SELECT lower(mc.email) AS email
    FROM public.migrated_customers mc
    WHERE mc.supabase_user_id = _customer_user_id
      AND mc.email IS NOT NULL
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.bookings b ON b.staff_id = s.id
    JOIN target_emails te ON lower(b.customer_email) = te.email
    WHERE s.auth_user_id = auth.uid()
      AND b.status IN ('Pending', 'Confirmed', 'Completed')
  )
  OR EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.migrated_bookings mb ON lower(btrim(mb.staff_name)) = lower(btrim(s.name))
    JOIN public.migrated_customers mc ON mc.id = mb.migrated_customer_id
    JOIN target_emails te ON lower(mc.email) = te.email
    WHERE s.auth_user_id = auth.uid()
  );
$function$;

-- Let groomers create lightweight migrated-customer records for non-auth customers
CREATE POLICY "Groomers can insert migrated_customers for linking"
ON public.migrated_customers
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));