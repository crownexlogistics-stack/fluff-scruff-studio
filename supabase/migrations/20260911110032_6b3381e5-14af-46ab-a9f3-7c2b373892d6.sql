ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS show_on_website boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

GRANT SELECT ON public.staff_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_services TO authenticated;
GRANT ALL ON public.staff_services TO service_role;

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Full Groom / Bath & Brush are shown inside the Grooming tile, not separately
UPDATE public.services SET show_on_website = false WHERE name IN ('Full Groom', 'Bath & Brush', 'Hand Strip');

UPDATE public.services SET sort_order = 10, tagline = 'A gentle, fun first grooming experience. We go at their pace with loads of treats & cuddles.' WHERE name = 'Puppy Special';
UPDATE public.services SET sort_order = 20, tagline = 'Quick, painless trim so those tippy-taps stay happy and healthy.' WHERE name = 'Nail Trim & Filing';
UPDATE public.services SET sort_order = 30, tagline = 'Fresh gums and pearly whites for your best friend. Say goodbye to bad breath.' WHERE name = 'Ultrasonic Teeth Cleaning';