CREATE POLICY "Only directors can delete cases"
ON public.ai_inbox_cases
FOR DELETE
USING (has_role(auth.uid(), 'director'::app_role));