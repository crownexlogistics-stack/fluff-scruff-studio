ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS parent_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

INSERT INTO public.services (name, tagline, description, is_active, show_on_website, sort_order, is_group)
SELECT 'Grooming',
       'The ultimate pamper session — wash, dry, cut & style. Your pup leaves looking like a supermodel.',
       'Parent tile for the breed-priced Full Groom and Bath & Brush services.',
       false, true, 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Grooming');

UPDATE public.services SET is_group = true, is_active = false, show_on_website = true, sort_order = 0
WHERE name = 'Grooming';

UPDATE public.services c
SET parent_service_id = (SELECT id FROM public.services WHERE name = 'Grooming' LIMIT 1)
WHERE c.name IN ('Full Groom', 'Bath & Brush') AND c.parent_service_id IS NULL;