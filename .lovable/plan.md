

## Plan: Add Itemized Price Breakdown to Booking Details Dialog

### Problem
The `ViewOrderDialog` currently shows only a flat "Total Price" with no explanation of how it was calculated. When a customer pays £70 for a £45 service, there's no visibility into the £25 of add-ons. The popover card already has this breakdown, but the dialog does not.

### Changes

**File: `src/components/booking-calendar/ViewOrderDialog.tsx`**

1. **Add a `booking_addons` query** — same pattern already used in `BookingPopoverCard.tsx`:
   - Query `booking_addons` joined with `add_ons(name, price)` filtered by `booking_id`

2. **Replace the "Financial Summary" section** with an itemized breakdown:
   - Service name → calculated service price (total minus add-ons, before discount)
   - Each add-on → name + price (with Sparkles icon)
   - If coupon applied: subtotal line, then coupon discount line (code + amount)
   - Bold total line
   - Deposit paid / balance due below

3. **Merge the separate "Coupon Indicator" section** into the price breakdown so everything is in one clear block instead of two disconnected sections.

4. Add `Sparkles` to the lucide imports.

### No database changes needed
The `booking_addons` table and `coupon_usages` table already exist with correct RLS policies. This is purely a UI change to surface existing data.

### Result
The Booking Details dialog will show a complete price trail:
```text
Full Groom                     £45.00
+ Ultrasonic Teeth Clean       £15.00
+ Nail Trim                    £10.00
─────────────────────────────────────
Subtotal                       £70.00
🏷 Coupon NEWSTART15 (15%)    -£10.50
─────────────────────────────────────
Total                          £59.50
Deposit Paid                   £10.00
Balance Due                    £49.50
```

