CREATE TABLE public.reconciliation_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by text DEFAULT 'Sevak',
  filename text,
  total_transactions integer,
  matched_count integer,
  unmatched_count integer,
  void_count integer,
  raw_csv text
);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage reconciliation_runs"
ON public.reconciliation_runs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));