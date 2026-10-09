CREATE OR REPLACE FUNCTION public.coupon_customer_use_count(_coupon_id uuid, _email text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int
  FROM public.coupon_usages cu
  LEFT JOIN public.bookings b ON b.id = cu.booking_id
  WHERE cu.coupon_id = _coupon_id
    AND lower(trim(cu.customer_email)) = lower(trim(_email))
    AND (b.id IS NULL OR b.status NOT IN ('Cancelled','Refunded'));
$$;
GRANT EXECUTE ON FUNCTION public.coupon_customer_use_count(uuid, text) TO anon, authenticated;