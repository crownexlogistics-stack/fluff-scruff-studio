-- Allow customers to delete their own pending bookings (cleanup on payment failure)
CREATE POLICY "Customers can delete own pending bookings"
ON public.bookings
FOR DELETE
USING (
  has_role(auth.uid(), 'customer'::app_role)
  AND customer_email = (auth.jwt() ->> 'email'::text)
  AND status = 'Pending'
);