
-- Enable realtime for sms_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;

-- Groomers can read SMS for their booked customers
CREATE POLICY "Groomers can read sms for their customers"
ON public.sms_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'groomer'::app_role)
  AND phone_number IN (
    SELECT DISTINCT b.customer_phone
    FROM public.bookings b
    JOIN public.staff s ON s.id = b.staff_id
    WHERE s.auth_user_id = auth.uid()
    AND b.customer_phone IS NOT NULL
  )
);

-- Groomers can insert SMS for their customers
CREATE POLICY "Groomers can insert sms for their customers"
ON public.sms_messages
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role)
  AND phone_number IN (
    SELECT DISTINCT b.customer_phone
    FROM public.bookings b
    JOIN public.staff s ON s.id = b.staff_id
    WHERE s.auth_user_id = auth.uid()
    AND b.customer_phone IS NOT NULL
  )
);
