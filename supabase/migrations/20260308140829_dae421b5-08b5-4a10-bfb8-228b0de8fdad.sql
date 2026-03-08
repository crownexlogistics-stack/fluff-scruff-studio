
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  expense_type TEXT NOT NULL DEFAULT 'one_off',
  frequency TEXT DEFAULT NULL,
  expense_date DATE DEFAULT NULL,
  recurring_start_date DATE DEFAULT NULL,
  recurring_end_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage expenses"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
