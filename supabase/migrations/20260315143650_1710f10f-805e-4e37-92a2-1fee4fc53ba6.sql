
ALTER TABLE public.migrated_customers ADD COLUMN IF NOT EXISTS sms_opt_out boolean DEFAULT false;
ALTER TABLE public.migrated_customers ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz;
