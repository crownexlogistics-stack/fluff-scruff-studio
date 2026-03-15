
-- Add attributed_campaign_id to bookings (nullable, references email_campaigns)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attributed_campaign_id uuid REFERENCES public.email_campaigns(id);

-- Create a function that checks email_events for recent clicks and attributes the booking
CREATE OR REPLACE FUNCTION public.attribute_booking_to_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _campaign_id uuid;
BEGIN
  -- Only run if we have a customer email and no campaign already set
  IF NEW.customer_email IS NOT NULL AND NEW.attributed_campaign_id IS NULL THEN
    -- Find most recent click event within last 7 days for this email
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

  RETURN NEW;
END;
$$;

-- Create trigger on bookings insert
DROP TRIGGER IF EXISTS trg_attribute_booking_campaign ON public.bookings;
CREATE TRIGGER trg_attribute_booking_campaign
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.attribute_booking_to_campaign();
