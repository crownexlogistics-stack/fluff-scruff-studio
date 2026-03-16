

## Investigation Summary

### Issue 1: Customer Details Edit "Bounces Back"

**Root cause**: The `updateCustomerMutation` in `CustomerProfilePage.tsx` (line 491-494) only updates the `bookings` table:

```sql
UPDATE bookings SET customer_name=..., customer_email=..., customer_phone=... 
WHERE customer_email = 'als1966@hotmail.co.uk'
```

Andrea Stephenson has **zero records** in the `bookings` table (only migrated bookings from Wix). The update matches 0 rows, "succeeds" silently, and the UI refetches the same old data from `migrated_customers`.

**Fix**: The mutation must also update `migrated_customers` (name, phone) and `profiles` (full_name) when those records exist. Also update `customer_pets` if the user has a registered account.

---

### Issue 2: Booking Flow Blocks Existing Customers

**Root cause**: Line 618 in `BookingFlow.tsx` validates:

```typescript
if (!guestForm.name.trim() || !guestForm.dogName.trim() || !guestForm.phone.trim()) {
  setAlertMessage("Please fill in your name, phone number and dog's name");
  return;
}
```

But for existing customers (`isExistingCustomer = true`), the name/dogName/phone input fields are **hidden** (line 1686: `{!isExistingCustomer && ...}`). The form relies on:
- `guestForm.phone` from `user.user_metadata.phone` -- often empty/null
- `guestForm.dogName` from `preselectedPetName` -- requires the customer to have selected a specific pet before entering the booking flow

If either is missing, the customer sees "Please fill in your name, phone number and dog's name" with no way to fix it -- the fields don't exist on screen.

**How many customers affected**: Any existing logged-in customer who either (a) doesn't have a phone number stored in their auth metadata, or (b) navigated to the booking flow without selecting a specific pet first. This is potentially all migrated customers since phone numbers are stored in `migrated_customers`, not in auth metadata.

---

### Plan

**1. Fix customer edit mutation** (`CustomerProfilePage.tsx`)
- Update `migrated_customers` table (full_name, phone) when a migrated record exists
- Update `profiles` table (full_name) when a profile record exists
- Keep existing bookings update for customers who DO have bookings

**2. Fix booking validation** (`BookingFlow.tsx`)
- For existing customers: auto-populate phone from bookings table or migrated_customers if auth metadata is empty
- For existing customers: auto-populate dogName from their registered pets if not preselected
- Change the hard block to a **warning only** -- show a toast/banner advising them to confirm details at the salon, but **allow the booking to proceed**
- If dogName is still empty, fall back to "Not specified" rather than blocking

**3. Auto-populate missing phone for existing customers** (`BookingFlow.tsx`)
- Add a query to fetch the customer's phone from `bookings` or `migrated_customers` as a fallback when `user_metadata.phone` is empty
- Fetch the customer's first pet name from `customer_pets` as fallback when no pet was preselected

These changes ensure no customer is ever blocked from completing a booking due to missing profile data that the system should already know about.

