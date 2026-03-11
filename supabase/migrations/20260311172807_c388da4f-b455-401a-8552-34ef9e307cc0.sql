
CREATE TABLE IF NOT EXISTS public.bank_balance_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  balance numeric NOT NULL,
  noted_by text NOT NULL,
  noted_at timestamptz DEFAULT now(),
  note text
);

CREATE TABLE IF NOT EXISTS public.monthly_commitments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  amount numeric NOT NULL,
  due_day integer NOT NULL DEFAULT 1,
  category text DEFAULT 'other',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors managers can manage bank_balance_snapshots"
ON public.bank_balance_snapshots FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Directors managers can manage monthly_commitments"
ON public.monthly_commitments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
