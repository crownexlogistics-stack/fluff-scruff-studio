

You're right. Every session's date/time picker must show only genuinely available slots for the chosen groomer (or for "any" mode, slots where at least one groomer can cover all remaining sessions). No mid-checkout race-condition refund logic — if it was offered, it must be honoured.

## Plan: Package Booking = Real Availability On Every Session

### Part A — Anca's existing booking (data fix)
Assign her 4 Saturday 11:30 sessions (18 Apr, 23 May, 11 Jul, 8 Aug 2026) to **Oksana** via SQL update + audit log entry. T&C untouched.

### Part B — Front-end (`BookPackagePage.tsx`): every session uses real availability

For **every session** in the package (1, 2, 3, 4...), the date+time picker calls the same `check-availability` edge function the normal booking flow uses. Only slots that pass these checks are shown:

1. Salon open that day (staff schedule + no full-day override block)
2. Selected groomer has a working schedule for that day-of-week
3. No overlapping booking (real or migrated, excluding Cancelled/No Show/Refunded)
4. No partial override block covering the slot
5. Full session duration fits before closing

**"Specific groomer" mode:** every session picker filters to slots where that groomer is genuinely free. No refund risk — if it's shown, it's bookable.

**"Any available groomer" mode:** the system locks the groomer at session 1 confirmation:
- Session 1 picker: shows slots where at least one active groomer is free
- When customer picks session 1's date/time, system identifies eligible groomers, ranks by `booking_priority`, and picks the top one — this is the "package groomer"
- Sessions 2, 3, 4 pickers then filter to slots where **that same groomer** is free
- Hint shown: *"To keep things consistent for your dog, sessions 2–4 will only show times when [Groomer Name] is available."*

This means a customer can never select a slot the salon can't actually fulfil.

### Part C — Backend (`process-package-payment`): trust + final guard

The backend re-runs `check-availability` for every session as a final guard right before insert (same belt-and-braces the normal booking flow uses). Because the front-end already filtered properly, this should always pass.

For "Any" mode, the front-end now sends the resolved `groomer_id` for all sessions (locked in at session 1 confirmation), so the backend just inserts what it's given — no more null `staff_id`, ever.

If the final guard fails (extreme race: someone booked the exact same slot in the last 30 seconds), abort with a clear error and refund. This is the genuine edge case, not the everyday flow.

### Part D — DB safety net
Add a `NOT NULL` enforcement: if `booking_source = 'package_online'` then `staff_id` cannot be null. Defensive layer so a future bug can't repeat this.

### Files changed
1. **DB update** — assign Anca's 4 bookings to Oksana + audit log
2. **DB migration** — `staff_id` not-null guard for `booking_source = 'package_online'`
3. `src/pages/BookPackagePage.tsx` — wire every session's date/time picker through `check-availability`; lock groomer at session 1 in "Any" mode; filter sessions 2+ to that groomer's real availability
4. `supabase/functions/process-package-payment/index.ts` — final availability re-check + insert with the front-end-resolved `staff_id` (never null)

### Out of scope
T&C checkbox flow, normal booking flow, mid-checkout auto-refund logic (only used as last-resort race-condition guard).

