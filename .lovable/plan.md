# Reinstate a cancelled appointment

"Reinstate" is the right word — it means putting the cancelled appointment back exactly as it was: same date, same time, same groomer, same dog, same service, same prices.

## What changes

**1. A Reinstate button on cancelled appointments**

Any appointment showing as Cancelled, No Show or Refunded gets a "Reinstate" button — on the appointment card in the calendar, in its pop-out details, and in the groomer's own calendar and bookings list. Admins, managers and groomers all see it (the same people who can cancel).

**2. What it does**

Clicking it opens a short confirmation showing what will come back:

- Date, time and groomer
- Customer and dog
- Service and add-ons
- Total price, what was paid, what is still due

Confirming puts the appointment back in the diary with its original date, time and groomer. Nothing about the booking's details is re-entered — it is the same record, simply un-cancelled.

The status it returns to is whatever it was before the cancellation (Confirmed if a deposit had been paid, otherwise Pending), so payment badges read correctly again.

**3. Money**

- If no refund was issued, the deposit and totals come back untouched.
- If the cancellation triggered an automatic Stripe refund, the appointment comes back with the deposit shown as **due again** (paid amount reset to zero) and a clear note on the confirmation and in the history that a refund of the original amount was already returned to the customer. Staff can then take payment or send a payment link as normal.

**4. Slot clashes**

If someone else has since been booked with that groomer at that time, the confirmation shows a warning naming the clashing appointment. Staff can still go ahead — it will simply appear alongside the other booking on the calendar.

**5. Audit trail**

Every reinstatement is recorded in the appointment's Booking History with who did it and the exact date and time, e.g. "Reinstated by Oksana — 8 Sep 2026, 11:04 (was cancelled 7 Sep 2026, 16:20)". It also goes into the salon-wide activity log. If the deposit was reset because of a refund, that is written into the same entry.

**6. Package sessions**

Sessions that belong to a package deal keep using the existing package Reinstate flow on the package screen, so the two never disagree.

## Technical notes

- New shared component `src/components/booking-calendar/ReinstateBookingDialog.tsx`, plus a `reinstateBooking` helper that:
  - reads the last `cancelled` / `status_changed` row in `booking_audit_log` to work out the pre-cancellation status; falls back to `deposit_paid > 0 ? "Confirmed" : "Pending"`.
  - updates `bookings.status` (and `deposit_paid = 0` when the booking was `Refunded`), and clears `payment_status`/`is_future_booking` for migrated Wix rows the same way cancel sets them.
  - queries `bookings` for same `staff_id` + `booking_date` with overlapping times to build the clash warning.
  - writes a `booking_audit_log` row with `event_type: "reinstated"`, `performed_by`, `note`; also `logAudit` (`BOOKING_REINSTATED`) and `logGroomerActivity`.
- Wire the button through `BookingEvent.tsx`, `BookingPopoverCard.tsx`, `WeeklyCalendar.tsx`, `BookingsPage.tsx`, `GroomerCalendar.tsx` and `GroomerBookingsTab.tsx` via a new `onReinstate` prop, shown only when status is Cancelled / No Show / Refunded and `booking_source !== "package"`.
- Add `reinstated` to the timeline event map (green dot) in both `BookingEvent.tsx` and `BookingPopoverCard.tsx`.
- No Stripe calls are made on reinstate; refunds are never reversed.
- No schema migration needed — `booking_audit_log` already accepts free-text event types.
