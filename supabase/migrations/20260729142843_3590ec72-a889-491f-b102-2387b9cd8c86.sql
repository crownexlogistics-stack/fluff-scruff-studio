ALTER TABLE public.groomer_payout_history
  ADD COLUMN IF NOT EXISTS payout_record_id uuid REFERENCES public.payout_records(id) ON DELETE CASCADE;

UPDATE public.groomer_payout_history h
SET payout_record_id = p.id
FROM public.payout_records p
WHERE h.payout_record_id IS NULL
  AND p.staff_id = h.groomer_id
  AND p.period_start = h.period_start
  AND p.period_end = h.period_end
  AND p.amount = h.payout_amount
  AND abs(extract(epoch from (p.created_at - h.paid_at))) < 300;

DROP POLICY IF EXISTS "Directors and managers can update groomer_payout_history" ON public.groomer_payout_history;
CREATE POLICY "Directors and managers can update groomer_payout_history"
ON public.groomer_payout_history FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors and managers can delete groomer_payout_history" ON public.groomer_payout_history;
CREATE POLICY "Directors and managers can delete groomer_payout_history"
ON public.groomer_payout_history FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groomer_payout_history TO authenticated;
GRANT ALL ON public.groomer_payout_history TO service_role;