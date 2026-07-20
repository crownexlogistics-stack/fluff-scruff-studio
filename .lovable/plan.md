## What's actually going on

Gurmit has **not paid**. The package record says so plainly:

- `package_bookings` for Gurmit / Rio: `total_paid £100`, `amount_received £0`, `payment_method 'unpaid'`, `stripe_payment_status 'pending'`, no `stripe_payment_intent_id`.

But the five session **bookings** on the calendar each look fully paid:

- `total_price £20`, `deposit_paid £20`, `stripe_payment_id NULL`, `payment_method NULL`, `cash_collected 0`, `card_collected 0`.

That is why each session card shows the green **"All Paid Online"** badge and the "Customer paid in full online — nothing to charge on the day" callout. It's the calendar card, not the package, that is wrong.

## Root cause

`src/components/packages/CreatePackageBooking.tsx` (lines 154–173) seeds every session booking with `deposit_paid = price_per_session` at insert time, regardless of whether the customer actually paid:

```ts
bookingData.total_price = 0;
bookingData.deposit_paid = 0;
...
if (pkg.package_type === "teeth_cleaning") {
  bookingData.total_price = pkg.price_per_session || 20;
  bookingData.deposit_paid = pkg.price_per_session || 20;   // ← lies
}
```

`BookingPopoverCard.tsx` then evaluates `isFullyPaid = deposit >= total` and prints the "All Paid Online" pill. There is no cross-check against the parent `package_bookings.amount_received` or `payment_method`, so an unpaid package still displays as paid on every session card.

This is the same class of bug we fixed for the package details dialog: `total_paid` was treated as "money in" when it was really "price". The session bookings inherited the same mistake, one layer deeper.

## Permanent fix

Two changes, both presentation-only for existing rows — no financial write-paths touched.

### 1. Stop seeding fake payment on session bookings

In `CreatePackageBooking.tsx`, when inserting each session booking:

- Always set `deposit_paid = 0` at creation.
- Only set `deposit_paid = price_per_session` **when the package was paid in full up front** — i.e. when `paymentMethod === "salon"` and `receivedNow >= totalPrice`, or (later) when Stripe confirms full payment.
- Keep `total_price = price_per_session` so the price breakdown still reads correctly.

This makes new packages honest: unpaid packages produce unpaid session bookings.

### 2. Make the session card read from the package, not itself

In `BookingPopoverCard.tsx`, when the booking is part of a package (we can detect this via `booking_source = "package"` and/or by joining to `package_sessions` to find the parent `package_booking_id`), derive the paid/unpaid pill from the parent `package_bookings` row instead of from `deposit_paid`:

- `amount_received >= total_paid` → green **"Package Paid"** pill (with method: Stripe / Salon).
- `0 < amount_received < total_paid` → amber **"Package Part-Paid — £X due"**.
- `amount_received = 0` → red **"Package Unpaid — send link"** with a shortcut that opens the existing `PackagePaymentPanel` action.

Also suppress the "Customer paid in full online — nothing to charge on the day" callout for package sessions unless the parent package is actually fully paid.

### 3. Repair the five existing Gurmit sessions

One targeted migration/backfill for **package bookings whose parent has `amount_received = 0`**:

```sql
UPDATE bookings b
SET deposit_paid = 0
FROM package_sessions ps
JOIN package_bookings pb ON pb.id = ps.package_booking_id
WHERE ps.booking_id = b.id
  AND pb.amount_received = 0
  AND b.stripe_payment_id IS NULL
  AND b.cash_collected = 0
  AND b.card_collected = 0;
```

This clears the false "paid" state on every session inherited from an unpaid package (Gurmit's five, plus any other unpaid packages in the same shape). It only touches rows with zero real money attached — no risk to genuinely paid bookings.

After the fix Oksana will see the five Gurmit sessions correctly as unpaid, and the existing **"Send Stripe payment link"** button on the package details dialog is the one-click way to collect from him.

## Files touched

- `src/components/packages/CreatePackageBooking.tsx` — don't seed `deposit_paid` unless money was actually taken.
- `src/components/booking-calendar/BookingPopoverCard.tsx` — package-aware payment badge and callout.
- New migration — backfill `deposit_paid = 0` on session bookings whose parent package is unpaid.

No changes to `record-payment`, `stripe-webhook`, `cancel-booking-with-refund`, or any financial write path.
