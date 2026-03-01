
ALTER TABLE public.staff 
  ADD COLUMN hs_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN hs_signed_at timestamptz,
  ADD COLUMN hs_signed_ip text;
