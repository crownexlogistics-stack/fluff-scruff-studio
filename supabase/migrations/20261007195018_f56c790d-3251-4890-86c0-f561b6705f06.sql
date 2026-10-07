
-- ===== Gift vouchers =====
CREATE TABLE public.gift_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  view_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  amount numeric(10,2) NOT NULL CHECK (amount > 0 AND amount <= 1000),
  occasion text NOT NULL DEFAULT 'classic',
  description text,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','active','reserved','redeemed','cancelled')),
  purchaser_name text NOT NULL,
  purchaser_email text NOT NULL,
  purchaser_phone text,
  send_to text NOT NULL DEFAULT 'me' CHECK (send_to IN ('me','recipient')),
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  delivery_method text NOT NULL DEFAULT 'email' CHECK (delivery_method IN ('email','sms','both')),
  copy_to_purchaser boolean NOT NULL DEFAULT true,
  gift_message text,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_paid numeric(10,2),
  is_complimentary boolean NOT NULL DEFAULT false,
  issued_by text,
  purchased_at timestamptz,
  expires_at timestamptz,
  reserved_booking_id uuid,
  reserved_at timestamptz,
  redeemed_at timestamptz,
  redeemed_booking_id uuid,
  redeemed_channel text,
  redeemed_by text,
  amount_applied numeric(10,2),
  purchaser_notified_at timestamptz,
  last_sent_at timestamptz,
  send_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gift_vouchers TO authenticated;
GRANT ALL ON public.gift_vouchers TO service_role;
ALTER TABLE public.gift_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view gift vouchers" ON public.gift_vouchers FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'director') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'groomer'));
CREATE POLICY "Managers can update gift vouchers" ON public.gift_vouchers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'director') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'director') OR has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_gift_vouchers_updated_at BEFORE UPDATE ON public.gift_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gift_vouchers_status ON public.gift_vouchers(status);

CREATE TABLE public.gift_voucher_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.gift_vouchers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  note text,
  performed_by text,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gift_voucher_events TO authenticated;
GRANT ALL ON public.gift_voucher_events TO service_role;
ALTER TABLE public.gift_voucher_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view voucher events" ON public.gift_voucher_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'director') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'groomer'));

-- Wrong-code attempt log for lockout (service role only)
CREATE TABLE public.gift_voucher_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gift_voucher_attempts TO service_role;
ALTER TABLE public.gift_voucher_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_gva_key_time ON public.gift_voucher_attempts(client_key, created_at);

-- Booking fields so cards/receipts show the voucher
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS voucher_code text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS voucher_amount numeric(10,2) NOT NULL DEFAULT 0;

-- Atomic single-use redemption (service role only)
CREATE OR REPLACE FUNCTION public.redeem_gift_voucher(_code text, _booking_id uuid, _amount_applied numeric, _channel text, _by text, _from_reserved boolean DEFAULT false)
RETURNS public.gift_vouchers
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.gift_vouchers;
BEGIN
  UPDATE public.gift_vouchers
  SET status='redeemed', redeemed_at=now(), redeemed_booking_id=_booking_id,
      redeemed_channel=_channel, redeemed_by=_by, amount_applied=_amount_applied,
      reserved_booking_id=NULL, reserved_at=NULL
  WHERE upper(code)=upper(_code)
    AND expires_at > now()
    AND (
      (status='active' AND NOT _from_reserved)
      OR (status='reserved' AND _from_reserved AND reserved_booking_id=_booking_id)
    )
  RETURNING * INTO v;
  IF v.id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.gift_voucher_events(voucher_id,event_type,note,performed_by,booking_id)
  VALUES (v.id,'redeemed','Redeemed (' || _channel || '), £' || _amount_applied::text || ' applied', _by, _booking_id);
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.redeem_gift_voucher(text,uuid,numeric,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift_voucher(text,uuid,numeric,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_gift_voucher(_code text, _booking_id uuid)
RETURNS public.gift_vouchers
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.gift_vouchers;
BEGIN
  UPDATE public.gift_vouchers
  SET status='reserved', reserved_booking_id=_booking_id, reserved_at=now()
  WHERE upper(code)=upper(_code) AND status='active' AND expires_at > now()
  RETURNING * INTO v;
  IF v.id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.gift_voucher_events(voucher_id,event_type,note,performed_by,booking_id)
  VALUES (v.id,'reserved','Held while customer pays the remaining deposit online','Customer (online)',_booking_id);
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.reserve_gift_voucher(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_gift_voucher(text,uuid) TO service_role;

-- When a booking is cancelled: release held vouchers; re-activate redeemed ones if cancelled 48h+ before
CREATE OR REPLACE FUNCTION public.handle_voucher_on_booking_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.gift_vouchers; _appt timestamptz;
BEGIN
  IF NEW.status NOT IN ('Cancelled','Refunded') OR OLD.status IN ('Cancelled','Refunded') THEN
    RETURN NEW;
  END IF;
  FOR v IN SELECT * FROM public.gift_vouchers WHERE reserved_booking_id = NEW.id AND status='reserved' LOOP
    UPDATE public.gift_vouchers SET status='active', reserved_booking_id=NULL, reserved_at=NULL WHERE id=v.id;
    INSERT INTO public.gift_voucher_events(voucher_id,event_type,note,performed_by,booking_id)
    VALUES (v.id,'released','Booking was not completed — voucher is usable again','System',NEW.id);
  END LOOP;
  _appt := (NEW.booking_date::text || ' ' || COALESCE(NEW.booking_time::text,'00:00'))::timestamp AT TIME ZONE 'Europe/London';
  FOR v IN SELECT * FROM public.gift_vouchers WHERE redeemed_booking_id = NEW.id AND status='redeemed' LOOP
    IF _appt - now() >= interval '48 hours' AND v.expires_at > now() THEN
      UPDATE public.gift_vouchers SET status='active', redeemed_at=NULL, redeemed_booking_id=NULL,
        redeemed_channel=NULL, redeemed_by=NULL, amount_applied=NULL WHERE id=v.id;
      INSERT INTO public.gift_voucher_events(voucher_id,event_type,note,performed_by,booking_id)
      VALUES (v.id,'reactivated','Appointment cancelled with 48h+ notice — voucher re-activated','System',NEW.id);
    ELSE
      INSERT INTO public.gift_voucher_events(voucher_id,event_type,note,performed_by,booking_id)
      VALUES (v.id,'forfeited','Appointment cancelled with less than 48h notice — voucher stays used','System',NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_voucher_on_booking_cancel AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_voucher_on_booking_cancel();

-- Christmas voucher switch (Halloween follows the existing seasonal switch)
INSERT INTO public.site_config(key,value) VALUES ('voucher_settings', '{"christmas": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
