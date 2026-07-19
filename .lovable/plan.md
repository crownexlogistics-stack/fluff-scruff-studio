## The problem

The "Total Paid £100.00" line on the Package Details dialog is misleading. It is really the **package price**, not the amount actually received. Payment state is stored in `package_bookings.stripe_payment_status` but is **never shown** in the UI, so no one can tell whether a package has been paid, and if so, how.

Concretely, for Gurmit Chana's package:

- Created by Oksana on 16 Jul with `stripe_payment_status = 'pending'` and no `stripe_payment_intent_id`.
- In `CreatePackageBooking.tsx`, choosing "Send payment link (Stripe)" **does not actually send a link** — it just writes `stripe_payment_status = 'pending'` and moves on. There is no follow-up action anywhere to send a link later.
- "Paid in salon" writes `stripe_payment_status = 'paid_in_salon'` but never records how much cash vs card was collected, or which staff took the money — unlike regular bookings which now have `cash_collected` / `card_collected` / `payment_method`.

So today there are three payment states in the DB (`paid`, `paid_in_salon`, `pending`) but the dialog only ever shows a single "Total Paid" number, which is why Oksana can't tell whether Gurmit has paid.

## Permanent solution

Make the payment state of every package booking obvious at a glance, record it the same way as regular bookings, and give staff a one-click way to send a Stripe payment link when it's still owed.

### 1. Data model (migration)

Add to `package_bookings`:

- `amount_received numeric default 0` — actual money in (across all methods combined).
- `cash_collected numeric default 0`
- `card_collected numeric default 0`
- `payment_method text` — `stripe` | `cash` | `card` | `mixed` | `unpaid` (nullable until paid).
- `paid_by_staff_id uuid` — who took the salon payment (nullable).
- `paid_at timestamptz` — when it was marked paid.

Backfill:
- `stripe_payment_status = 'paid'` → `amount_received = total_paid`, `payment_method = 'stripe'`, `paid_at = created_at`.
- `stripe_payment_status = 'paid_in_salon'` and `total_paid > 0` → `amount_received = total_paid`, `payment_method = 'card'` (best guess, flagged in a note), `paid_at = created_at`.
- Everything else → `amount_received = 0`, `payment_method = 'unpaid'`.

### 2. Package Details dialog — clear payment section

Replace the ambiguous "Total Paid" row with a proper block:

```text
Payment
──────────────────────────────
Package price      £100.00
Amount received    £0.00       [UNPAID]  ← coloured badge
Balance due        £100.00
```

Badges:
- `PAID — Stripe (16 Jul)` (green) when method = stripe
- `PAID — Cash £X / Card £Y — Oksana (16 Jul)` (green) when method = cash/card/mixed
- `UNPAID` (red) when balance > 0 and no method

When there is a balance due and the viewer is a groomer or admin, show two buttons:

- **Send Stripe payment link** — invokes `create-package-checkout` for the outstanding amount, then either emails/SMSes the link to the customer or copies it to the clipboard (matches the ad-hoc payment link pattern already used for bookings).
- **Record payment in salon** — small dialog matching `CheckoutDialog`'s cash + card split UI. Writes `cash_collected` / `card_collected` / `payment_method` / `paid_by_staff_id` / `paid_at`, sets `amount_received`, updates `stripe_payment_status` to `paid_in_salon`, and logs a `package_payment_audit` entry.

### 3. Fix `CreatePackageBooking.tsx`

- Rename "Payment" section into three explicit choices:
  - **Send Stripe payment link** — now actually calls `create-package-checkout` after inserting the row, stores the returned `payment_intent_id` on `package_bookings`, and shows the link to send/copy. Status starts as `unpaid`.
  - **Paid in salon now** — opens the cash/card split inputs inline; on save, writes the same fields as (2) above. Status starts as `paid_in_salon`.
  - **Bill later** — creates the row `unpaid` and surfaces it in a new "Awaiting payment" filter on Package Health.
- Remove the current behaviour where "Send payment link" silently produces an unpaid package with no link.

### 4. Stripe webhook — mirror payments into the new fields

Update the `checkout.session.completed` branch of `stripe-webhook` (and `process-package-payment`) so when a package payment completes it also sets:

- `amount_received = amount_paid`
- `payment_method = 'stripe'`
- `paid_at = now()`
- `stripe_payment_status = 'paid'`

This keeps the two data paths (Stripe vs in-salon) writing to the same fields, so the UI stays consistent.

### 5. Package Health page — payment column

Add a "Payment" column to the list on `/admin/packages/health` showing the same badge as the dialog, plus a filter for "Awaiting payment" so admins can see at a glance which packages are unpaid. Groomer-facing `ActivePackages.tsx` also gets a small `UNPAID` chip so groomers never wonder mid-appointment.

### 6. Repair Gurmit's record

Once (1)–(5) ship, ask Oksana whether Gurmit paid. Then either:
- send a Stripe link via the new button, or
- record it as paid in salon with the correct cash/card split.

No silent auto-fix — the confusion is the data, and the data needs a human answer.

## Technical notes

- `create-package-checkout` already exists; the only change is exposing it from the dialog for post-creation top-ups.
- `package_payment_audit` already logs status changes; the new "recorded in salon" and "link sent" events fit that table.
- `stripe_payment_status` is kept for backward compat but becomes derived from `payment_method` + `amount_received`.
- No changes to `record-payment` or `cancel-booking-with-refund` (financial integrity rule).
