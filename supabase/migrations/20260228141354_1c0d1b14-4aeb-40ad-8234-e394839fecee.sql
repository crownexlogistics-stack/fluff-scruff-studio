
-- Add 'director' to app_role enum (must be its own transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
