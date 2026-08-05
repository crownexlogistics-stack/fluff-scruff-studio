# Package payment should mark all its appointments as paid

## The problem (confirmed on Gurmit Chana's package)

The package row says £100 price / £100 received (Cash, 05 Aug), but the five linked calendar appointments still hold a £0 deposit (one has a stale £10). So the calendar card shows "NOT PAID" with "£20 Balance Due — due at the salon", and at checkout the groomer is asked to collect £20 the customer already paid in cash.

Money received is recorded only on the parent package; it is never pushed down to the child appointments.

## The fix

When a package's received amount changes (Stripe link paid, or salon cash/card recorded), spread it across that package's appointments automatically:

- Fully paid package → every non-cancelled session appointment is marked paid in full.
- Part-paid package → the received amount is spread evenly across sessions, so cards show "Package Part-Paid — £X due" and checkout asks only for the true outstanding amount.
- Nothing received → appointments go back to £0 paid.
- Cancelled / No Show / Refunded sessions are skipped.
- Backfill the existing Gurmit Chana package so its five appointments show paid immediately.

Result: mark cash once on the Package Details screen and all appointments in that package instantly read as paid on the calendar, with £0 left to collect at checkout.

## Groomer pay is not affected

Groomer earnings stay exactly as today: commission is created only when that individual appointment is checked out as Completed, and it is calculated from that appointment's own price (40% / 50% own-customer). No groomer receives the package total, and if a different groomer takes a later session they earn only that session. This change touches the "how much is still owed" field, not commission.

Cash/card collected at checkout also stays untouched — because the balance is now £0, an already-paid package session records no new cash at checkout, so the £100 cash is not double-counted in Money Flow.

## Technical detail

- New security-definer trigger on `package_bookings` (AFTER UPDATE of `amount_received` / `total_paid` / `payment_method`): recalculates `deposit_paid` on each `bookings` row joined via `package_sessions`, proportional to `amount_received / total_paid`, capped at that booking's `total_price`, skipping Cancelled / No Show / Refunded. Logs a `package_payment_audit` row (`event_type = 'sessions_payment_synced'`).
- One-off data update applying the same distribution to the existing Gurmit Chana package (5 x £20).
- `PackagePaymentPanel.tsx`: after recording a salon payment, also invalidate the bookings and `package-payment-for-session` queries so the calendar refreshes without a reload.
- `BookingPopoverCard.tsx` / `CheckoutDialog.tsx`: no logic rewrite — they already read the parent package payment state and `deposit_paid`, and will show correct values once the data is right.