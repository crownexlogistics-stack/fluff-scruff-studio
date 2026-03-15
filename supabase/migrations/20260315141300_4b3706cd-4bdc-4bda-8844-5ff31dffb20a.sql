
CREATE TABLE public.bulk_sms_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name text,
  message text NOT NULL,
  phone text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.bulk_sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage bulk_sms_log"
ON public.bulk_sms_log
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Service role can insert bulk_sms_log"
ON public.bulk_sms_log
FOR INSERT
TO public
WITH CHECK (true);
