CREATE TABLE public.phone_booking_deposit_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX idx_pbdq_status_created
  ON public.phone_booking_deposit_queue (status, created_at);

ALTER TABLE public.phone_booking_deposit_queue ENABLE ROW LEVEL SECURITY;
-- No policies: service role still has full access (bypasses RLS); all others denied.