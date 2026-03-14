
CREATE OR REPLACE FUNCTION public.groomer_can_access_customer(_customer_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.bookings b ON b.staff_id = s.id
    JOIN auth.users u ON u.id = _customer_user_id
    WHERE s.auth_user_id = auth.uid()
      AND b.customer_email IS NOT NULL
      AND lower(b.customer_email) = lower(u.email)
      AND b.status IN ('Pending', 'Confirmed', 'Completed')
      AND b.booking_date >= (CURRENT_DATE - INTERVAL '7 days')
  );
$$;
