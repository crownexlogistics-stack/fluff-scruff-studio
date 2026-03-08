
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employment_end_date date DEFAULT NULL;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS account_blocked boolean DEFAULT false;
