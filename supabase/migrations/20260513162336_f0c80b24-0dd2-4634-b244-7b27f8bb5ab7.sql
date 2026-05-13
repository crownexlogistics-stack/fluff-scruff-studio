
-- Settings (singleton)
CREATE TABLE public.ai_receptionist_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  greeting text NOT NULL DEFAULT 'Fluff and Scruff Studio, how can I help?',
  transfer_number text NOT NULL DEFAULT '+441708606655',
  email_summary_to text NOT NULL DEFAULT 'info@fluffandscruff.co.uk',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_receptionist_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT false,
  open_time text,
  close_time text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_receptionist_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE,
  caller_number text,
  caller_name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  outcome text CHECK (outcome IN ('booking_made','reschedule','cancellation','enquiry','transferred','voicemail','abandoned')),
  transcript jsonb DEFAULT '[]'::jsonb,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  summary text,
  transfer_attempted boolean NOT NULL DEFAULT false,
  transfer_successful boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_call_logs_started_at ON public.ai_call_logs(started_at DESC);
CREATE INDEX idx_ai_call_logs_outcome ON public.ai_call_logs(outcome);

-- updated_at trigger for settings
CREATE TRIGGER trg_ai_receptionist_settings_updated_at
BEFORE UPDATE ON public.ai_receptionist_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.ai_receptionist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_receptionist_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_receptionist_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

-- Director-only policies
CREATE POLICY "Directors manage ai settings" ON public.ai_receptionist_settings
  FOR ALL USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Directors manage ai hours" ON public.ai_receptionist_hours
  FOR ALL USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Directors manage ai knowledge" ON public.ai_receptionist_knowledge
  FOR ALL USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Directors view ai call logs" ON public.ai_call_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'director'));

CREATE POLICY "Directors modify ai call logs" ON public.ai_call_logs
  FOR ALL USING (public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'director'));

-- Seed settings (singleton)
INSERT INTO public.ai_receptionist_settings (is_active) VALUES (true);

-- Seed hours
INSERT INTO public.ai_receptionist_hours (day_of_week, is_open, open_time, close_time) VALUES
  (0, false, NULL, NULL),
  (1, false, NULL, NULL),
  (2, true, '10:00', '17:00'),
  (3, true, '10:00', '17:00'),
  (4, true, '10:00', '17:00'),
  (5, true, '10:00', '17:00'),
  (6, true, '10:00', '17:00');

-- Seed knowledge
INSERT INTO public.ai_receptionist_knowledge (category, question, answer) VALUES
  ('Location', 'Where are you located?', 'We are at 138 Hillview Avenue, Hornchurch, RM11 2DL. We have parking available outside.'),
  ('Location', 'How do I get there?', 'We are on Hillview Avenue in Hornchurch. The nearest train station is Emerson Park. There is free parking directly outside the salon.'),
  ('Policies', 'Do you require a deposit?', 'Yes, we require a 50% deposit to secure your booking. This can be paid online when you book through our website at fluffandscruff.co.uk'),
  ('Policies', 'What is your cancellation policy?', 'We ask for at least 48 hours notice for cancellations. Deposits may be forfeited for late cancellations.'),
  ('Services', 'Do you groom all breeds?', 'Yes, we groom all breeds and sizes. Prices vary depending on the breed and coat type.'),
  ('Policies', 'How long does a groom take?', 'A full groom typically takes 2 to 3 hours depending on the breed and coat condition. We will give you an estimated collection time when you drop off.');
