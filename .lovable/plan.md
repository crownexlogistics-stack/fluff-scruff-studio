## Goal
Stop unpaid online bookings from blocking the calendar. Confirm or cancel them server-side via Stripe webhooks, sweep up anything missed, and hide the abandoned ones from the calendar. `BookingFlow.tsx` insert order stays as-is.

## 1. New edge function — `stripe-webhook`
**File:** `supabase/functions/stripe-webhook/index.ts`

- Reads raw body, verifies signature with `STRIPE_WEBHOOK_SECRET` using `stripe.webhooks.constructEventAsync`. Returns 400 if invalid.
- `checkout.session.completed` → reads `metadata.booking_id`. Idempotency: if booking already `Confirmed` with same `stripe_payment_id`, returns 200 no-op. Otherwise sets `status=Confirmed`, `deposit_paid=amount_total/100`, `stripe_payment_id=payment_intent`, logs "Payment confirmed via Stripe webhook".
- `checkout.session.expired` → only acts if booking still `Pending` and no `stripe_payment_id`. Sets `status=Cancelled`, logs "Booking cancelled — Stripe checkout expired without payment".
- Other events return 200.
- Register in `supabase/config.toml` with `verify_jwt = false`.

## 2. `record-payment` idempotency
**File:** `supabase/functions/record-payment/index.ts` — minimal surgical edit.

After loading the booking, if `status === "Confirmed"` AND `stripe_payment_id` is set, return `{ success: true, already_recorded: true }` immediately — no Stripe lookup, no DB write, no audit row. Prevents duplicate audit entries when webhook fires before success page loads.

## 3. New edge function — `expire-pending-bookings`
**File:** `supabase/functions/expire-pending-bookings/index.ts`

Service-role client. Finds bookings where `booking_source='online' AND status='Pending' AND COALESCE(deposit_paid,0)=0 AND stripe_payment_id IS NULL AND created_at < now() - interval '2 hours'`. For each: set `status='Cancelled'`, log "Auto-cancelled — no payment received within 2 hours of booking". Returns `{ cancelled, ids }`. Registered with `verify_jwt = false` so pg_cron can call it.

Schedule via `pg_cron` + `pg_net` (using `insert` tool, not migration, because the SQL contains the project URL and anon key):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'expire-pending-bookings-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url := 'https://pkshffylgauatrcidqqj.supabase.co/functions/v1/expire-pending-bookings',
       headers := '{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
```

## 4. Cancel the 5 ghost bookings (via `insert` tool)

```sql
UPDATE bookings SET status='Cancelled'
WHERE id IN ('821fb8ff-d6db-4523-ac6f-39aacc456dfb',
             '45c67ce0-3a29-4e01-8ede-7109406ee973',
             '155d6a64-1963-4e14-a30e-54509d829653',
             '6a945702-1ee2-4f37-a836-0166308b7805',
             'ec96c413-4f33-4206-94be-8d72acf4da95');

INSERT INTO booking_audit_log (booking_id, event_type, performed_by, note)
SELECT id, 'cancelled', 'System (audit May 2026)',
       'Cancelled — abandoned checkout, no payment received. Auto-cancelled during payment flow audit May 2026.'
FROM bookings WHERE id IN (...same 5...);
```

## 5. Calendar — hide unpaid online Pending
**File:** `src/components/booking-calendar/WeeklyCalendar.tsx`

Add `isUnpaidOnlinePending(b)` = `b.booking_source === 'online' && b.status === 'Pending' && Number(b.deposit_paid||0) === 0 && !b.stripe_payment_id`. Filter these out of `bookingsByDate` so they neither block the slot nor render. Staff / package / phone_ai untouched.

## 6. Stripe registration instructions (delivered in chat)

- Webhook URL: `https://pkshffylgauatrcidqqj.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`
- Dashboard → Developers → Webhooks → Add endpoint → paste URL → select those two events → copy "Signing secret" (`whsec_…`) → confirm `STRIPE_WEBHOOK_SECRET` in Lovable Cloud matches (already exists; can be rotated via Project Settings → Secrets).

## Files

**New:** `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/expire-pending-bookings/index.ts`
**Edited:** `supabase/config.toml`, `supabase/functions/record-payment/index.ts`, `src/components/booking-calendar/WeeklyCalendar.tsx`
**Data ops:** cancel 5 ghosts + audit rows, schedule hourly cron

## Out of scope
`BookingFlow.tsx` insert order; `cancel-booking-with-refund`; staff/package/phone_ai calendar handling.
