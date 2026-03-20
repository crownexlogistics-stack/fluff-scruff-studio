

## Problem

The "Send Deposit Link" button in the groomer portal calls `send-payment-link` which calculates `amountDue = total - deposit` (the full remaining balance). For a booking with £0 deposit paid, this sends a link for the **full price** instead of a **50% deposit**.

## Fix 1 — Edge Function: `send-payment-link`

Add a `payment_type` parameter. When `payment_type === "deposit"`:
- Calculate amount as `total_price * 0.5` instead of `total - deposit`
- Update the email copy to say "Deposit" instead of "Payment"
- Update the audit log to say "Deposit link" instead of "Payment link"

When `payment_type` is not "deposit" (or absent), keep existing behavior (full balance due).

The metadata on the Stripe payment link already includes `booking_id`, which is correct.

## Fix 2 — Frontend: `UnpaidDepositsAlert.tsx`

In `handleSendDepositLink`, pass `payment_type: "deposit"` in the request body:
```typescript
body: { booking_id: booking.id, send_via: ..., payment_type: "deposit" }
```

## Fix 3 — Verify `record-payment` Edge Function

The existing `record-payment` function:
- Searches Stripe checkout sessions for matching `booking_id` in metadata ✅
- Retrieves `amount_received` from the payment intent ✅
- Updates `deposit_paid` (not `total_price`) ✅
- Sets status to "Confirmed" (unless closed status) ✅

This is already correct. When a customer pays via the payment link, the checkout session inherits the payment link's metadata with `booking_id`, so `record-payment` will find it and update `deposit_paid` correctly.

## Fix 4 — Flag Orphaned Payment for Manual Review

Insert an audit log entry for `pi_3TD6XgQfeHASnkQW1onchwcE` flagging it for manual review. Also insert a booking anomaly-style record or audit entry visible in the finance page:
- Add an audit log: "UNMATCHED_PAYMENT — Payment of £50.00 received (pi_3TD6XgQfeHASnkQW1onchwcE) but no matching booking found. Manual review required."

## Files Changed

1. `supabase/functions/send-payment-link/index.ts` — Add `payment_type` support to calculate 50% deposit amount
2. `src/components/groomer/overview/UnpaidDepositsAlert.tsx` — Pass `payment_type: "deposit"` in request
3. Database insert — One audit log entry for the orphaned payment

