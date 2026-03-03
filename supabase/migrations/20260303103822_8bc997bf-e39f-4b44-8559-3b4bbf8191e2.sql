-- Add open/click tracking columns to email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS opens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_opens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_clicks integer NOT NULL DEFAULT 0;

-- Create table to store individual SendGrid events for deduplication
CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  event_type text NOT NULL,
  sg_event_id text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sg_event_id)
);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Managers/directors can read events
CREATE POLICY "Directors and managers can read email_events"
  ON public.email_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Service role inserts (from edge function)
CREATE POLICY "Service role can insert email_events"
  ON public.email_events FOR INSERT
  WITH CHECK (true);