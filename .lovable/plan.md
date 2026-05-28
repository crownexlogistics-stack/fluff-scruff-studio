
## Goal
Make the Send Payment Link dialog editable (amount, email, phone), and make sure payments made through that link always get credited to the correct booking — even when sent to a different email/phone than the one on file.

---

## 1. Editable Send Payment Link dialog
File: `src/components/booking-calendar/SendPaymentLinkDialog.tsx`

Replace the read-only display with editable inputs, all prefilled from the booking:
- **Amount (£)** — number input, defaults to remaining balance (`total - deposit_paid`), min £0.30. Staff can change it (lower for partial, higher for top-ups).
- **Email** — text input, defaults to `booking.customer_email`. Editable when send mode is Email or Both.
- **Phone** — text input, defaults to `booking.customer_phone`. Editable when send mode is SMS or Both.
- **"Also save this email/phone to the booking?"** checkbox — appears only when the staff has actually changed the email or phone from the original. Unchecked by default (per your "ask me each time" choice).

Send button stays disabled until amount is valid and the relevant contact field is filled.

## 2. Edge function: accept overrides
File: `supabase/functions/send-payment-link/index.ts`

Accept new optional fields in the request body: `override_amount`, `override_email`, `override_phone`, `save_contact_to_booking`.

Changes:
- If `override_amount` is provided, use it instead of the computed `amountDue` (and skip the `payment_type === "deposit"` 50% rule for that call).
- Send the email to `override_email || booking.customer_email`.
- Send the SMS to `override_phone || booking.customer_phone`.
- Add extra metadata to the Stripe payment link: `{ booking_id, override_email, override_phone, amount_charged }` so we can always match it back later regardless of who paid.
- If `save_contact_to_booking` is true, update `bookings.customer_email` / `customer_phone` for that booking row.
- Audit log notes when an override was used.

## 3. Auto-match payments to bookings (the key fix)
New edge function: `supabase/functions/reconcile-booking-payment-links/index.ts`

What it does:
- Loops the most recent ~50 successful Stripe `payment_intents` (or checkout sessions linked to payment links).
- For each successful payment whose `metadata.booking_id` matches a booking, and whose `id` is not already recorded against any booking's `stripe_payment_id`, increment that booking's `deposit_paid` by the paid amount and append the payment intent id to a new `extra_stripe_payment_ids` text array (so we can attribute multiple payments to one booking — original deposit + later payment-link top-up).
- Writes an `audit_logs` row: `"Payment of £X auto-matched to booking Y via payment link metadata"`.
- Returns `{ matched: n }`.

This is the metadata-based reconciler — booking_id from the payment link metadata is the source of truth, not the email.

## 4. Trigger reconciliation when the calendar loads
File: `src/components/booking-calendar/WeeklyCalendar.tsx` (or the closest calendar query hook)

On mount and on focus, fire-and-forget `supabase.functions.invoke("reconcile-booking-payment-links")`, then invalidate the bookings query. This is the "poller" — runs whenever staff opens the calendar so the cards refresh with any newly-paid links.

## 5. Booking card already shows remaining balance correctly
File: `src/components/booking-calendar/BookingPopoverCard.tsx` — no change needed.
It already computes `total_price - deposit_paid`. Once step 3 bumps `deposit_paid`, the card automatically shows the right "left to pay in person" amount.

## 6. Database change
Migration to add: `extra_stripe_payment_ids text[] default '{}'` on `bookings` so we can record multiple matched payment intents per booking without losing the original `stripe_payment_id`.

---

## Out of scope (per memory rules)
- `record-payment` and `cancel-booking-with-refund` are NOT touched.
- No changes to the booking creation flow or initial deposit logic.
- No Stripe webhook setup — using metadata + on-load poll instead.

## Files touched
- `src/components/booking-calendar/SendPaymentLinkDialog.tsx` (edit)
- `supabase/functions/send-payment-link/index.ts` (edit)
- `supabase/functions/reconcile-booking-payment-links/index.ts` (new)
- `src/components/booking-calendar/WeeklyCalendar.tsx` (small on-mount hook)
- Migration: add `bookings.extra_stripe_payment_ids text[]`
