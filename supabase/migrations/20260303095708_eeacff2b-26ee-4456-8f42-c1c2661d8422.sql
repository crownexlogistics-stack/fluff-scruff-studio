-- Add scheduled_at column for schedule-for-later feature
ALTER TABLE public.email_campaigns 
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;

-- Enable pg_cron and pg_net for scheduled sending
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;