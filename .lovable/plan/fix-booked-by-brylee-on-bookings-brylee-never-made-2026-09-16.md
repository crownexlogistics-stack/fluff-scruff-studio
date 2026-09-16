# Fix "Booked by Brylee" on bookings Brylee never made

## What is actually happening

Confirmed from the live data and the booking screens: the "Booked by" name on an appointment is **not** the person who made the booking. The system saves the name of the **groomer the appointment is assigned to**.

So whenever Oksana (or anyone else) books a customer into Brylee's column, the appointment is stored and displayed as "Booked by Staff — Brylee". Brylee didn't touch it.

Proof from the records: on 14 September, two appointments for Aytaj Khalilli were created while Oksana was signed in, and both are stamped "with Brylee". The hidden security log correctly records Oksana as the person who created them — that information exists, it is just never shown on the appointment.

Customer self-bookings from the website are not stamped with anyone's name; they show as online bookings. If one of those ever looked like Brylee's doing, it was the same confusion of "assigned groomer" with "who booked it".

Two side effects of the same mistake:
- The appointment timeline shows "Created by Brylee" for the same reason.
- The groomer activity feed ("Today's Activity") logs the booking under the assigned groomer, so Brylee sees actions in her own activity list that she never performed.

## The fix

1. Record the **signed-in staff member** as the creator when a booking is made from the calendar or from a customer profile, instead of the assigned groomer.
2. Show both clearly on the appointment card: "Booked by Oksana" and "Groomer: Brylee" — never the same field doing two jobs.
3. Log the booking in the **creator's** activity feed, not the assigned groomer's, so Brylee's activity list only shows her own actions.
4. Correct the existing records: for past staff bookings, recover the true creator from the security log (it stores the signed-in user for every booking creation) and rewrite the stored creator name. Where no record exists, leave it blank rather than showing a wrong name.
5. Fall back sensibly: if the signed-in person isn't a staff member (e.g. an admin without a groomer record), show their account name rather than a groomer's.

## Technical notes

- `created_by_staff` is set from `staff.find(s => s.id === form.staff_id).name` in `src/components/booking-calendar/NewBookingDialog.tsx` (line 401/418) and `src/components/customer-profile/NewAppointmentDialog.tsx` (line 234/251) — replace with the current staff identity from `useCurrentStaff()`.
- Same substitution for `booking_audit_log.performed_by` (`event_type: "created_by_staff"`) and `logAudit({ staffId })`, which currently passes `form.staff_id`.
- `logGroomerActivity({ staffId: form.staff_id })` should use the creator's staff id; keep the assigned groomer in the summary text.
- Display: `BookingEvent.tsx` line 605 and `BookingPopoverCard.tsx` line 336 render "Booked by Staff — {created_by_staff}"; add the assigned groomer name alongside.
- Backfill migration: join `bookings` to `audit_logs` where `action = 'BOOKING_CREATED'` matching on the details string / timestamp window, map `audit_logs.user_id` to `staff.auth_user_id`, and update `created_by_staff`. Bookings with no matching audit row get `NULL`.
- The phone assistant already writes `created_by_staff = 'AI Receptionist'` — leave that as is.
