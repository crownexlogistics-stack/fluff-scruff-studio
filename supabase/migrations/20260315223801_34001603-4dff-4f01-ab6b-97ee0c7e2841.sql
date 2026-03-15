
-- Add attribution_source column to bookings to track HOW attribution happened
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attribution_source text;

-- Update the attribution trigger with strict priority logic (only ONE attribution)
CREATE OR REPLACE FUNCTION public.attribute_booking_to_campaign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email_campaign_id uuid;
  _email_click_time timestamptz;
  _sms_campaign text;
  _sms_click_time timestamptz;
  _normalized_phone text;
  _coupon_campaign_id uuid;
  _coupon_sms_campaign text;
BEGIN
  -- Reset attribution fields so we only set ONE
  NEW.attributed_campaign_id := NULL;
  NEW.attributed_sms_campaign := NULL;
  NEW.attribution_source := NULL;

  -- ============================================================
  -- PRIORITY 1: CLICK ATTRIBUTION (highest confidence)
  -- ============================================================

  -- Check email click events (last 7 days)
  IF NEW.customer_email IS NOT NULL THEN
    SELECT ee.campaign_id, ee.created_at
    INTO _email_campaign_id, _email_click_time
    FROM public.email_events ee
    WHERE lower(ee.email) = lower(NEW.customer_email)
      AND ee.event_type = 'click'
      AND ee.created_at >= (now() - interval '7 days')
    ORDER BY ee.created_at DESC
    LIMIT 1;
  END IF;

  -- Check SMS click events (last 7 days)
  IF NEW.customer_phone IS NOT NULL THEN
    _normalized_phone := regexp_replace(NEW.customer_phone, '[\s\-\(\)]', '', 'g');
    IF _normalized_phone LIKE '+440%' THEN
      _normalized_phone := '+44' || substring(_normalized_phone from 5);
    END IF;
    IF _normalized_phone LIKE '07%' THEN
      _normalized_phone := '+44' || substring(_normalized_phone from 2);
    END IF;
    IF _normalized_phone LIKE '7%' AND length(_normalized_phone) = 10 THEN
      _normalized_phone := '+44' || _normalized_phone;
    END IF;
    IF _normalized_phone LIKE '447%' AND _normalized_phone NOT LIKE '+%' THEN
      _normalized_phone := '+' || _normalized_phone;
    END IF;

    IF _normalized_phone ~ '^\+447\d{9}$' THEN
      SELECT slc.campaign_name, slc.clicked_at
      INTO _sms_campaign, _sms_click_time
      FROM public.sms_link_clicks slc
      WHERE slc.phone_hash = public.hash_phone_for_sms(_normalized_phone)
        AND slc.clicked_at >= (now() - interval '7 days')
      ORDER BY slc.clicked_at DESC
      LIMIT 1;
    END IF;
  END IF;

  -- If both email and SMS clicks exist, pick the most recent
  IF _email_campaign_id IS NOT NULL AND _sms_campaign IS NOT NULL THEN
    IF _sms_click_time >= _email_click_time THEN
      NEW.attributed_sms_campaign := _sms_campaign;
      NEW.attribution_source := 'click';
    ELSE
      NEW.attributed_campaign_id := _email_campaign_id;
      NEW.attribution_source := 'click';
    END IF;
    RETURN NEW;
  END IF;

  -- Only email click
  IF _email_campaign_id IS NOT NULL THEN
    NEW.attributed_campaign_id := _email_campaign_id;
    NEW.attribution_source := 'click';
    RETURN NEW;
  END IF;

  -- Only SMS click
  IF _sms_campaign IS NOT NULL THEN
    NEW.attributed_sms_campaign := _sms_campaign;
    NEW.attribution_source := 'click';
    RETURN NEW;
  END IF;

  -- ============================================================
  -- PRIORITY 2: COUPON ATTRIBUTION (no click found)
  -- ============================================================
  IF NEW.id IS NOT NULL THEN
    SELECT c.attributed_campaign_id, c.attributed_sms_campaign
    INTO _coupon_campaign_id, _coupon_sms_campaign
    FROM public.coupon_usages cu
    JOIN public.coupons c ON c.id = cu.coupon_id
    WHERE cu.booking_id = NEW.id
    LIMIT 1;

    -- Prefer SMS coupon attribution over email (only set ONE)
    IF _coupon_sms_campaign IS NOT NULL THEN
      NEW.attributed_sms_campaign := _coupon_sms_campaign;
      NEW.attribution_source := 'coupon';
      RETURN NEW;
    END IF;

    IF _coupon_campaign_id IS NOT NULL THEN
      NEW.attributed_campaign_id := _coupon_campaign_id;
      NEW.attribution_source := 'coupon';
      RETURN NEW;
    END IF;
  END IF;

  -- ============================================================
  -- PRIORITY 3: NO ATTRIBUTION
  -- ============================================================
  RETURN NEW;
END;
$function$;

-- Ensure trigger fires on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_attribute_booking ON public.bookings;
CREATE TRIGGER trg_attribute_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.attribute_booking_to_campaign();
