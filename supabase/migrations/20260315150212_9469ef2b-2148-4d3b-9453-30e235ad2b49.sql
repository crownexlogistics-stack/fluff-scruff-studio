
-- Add attributed_sms_campaign column to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attributed_sms_campaign text;

-- Create a function to hash phone for matching against sms_link_clicks
CREATE OR REPLACE FUNCTION public.hash_phone_for_sms(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  hash_bytes bytea;
BEGIN
  hash_bytes := extensions.digest(phone || 'fluffscruff_salt', 'sha256');
  RETURN encode(substring(hash_bytes from 1 for 8), 'hex');
END;
$$;

-- Update the booking attribution trigger to also check SMS clicks
CREATE OR REPLACE FUNCTION public.attribute_booking_to_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _campaign_id uuid;
  _sms_campaign text;
  _normalized_phone text;
BEGIN
  -- EMAIL ATTRIBUTION: check email_events for recent clicks
  IF NEW.customer_email IS NOT NULL AND NEW.attributed_campaign_id IS NULL THEN
    SELECT ee.campaign_id INTO _campaign_id
    FROM public.email_events ee
    WHERE lower(ee.email) = lower(NEW.customer_email)
      AND ee.event_type = 'click'
      AND ee.created_at >= (now() - interval '7 days')
    ORDER BY ee.created_at DESC
    LIMIT 1;

    IF _campaign_id IS NOT NULL THEN
      NEW.attributed_campaign_id := _campaign_id;
    END IF;
  END IF;

  -- SMS ATTRIBUTION: check sms_link_clicks for recent clicks by phone hash
  IF NEW.customer_phone IS NOT NULL AND NEW.attributed_sms_campaign IS NULL THEN
    -- Normalize the phone number to +44 format (same logic as edge function)
    _normalized_phone := regexp_replace(NEW.customer_phone, '[\s\-\(\)]', '', 'g');
    -- Handle +440 prefix
    IF _normalized_phone LIKE '+440%' THEN
      _normalized_phone := '+44' || substring(_normalized_phone from 5);
    END IF;
    -- Convert 07 to +447
    IF _normalized_phone LIKE '07%' THEN
      _normalized_phone := '+44' || substring(_normalized_phone from 2);
    END IF;
    -- Convert bare 7xxxxxxxxx to +447
    IF _normalized_phone LIKE '7%' AND length(_normalized_phone) = 10 THEN
      _normalized_phone := '+44' || _normalized_phone;
    END IF;
    -- Convert 447 without + to +447
    IF _normalized_phone LIKE '447%' AND _normalized_phone NOT LIKE '+%' THEN
      _normalized_phone := '+' || _normalized_phone;
    END IF;

    IF _normalized_phone ~ '^\+447\d{9}$' THEN
      SELECT slc.campaign_name INTO _sms_campaign
      FROM public.sms_link_clicks slc
      WHERE slc.phone_hash = public.hash_phone_for_sms(_normalized_phone)
        AND slc.clicked_at >= (now() - interval '7 days')
      ORDER BY slc.clicked_at DESC
      LIMIT 1;

      IF _sms_campaign IS NOT NULL THEN
        NEW.attributed_sms_campaign := _sms_campaign;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
