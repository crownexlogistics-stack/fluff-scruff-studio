
-- A/B Testing columns on email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS variant_b_subject text,
  ADD COLUMN IF NOT EXISTS ab_test_percentage integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ab_winner text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variant_a_opens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variant_b_opens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variant_a_sent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variant_b_sent integer DEFAULT 0;

-- Automation rules table
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL, -- 'win_back', 'welcome_series', 're_engagement'
  trigger_config jsonb NOT NULL DEFAULT '{}',
  email_subject text NOT NULL,
  email_html text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage automation_rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Automation sends log (prevent duplicate sends)
CREATE TABLE public.automation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE NOT NULL,
  customer_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, customer_email)
);

ALTER TABLE public.automation_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage automation_sends"
  ON public.automation_sends FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Service role can insert automation_sends"
  ON public.automation_sends FOR INSERT
  WITH CHECK (true);

-- SMS log table
CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  body text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'sent',
  twilio_sid text,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage sms_messages"
  ON public.sms_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Service role can insert sms_messages"
  ON public.sms_messages FOR INSERT
  WITH CHECK (true);
