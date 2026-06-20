## Root cause (confirmed)

When Oksana pressed **Complete Appointment**, the dialog closed immediately and showed a success-looking state — but the database update silently failed, so the booking stayed as `Pending/Confirmed` and never appeared on Finance.

Why it failed:
- The recent split-payment work added a write of `payment_method: "cash" | "card" | "split"` into the `bookings` table in two places:
  - `src/pages/BookingsPage.tsx` (line 344)
  - `src/components/groomer/GroomerBookingsTab.tsx` (line 428)
- I verified against the live DB: the `bookings` table has `cash_collected` and `card_collected`, but **no `payment_method` column**. The accompanying migration only added the two amount columns and forgot `payment_method`.
- PostgREST therefore rejects the UPDATE with `42703 column "payment_method" does not exist`. The mutation throws, no commission record is inserted, and status stays unchanged.
- Why Oksana didn't see an error: `CheckoutDialog` calls `onOpenChange(false)` in the same click handler as `onComplete(...)`, so the dialog closes before the async mutation rejects. The error toast fires after the dialog is gone and is easy to miss on mobile.

Query proof: the only `Completed` booking dated today is Deepak Farma (completed weeks ago); none of Oksana's two checkouts landed.

## Permanent fix

### 1. Database migration — add the missing column

Add `payment_method` (`text`, nullable) to both tables so the existing client code works as written, and add a CHECK constraint to keep values clean:

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.commission_records
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash','card','split'));

ALTER TABLE public.commission_records
  ADD CONSTRAINT commission_records_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash','card','split'));
```

No data backfill — historical rows stay `NULL` and Money Flow already treats those as card.

### 2. Harden CheckoutDialog so a failure can never look like success

In `src/components/booking-calendar/CheckoutDialog.tsx`:

- Add an `isSubmitting` prop (driven by `completeMutation.isPending` / `noShowMutation.isPending` in the two parents).
- Remove the `onOpenChange(false)` call from the **Complete Appointment** and **Confirm No Show** click handlers. The dialog should only close when the parent's mutation actually resolves successfully.
- Disable both action buttons and show "Saving…" while `isSubmitting` is true.

In `src/pages/BookingsPage.tsx` and `src/components/groomer/GroomerBookingsTab.tsx`:

- Pass `isSubmitting={completeMutation.isPending || noShowMutation.isPending}`.
- In each mutation's `onSuccess`, call `setCheckoutOpen(false)` so the dialog only closes on a real DB success.
- On `onError`, leave the dialog open so the groomer immediately sees the toast and can retry — no more invisible failures.

### 3. Manually fix Oksana's two appointments

After the migration runs, Oksana re-opens each of today's two appointments and presses **Complete Appointment** again. This time the update will succeed, the commission record will be inserted, and both bookings will show on the Finance page and Money Flow tab.

(If you'd prefer, I can also run a one-off SQL update to mark those two specific bookings completed for today — but doing it via the UI is safer because it captures the correct cash/card split.)

## Out of scope

- No changes to `record-payment`, `cancel-booking-with-refund`, Money Flow logic, payout rules, or the online booking flow.
- No changes to types.ts (auto-regenerated after the migration).
