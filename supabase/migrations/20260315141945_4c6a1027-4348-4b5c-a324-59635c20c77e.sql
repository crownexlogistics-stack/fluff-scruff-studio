
-- Add tracking columns to bulk_sms_log
ALTER TABLE public.bulk_sms_log 
  ADD COLUMN IF NOT EXISTS twilio_message_sid text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text;

-- Create sms_link_clicks table
CREATE TABLE public.sms_link_clicks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name text,
  phone_hash text,
  destination_url text,
  clicked_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can read sms_link_clicks"
ON public.sms_link_clicks
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Anyone can insert sms_link_clicks"
ON public.sms_link_clicks
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Authenticated can insert sms_link_clicks"
ON public.sms_link_clicks
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add sms_unreachable to migrated_customers
ALTER TABLE public.migrated_customers
  ADD COLUMN IF NOT EXISTS sms_unreachable boolean DEFAULT false;
