ALTER TABLE public.services ADD COLUMN IF NOT EXISTS fixed_price numeric;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS duration_minutes integer;