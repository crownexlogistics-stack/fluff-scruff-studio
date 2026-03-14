
-- Add DELETE policy for email_unsubscribes so managers/directors can resubscribe customers
CREATE POLICY "Directors and managers can delete unsubscribes"
ON public.email_unsubscribes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Add SELECT policy for anon to check own unsubscribe status by email
CREATE POLICY "Anon can check own unsubscribe status"
ON public.email_unsubscribes
FOR SELECT
TO anon
USING (true);

-- Add DELETE policy for anon (resubscribe from public page)
CREATE POLICY "Anon can resubscribe"
ON public.email_unsubscribes
FOR DELETE
TO anon
USING (true);
