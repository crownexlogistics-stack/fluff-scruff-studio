
-- Table to store all communications (messages and emails) sent to/from customers
CREATE TABLE public.customer_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  type text NOT NULL DEFAULT 'message', -- 'message' or 'email'
  subject text,
  body text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound', -- 'outbound' or 'inbound'
  sent_by uuid, -- staff user who sent it
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_communications ENABLE ROW LEVEL SECURITY;

-- Directors and managers can do everything
CREATE POLICY "Directors and managers can manage communications"
ON public.customer_communications
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Groomers can insert and read
CREATE POLICY "Groomers can read communications"
ON public.customer_communications
FOR SELECT
USING (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Groomers can insert communications"
ON public.customer_communications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role) AND auth.uid() = sent_by);

-- Index for fast lookups
CREATE INDEX idx_customer_communications_email ON public.customer_communications(customer_email);
