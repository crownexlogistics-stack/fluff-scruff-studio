# Investigation: Oksana's errors on Brylee's calendar + wrong-groomer checkout

No code changed. Findings below are confirmed from the live database policies and the calendar code.

## Issue 1 — Oksana gets an error when booking/moving/cancelling on Brylee's calendar

Oksana is a **groomer** with "Full Calendar Access" **OFF**. Brylee is a groomer with it **ON**.

The database rule that decides who may change an appointment says: a plain groomer may only touch appointments **where she is the assigned groomer**. There is no separate rule for "what the appointment may look like after the change", so the database applies the same test to the *new* version of the row. Consequences:

1. **Rescheduling a customer onto Brylee** — Oksana starts from her own appointment (allowed), but the saved version has Brylee as the groomer, which fails the test. The database rejects it with a raw "new row violates row-level security policy" message, which the Edit dialog shows verbatim as a toast — that is the unexplained error.
2. **Cancelling or amending an appointment that is already Brylee's** — the appointment isn't hers, so the update matches zero rows. The screen reports success or a confusing message while nothing actually changed.
3. **Add-ons** — groomers only have read access to the appointment add-ons table, so add-on changes during an edit are silently dropped (and can surface as an error on create).
4. **Creating a new appointment in Brylee's column** — permitted by the database, but a safety trigger rejects it if the chosen service is not on Brylee's approved service list (she has 5 approved services). That produces a different, also unexplained error.

Business reality: reception/senior staff need to book and move work across the whole team, so the current "own appointments only" write rule is too tight for how the salon actually runs.

## Issue 2 — Brylee can check out Oksana's appointment

Two independent gaps:

- **Interface**: the "Check Out" button on an appointment card has **no ownership check at all**. It renders for any staff member on any appointment that isn't already completed/cancelled. There is no comparison against the signed-in groomer.
- **Database**: Brylee's "Full Calendar Access" toggle grants her write access to *every* appointment, not just visibility. That toggle was intended as a viewing/coordination permission, but it currently also lets her complete other groomers' work.

Side effect: when a groomer checks out someone else's appointment, the commission and activity records are restricted to her own groomer id, so the money can land on the wrong person or fail to record at all.

## Recommended fixes (for approval, not yet implemented)

1. **Allow cross-groomer scheduling.** Widen the write rule so a groomer may create, edit, reschedule and cancel appointments for other groomers (subject to the existing approved-service check), rather than only her own.
2. **Lock checkout to owner or admin.** Show and allow "Check Out" only when the appointment's groomer is the signed-in user, or the user is a manager/director. Everyone else sees the card read-only with a short explanation.
3. **Separate the two meanings of Full Calendar Access.** Keep it as see-everything; stop it granting checkout rights on other groomers' appointments.
4. **Replace raw database errors with plain English.** Map permission and approved-service failures to messages like "Brylee isn't set up for this service" or "You can't check out another groomer's appointment".
5. **Optional:** allow reception-style staff to reassign an appointment to another groomer from the edit dialog with a confirmation, logged to the audit trail.

## Technical notes

- Table `bookings`, policy "Groomers can update assigned bookings": `USING (groomer AND staff_id in own staff ids)` with **no WITH CHECK**, so Postgres reuses USING as the check on the new row — the exact cause of the reschedule failure.
- Policy "Groomers with full access can update any booking" is what lets Brylee write to Oksana's rows.
- `src/components/booking-calendar/BookingEvent.tsx` (~line 973) and `BookingPopoverCard.tsx` (~line 752) render Check Out with only a status condition, no `currentStaffId` comparison; `GroomerCalendar.tsx` passes `onCheckout` through unconditionally.
- `EditAppointmentDialog.tsx` `onError: (e) => toast.error(e.message)` surfaces the raw Postgres text.
- `booking_addons` has no groomer insert/delete policy; `enforce_booking_integrity` raises on services outside `staff_services`.
