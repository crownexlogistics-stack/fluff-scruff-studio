## What

Dan Mills' appointment on Sat 9 May at 10:00 (Full Groom Cockapoo Special with Oksana) is currently showing as **Completed / NOT PAID**. You want to roll it back so the groomer sees it as an actionable upcoming booking again (so she can mark it Completed + record the £57 payment, or No-Show, etc.).

## Findings

This is a **Wix-migrated booking** (the orange "W — Wix Booking" badge), not a native booking. It lives in the `migrated_bookings` table:

- Row id: `ab1d9557-8c69-4294-9a04-3a5ce8ed3f70`
- `payment_status`: `"Completed"` → this is what drives the "Completed" badge in the calendar
- `total_price`: £57, `deposit_paid`: £0

In `BookingsPage.tsx` the calendar maps `payment_status = "Completed"` to status `Completed`; anything else (e.g. `"Not paid"`) maps to `Confirmed`, which is the actionable state where the groomer's "Mark Completed / No Show" buttons reappear.

## Change

Single data update — no code changes:

- Update `migrated_bookings` row `ab1d9557-8c69-4294-9a04-3a5ce8ed3f70`
  - Set `payment_status` from `"Completed"` to `"Not paid"`

After this:
- Calendar card flips from grey "Completed" back to orange "Confirmed"
- The "NOT PAID" badge stays (deposit_paid is still 0)
- Oksana can re-action it from her booking popover (Mark Completed, take payment, No Show, etc.)

No financial records exist for this one yet (no Stripe payment, no `final_charge`), so nothing else needs unwinding.
