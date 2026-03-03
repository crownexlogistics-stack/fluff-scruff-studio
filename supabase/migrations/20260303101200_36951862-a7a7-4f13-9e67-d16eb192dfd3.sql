
-- Add campaign_id to bookings for direct UTM attribution
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL;

-- Create campaign_attributions table for both direct and time-window attribution
CREATE TABLE public.campaign_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  attribution_type text NOT NULL DEFAULT 'direct', -- 'direct' (UTM) or 'time_window' (7-day)
  revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, booking_id)
);

ALTER TABLE public.campaign_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage campaign_attributions"
  ON public.campaign_attributions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Allow service role inserts (for edge function attribution)
CREATE POLICY "Service role can insert campaign_attributions"
  ON public.campaign_attributions FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read (for dashboard)
CREATE POLICY "Managers can read campaign_attributions"
  ON public.campaign_attributions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
