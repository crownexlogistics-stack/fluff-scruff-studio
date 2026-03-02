
-- Commission records: locked at checkout time
CREATE TABLE public.commission_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  total_price NUMERIC NOT NULL DEFAULT 0,
  deposit_paid NUMERIC NOT NULL DEFAULT 0,
  final_charge NUMERIC,
  commission_type TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'own_customer', 'no_show'
  commission_rate NUMERIC NOT NULL DEFAULT 0.4,
  groomer_pay NUMERIC NOT NULL DEFAULT 0,
  studio_share NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payout records: track actual payments to groomers
CREATE TABLE public.payout_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- 'bank_transfer', 'cash'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  notes TEXT,
  processed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;

-- Commission records policies
CREATE POLICY "Directors and managers can read commission_records"
ON public.commission_records FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Directors and managers can insert commission_records"
ON public.commission_records FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can read own commission_records"
ON public.commission_records FOR SELECT
USING (has_role(auth.uid(), 'groomer'::app_role) AND staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid()));

-- Payout records policies
CREATE POLICY "Directors and managers can manage payout_records"
ON public.payout_records FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can read own payout_records"
ON public.payout_records FOR SELECT
USING (has_role(auth.uid(), 'groomer'::app_role) AND staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid()));
