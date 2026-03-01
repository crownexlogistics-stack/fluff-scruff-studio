
-- Table to track sent booking emails (prevents duplicates)
CREATE TABLE public.booking_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'confirmation', 'reminder_24h', 'reminder_2h'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id TEXT,
  UNIQUE(booking_id, email_type)
);

ALTER TABLE public.booking_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and directors can manage booking_emails"
  ON public.booking_emails FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Service role can insert booking_emails"
  ON public.booking_emails FOR INSERT
  WITH CHECK (true);

-- Table to store inbound customer replies
CREATE TABLE public.customer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and directors can read all messages"
  ON public.customer_messages FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Managers and directors can update messages"
  ON public.customer_messages FOR UPDATE
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can read messages linked to their bookings"
  ON public.customer_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'groomer'::app_role) AND
    booking_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.staff s ON s.id = b.staff_id
      WHERE b.id = customer_messages.booking_id
      AND s.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert customer_messages"
  ON public.customer_messages FOR INSERT
  WITH CHECK (true);

-- Enable realtime for customer_messages so inbox updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_messages;

-- Enable pg_cron and pg_net extensions for scheduled reminders
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
