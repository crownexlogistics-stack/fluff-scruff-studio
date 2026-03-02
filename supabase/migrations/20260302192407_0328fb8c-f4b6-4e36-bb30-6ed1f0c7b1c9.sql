
-- Create customer_notes table for internal groomer/manager notes about customers
CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  note text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

-- Directors and managers can do everything
CREATE POLICY "Directors and managers can manage customer_notes"
ON public.customer_notes
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Groomers can read and insert notes
CREATE POLICY "Groomers can read customer_notes"
ON public.customer_notes
FOR SELECT
USING (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Groomers can insert customer_notes"
ON public.customer_notes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role) AND auth.uid() = created_by);
