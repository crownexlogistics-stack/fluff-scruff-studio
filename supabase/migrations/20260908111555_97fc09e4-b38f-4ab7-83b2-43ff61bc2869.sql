ALTER TABLE public.customer_pets
  ADD COLUMN IF NOT EXISTS migrated_customer_id uuid REFERENCES public.migrated_customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_pets ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.customer_pets
  ADD CONSTRAINT customer_pets_owner_exactly_one
  CHECK (num_nonnulls(user_id, migrated_customer_id) = 1);

CREATE INDEX IF NOT EXISTS customer_pets_migrated_customer_id_idx
  ON public.customer_pets(migrated_customer_id);

CREATE POLICY "Staff can read migrated customer pets"
ON public.customer_pets FOR SELECT TO authenticated
USING (
  migrated_customer_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'groomer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'director')
  )
);

CREATE POLICY "Staff can insert migrated customer pets"
ON public.customer_pets FOR INSERT TO authenticated
WITH CHECK (
  migrated_customer_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'groomer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'director')
  )
);

CREATE POLICY "Staff can update migrated customer pets"
ON public.customer_pets FOR UPDATE TO authenticated
USING (
  migrated_customer_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'groomer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'director')
  )
)
WITH CHECK (
  migrated_customer_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'groomer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'director')
  )
);

CREATE POLICY "Staff can delete migrated customer pets"
ON public.customer_pets FOR DELETE TO authenticated
USING (
  migrated_customer_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'groomer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'director')
  )
);