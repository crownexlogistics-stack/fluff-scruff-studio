
ALTER TABLE public.coupons ADD COLUMN attributed_campaign_id uuid REFERENCES public.email_campaigns(id);
ALTER TABLE public.coupons ADD COLUMN attributed_sms_campaign text;

-- Update the attribution trigger to also check coupon linkage and run on UPDATE
CREATE OR REPLACE FUNCTION public.attribute_booking_to_campaign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _campaign_id uuid;
  _sms_campaign text;
  _normalized_phone text;
  _coupon_campaign_id uuid;
  _coupon_sms_campaign text;
BEGIN
  -- COUPON-BASED ATTRIBUTION: check if this booking has a coupon with campaign linkage
  IF NEW.id IS NOT NULL THEN
    SELECT c.attributed_campaign_id, c.attributed_sms_campaign
    INTO _coupon_campaign_id, _coupon_sms_campaign
    FROM public.coupon_usages cu
    JOIN public.coupons c ON c.id = cu.coupon_id
    WHERE cu.booking_id = NEW.id
    LIMIT 1;

    IF _coupon_campaign_id IS NOT NULL AND NEW.attributed_campaign_id IS NULL THEN
      NEW.attributed_campaign_id := _coupon_campaign_id;
    END IF;

    IF _coupon_sms_campaign IS NOT NULL AND NEW.attributed_sms_campaign IS NULL THEN
      NEW.attributed_sms_campaign := _coupon_sms_campaign;
    END IF;
  END IF;

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
$function$;

-- Make sure the trigger runs on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_attribute_booking ON public.bookings;
CREATE TRIGGER trg_attribute_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.attribute_booking_to_campaign();
