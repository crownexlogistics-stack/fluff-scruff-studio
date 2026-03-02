## Fix: Booking Flow - Auto-Login on Signup + Stripe Payment

### Problem
When a new customer clicks "Create Account & Pay Deposit":
1. The signup requires email verification, so the user is NOT logged in after `signUp`
2. This causes the `customer_pets` insert to fail (RLS requires authenticated user)
3. The flow may also fail at other points because the session is not established
4. After Stripe payment redirects back, the user is not logged in

### Solution

**1. Enable auto-confirm for email signups (database config)**
- Use the `configure-auth` tool to disable email confirmation requirement so users are immediately confirmed and logged in after signup

**2. Update `handleGuestSubmit` in `BookingFlow.tsx`**
- After `signUp`, immediately sign in the user with `signInWithPassword` to ensure a session is established
- This guarantees the user is authenticated before the booking insert and Stripe redirect
- When Stripe redirects back to the app, the session persists (stored in localStorage) so the user is already logged in
- Remove the "check your email" messaging since verification is no longer needed

**3. Flow after fix:**
- Customer fills in details, clicks "Create Account & Pay Deposit"
- Account is created and auto-confirmed (no email verification)
- User is immediately signed in
- Booking is saved to the database
- User is redirected to Stripe for payment
- After payment, user returns to the app already logged in

### Technical Details

**File: `src/components/BookingFlow.tsx`**
- After `supabase.auth.signUp()`, add `supabase.auth.signInWithPassword()` to establish the session
- Update success toast to remove email verification mention
- Keep the pet insert logic as-is (it will now work since user is authenticated)

## Rule: Numeric Inputs — Free Format Only

**PERMANENT RULE**: All numeric input fields across the entire application MUST use the `NumericInput` component (`@/components/ui/numeric-input`), NOT `<Input type="number">`.

### Why
- No browser spinner arrows (up/down buttons)
- Clean free-format text field that only accepts digits and decimal points
- Uses `inputMode="decimal"` for mobile numeric keyboard
- Consistent UX across all forms

### How
```tsx
import { NumericInput } from "@/components/ui/numeric-input";

<NumericInput
  value={form.price}
  onValueChange={(v) => setForm({ ...form, price: v })}
  allowDecimals={true}    // default true, set false for integers
  placeholder="0"
/>
```

### Never do this
```tsx
// ❌ WRONG — creates spinner arrows
<Input type="number" value={...} onChange={...} />
```
