
-- Add new HR fields to staff table
ALTER TABLE public.staff 
  ADD COLUMN start_date date,
  ADD COLUMN contract_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN signed_at timestamp with time zone,
  ADD COLUMN contact_number text;
