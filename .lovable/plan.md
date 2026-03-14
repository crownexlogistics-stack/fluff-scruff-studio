

## Investigation Results

I found **three root causes** why SMS reminders aren't being sent for most bookings:

### Problem 1: Migrated bookings are completely ignored
The `send-sms-reminders` function only queries the `bookings` table. But most of today's appointments (5 out of 8) exist only in the `migrated_bookings` table (from the Wix migration) and have `supabase_booking_id = null` — meaning they were never synced to the main bookings table. These customers have phone numbers in `migrated_customers` but the reminder system never sees them.

### Problem 2: Status filter is too strict
The function only sends reminders to bookings with `status = "Confirmed"`. Today's bookings in the main `bookings` table had statuses like "Completed" and "Refunded" — which means by the time the reminder function ran, they'd already been marked complete. Only "Confirmed" bookings get reminders, but the status changes before the reminder window closes.

### Problem 3: Missing phone numbers on main bookings
Two of the three bookings in the main `bookings` table for today have `customer_phone = null`. The online booking flow makes the phone field optional (`guestForm.phone || null`), so many bookings are created without a phone number.

---

## Plan

### 1. Update `send-sms-reminders` to include migrated bookings
- Query `migrated_bookings` joined with `migrated_customers` (for phone numbers) where `is_future_booking = true` and `payment_status != 'Cancelled'`
- Add `sms_24h_sent` and `sms_2h_sent` columns to `migrated_bookings` table
- Apply the same time-window logic and send reminders via Twilio
- Log to `sms_messages` with `booking_id = null` but a reference to the migrated booking

### 2. Expand status filter to include "Completed" and "Pending"
- Change from `.eq("status", "Confirmed")` to `.in("status", ["Confirmed", "Pending", "Completed"])` — a booking that was confirmed should still get its 2h reminder even if the groomer already marked it complete early in the morning

### 3. Make phone number required in online booking flow
- Add phone as a required field in the guest booking form validation so future bookings always have a phone number

### 4. Show migrated booking reminders in the admin log
- Update `SmsRemindersLog` component to also show reminders sent to migrated bookings

### Database migration
```sql
ALTER TABLE public.migrated_bookings
  ADD COLUMN sms_24h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_2h_sent boolean NOT NULL DEFAULT false;
```

### Files to modify
- `supabase/functions/send-sms-reminders/index.ts` — add migrated bookings query + expand status filter
- `src/components/BookingFlow.tsx` — make phone required
- `src/components/marketing/SMSSection.tsx` — update log display
- Database migration for new columns

