
-- Add volunteer and work_placement to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'volunteer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'work_placement';
