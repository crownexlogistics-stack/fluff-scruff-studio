
-- Add is_read column to sms_messages for tracking read state
ALTER TABLE public.sms_messages ADD COLUMN is_read boolean NOT NULL DEFAULT false;

-- Mark all existing messages as read
UPDATE public.sms_messages SET is_read = true;

-- Normalize any old +44 format phone numbers to 0-prefix local format
UPDATE public.sms_messages SET phone_number = '0' || substring(phone_number from 4) WHERE phone_number LIKE '+44%';
