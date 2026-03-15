CREATE TABLE IF NOT EXISTS campaign_send_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can read campaign_send_log"
  ON campaign_send_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Service role can manage campaign_send_log"
  ON campaign_send_log FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_campaign_send_log_campaign_id ON campaign_send_log(campaign_id);
CREATE INDEX idx_campaign_send_log_status ON campaign_send_log(status);