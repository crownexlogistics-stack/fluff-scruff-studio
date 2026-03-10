
-- Allow groomers to SELECT from migrated_customers (for customer search)
CREATE POLICY "Groomers can view migrated_customers for search"
ON public.migrated_customers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));

-- Allow groomers to SELECT from profiles (for customer profile pages)
CREATE POLICY "Groomers can view profiles for search"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));
