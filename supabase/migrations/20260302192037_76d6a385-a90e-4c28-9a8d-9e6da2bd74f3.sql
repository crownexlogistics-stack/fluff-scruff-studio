
-- Drop the broken customer SELECT policy that references auth.users
DROP POLICY "Customers can view own bookings by email" ON public.bookings;

-- Recreate it using auth.jwt() instead of querying auth.users table
CREATE POLICY "Customers can view own bookings by email"
ON public.bookings
FOR SELECT
USING (
  has_role(auth.uid(), 'customer'::app_role)
  AND customer_email = (auth.jwt() ->> 'email')
);
