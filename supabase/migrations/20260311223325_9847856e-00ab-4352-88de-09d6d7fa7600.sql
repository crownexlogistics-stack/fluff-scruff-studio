
ALTER TABLE public.academy_applications
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS timing_preference text,
  ADD COLUMN IF NOT EXISTS contact_number text;
