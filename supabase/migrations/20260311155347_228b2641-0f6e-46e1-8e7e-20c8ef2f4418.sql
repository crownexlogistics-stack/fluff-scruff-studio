
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_anomaly boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS anomaly_type text DEFAULT null,
ADD COLUMN IF NOT EXISTS anomaly_reviewed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS anomaly_review_note text DEFAULT null;

CREATE TABLE IF NOT EXISTS public.groomer_payout_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  groomer_name text NOT NULL,
  groomer_id uuid REFERENCES public.staff(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_revenue numeric NOT NULL,
  commission_rate numeric NOT NULL,
  payout_amount numeric NOT NULL,
  paid_at timestamptz DEFAULT now(),
  paid_by text NOT NULL,
  payment_method text DEFAULT 'bank_transfer',
  notes text,
  anomaly_count integer DEFAULT 0,
  anomaly_shortfall numeric DEFAULT 0
);

ALTER TABLE public.groomer_payout_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can select groomer_payout_history"
ON public.groomer_payout_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Directors and managers can insert groomer_payout_history"
ON public.groomer_payout_history FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
