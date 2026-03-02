
-- Join table: which add-ons apply to which services
CREATE TABLE public.add_on_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  add_on_id uuid NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (add_on_id, service_id)
);

ALTER TABLE public.add_on_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read add_on_services"
  ON public.add_on_services FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage add_on_services"
  ON public.add_on_services FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Seed: link all existing add-ons to Full Groom and Bath & Brush
INSERT INTO public.add_on_services (add_on_id, service_id)
SELECT a.id, s.id
FROM public.add_ons a
CROSS JOIN public.services s
WHERE s.name IN ('Full Groom', 'Bath & Brush');
