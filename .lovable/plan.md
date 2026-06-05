## What's broken

1. **Package payments show as "unmatched"** in the Finance Stripe Transactions tab and force manual matching. The unmatched lookup only checks `bookings.stripe_payment_id`, not `package_bookings.stripe_payment_intent_id`, so every package payment looks orphaned even though it's correctly linked.
2. **One package payment shows up against every appointment** in the matcher because there's no concept of "this PI belongs to a package, not a single booking".
3. **Stripe webhook wrongly cancels staff bookings** — the `checkout.session.expired` branch cancels any Pending booking with no `stripe_payment_id`, regardless of `booking_source` or how old the booking is. Two confirmed casualties: Dawn Coleman 5 Jun 10:30 (already reinstated by hand) and "dave" 5 Jun 12:30 (still Cancelled).
4. **Package Details panel is static** — sessions used / remaining and per-session dates/statuses don't update when a groomer marks an appointment Completed or reschedules it, so staff have no live view of where a package is up to.

---

## Fix plan

### Part A — Auto-match package payments in Finance

- **`get-stripe-transactions`**: also look up `package_bookings.stripe_payment_intent_id`. If a payment intent matches a package booking, return `matched: true` with a `matched_package` summary (package name, customer, sessions paid). The unmatched banner and "Match to Booking" dialog stop showing package payments.
- **`reconcile-booking-payment-links` sweeper**: when a Stripe Checkout Session has `metadata.type === "package_booking"` and `metadata.pending_id`, and no `package_bookings` row exists yet for that PI, invoke `process-package-payment` to create it. This back-fills any package payment where the customer closed the browser before the success page loaded.
- **`stripe-webhook` `checkout.session.completed`**: when `metadata.type === "package_booking"`, invoke `process-package-payment` instead of bailing out as "no_booking_id". `process-package-payment` is already idempotent on `stripe_payment_intent_id`.

### Part B — Harden the expired-checkout cancel

In `stripe-webhook` `checkout.session.expired`, only cancel a booking when **all** are true:
- Booking is `Pending` with no `stripe_payment_id`
- `booking_source = "online"`
- `created_at` is within the last 4 hours

Otherwise log skipped and return 200.

### Part C — Reinstate already-mis-cancelled bookings

Audit confirms exactly two rows hit by the bad branch:
- `e4a57485…` Dawn Coleman, 5 Jun 10:30 — already manually set back to Confirmed.
- `4f89c3f6…` "dave", 5 Jun 12:30 — still Cancelled from 2 Jun.

A one-off migration sets the "dave" booking back to `Pending` and inserts a `booking_audit_log` note "Reinstated by maintenance — wrongly auto-cancelled by Stripe webhook expiry guard". Staff can then confirm or chase manually.

### Part D — Live package tracking visible to every staff member

Goal: the existing **Package Details** panel (Package Health → row → details, and anywhere else `PackageDetailDialog` is used) reflects the truth at all times, with no manual upkeep.

**1. DB trigger keeps `package_sessions` and `package_bookings` in sync with `bookings`.**
New trigger on `public.bookings` AFTER UPDATE:
- When `status` flips to `Completed`, set the matching `package_sessions.status = 'completed'` and `completed_at = now()`.
- When `status` flips to `Cancelled`, set the matching `package_sessions.status = 'cancelled'`.
- When `booking_date` or `booking_time` changes, mirror into `package_sessions.scheduled_date` / `scheduled_time` so the panel shows the new slot, and append a `booking_audit_log` note "Package session rescheduled" so the timeline is intact.
- After any of the above, recompute the parent `package_bookings` row: `sessions_used = count(status='completed')`, `sessions_remaining = sessions_total - sessions_used`, and set `status = 'completed'` once `sessions_remaining` hits 0.

Matching is done via the existing `package_sessions.booking_id` FK — no schema changes needed beyond the trigger.

**2. Payment + price are already on `package_bookings` (`total_paid`, plus per-session price = `total_paid / sessions_total`). The Package Details panel already shows them; once Part A lands, the Stripe PI is reliably attached, so the "Total Paid £205.20 / Per Session £51.30" block becomes trustworthy.**

**3. Realtime so every staff member sees changes immediately without a refresh.**
- Add `package_bookings` and `package_sessions` to `supabase_realtime` publication.
- In `PackageDetailDialog` and the Package Health list, add a Supabase channel that listens to `postgres_changes` on both tables filtered by the open `package_booking_id`, and invalidates the React Query keys (`["package-detail", id]`, `["package-health-list"]`). The dialog already pulls bookings via the join — once the query re-runs, status badges, dates, and the "X of N used / Y remaining" counter update in place.

**4. Per-session row in the panel gets a status pill driven by the live `package_sessions.status`:** `scheduled` (grey), `completed` (green), `cancelled` (red), `rescheduled` (amber — derived when `scheduled_date` differs from the original creation date stored alongside).

---

## Files touched

- `supabase/functions/get-stripe-transactions/index.ts` — package-aware matched flag.
- `supabase/functions/reconcile-booking-payment-links/index.ts` — back-fill package payments.
- `supabase/functions/stripe-webhook/index.ts` — route package sessions to `process-package-payment`; add the 3 guards on the expired branch.
- New migration:
  - reinstate the "dave" booking + audit-log entries for Part C
  - new trigger function + trigger on `public.bookings` for Part D
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.package_bookings, public.package_sessions`
- `src/components/packages/PackageDetailDialog.tsx` — subscribe to realtime, invalidate query on changes, render per-session status pill.
- `src/pages/PackageHealthPage.tsx` — same realtime invalidation for the list view.

## Explicitly NOT changing

- `record-payment`, `cancel-booking-with-refund`, `process-package-payment` business logic.
- The manual Match-to-Booking dialog (kept as fallback; just won't see package payments any more).
- Pricing, commission split, T&C signing flow.