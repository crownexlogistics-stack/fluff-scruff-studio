

## Bug Fix: Deposit Auto-Populates on Book Again Form

### Problem
Line 213 in `NewBookingDialog.tsx` auto-calculates `deposit_paid` as 60% of total price whenever the breed/service changes. This runs even in "Book Again" mode, showing a non-zero deposit in the form. While the database insert (line 357) hardcodes `deposit_paid: 0`, the displayed value misleads groomers into thinking a deposit was recorded — and if the form's `deposit_paid` field is ever used elsewhere or the hardcode is removed, it would cause real data issues.

### Fix
In the `useEffect` price calculation block (line 211-214), set `deposit_paid: 0` instead of calculating 60%:

**File: `src/components/booking-calendar/NewBookingDialog.tsx`**

Change line 211-213 from:
```typescript
if (totalPrice > 0) {
  const deposit = Math.round(totalPrice * 0.6 * 100) / 100;
  setForm(prev => ({ ...prev, total_price: totalPrice, deposit_paid: deposit }));
}
```

To:
```typescript
if (totalPrice > 0) {
  setForm(prev => ({ ...prev, total_price: totalPrice, deposit_paid: 0 }));
}
```

This ensures:
- The deposit field always shows £0 on the form (for both Book Again and regular staff bookings)
- The database insert continues to save `deposit_paid: 0`
- No other behaviour is changed
- Total price auto-calculation still works correctly

One file changed, one line removed. No other modifications.

