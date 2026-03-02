

# Redesign Booking Popover with Checkout and Order Management

## Overview

Replace the current simple booking popover with a professional appointment card that includes a 3-dot menu (View Order, Edit Appointment, Cancel), plus "Book Again" and "Check Out" action buttons. The Check Out flow handles two outcomes: "Completed as planned" (with adjustable final charge) and "No Show" (auto-cancels, shrinks calendar block, emails customer).

## What Changes

### 1. Redesigned Booking Popover (BookingEvent.tsx)

The current popover shows basic info and a "Book Again" button. It will be replaced with:

**Top section:**
- Customer name (bold) with initials avatar
- Customer email and phone
- Status badge + deposit badge

**Middle section:**
- Date and time
- Service name, breed/dog name
- Groomer name
- Price (total)

**Bottom action bar:**
- Three-dot icon button (left) opening a dropdown menu with:
  - **View Order** -- opens a read-only dialog showing the full booking form the customer completed (all fields: name, dog, breed, service, date, time, price, deposit, notes, add-ons)
  - **Edit Appointment** -- opens a dialog allowing changes to date, time, service, breed, staff, add-ons, and price
  - **Cancel** -- prompts confirmation, then cancels the booking (sets status to "Cancelled"), logs to audit trail
- **Book Again** button (outline) -- opens the NewBookingDialog pre-filled with the same customer and service details
- **Check Out** button (primary) -- opens the checkout flow

### 2. New Checkout Dialog (CheckoutDialog.tsx)

A new dialog component with two options presented as cards:

**Option A: "Appointment completed as planned"**
- Shows deposit already paid (read-only)
- Shows remaining balance = total_price - deposit_paid
- Editable "Final charge" field (pre-filled with remaining balance) so groomers can adjust if they charged more or less
- "Complete" button -- updates booking status to "Completed", logs final charge to audit trail

**Option B: "No Show"**
- Confirmation prompt: "Customer did not attend"
- On confirm:
  - Sets booking status to "No Show"
  - Changes the calendar event colour to a muted/grey style
  - Shortens the visual block on the calendar (reduces duration to minimal height so the slot appears available for rebooking)
  - Sends a cancellation email to the customer informing their appointment was cancelled due to non-attendance
  - Logs to audit trail

### 3. New View Order Dialog (ViewOrderDialog.tsx)

A read-only dialog showing all booking details in a clean form layout:
- Customer name, email, phone
- Dog name, breed
- Service type
- Date and time
- Staff member assigned
- Total price, deposit paid
- Notes
- Any add-ons (future)

### 4. New Edit Appointment Dialog (EditAppointmentDialog.tsx)

A form dialog (similar to NewBookingDialog) pre-filled with current booking data, allowing edits to:
- Date and time
- Service type
- Breed
- Staff member
- Price adjustments
- Add-ons
- Notes

On save: updates the booking record, logs changes to audit trail.

### 5. Calendar Visual Changes for No Show

When a booking has status "No Show":
- Calendar block uses a grey/muted colour instead of the staff colour
- Block height shrinks to a thin strip (e.g., 16px) with strikethrough text
- This visually frees the slot so groomers can see availability and book another customer

### 6. Database Changes

No new tables needed. Changes to existing data:
- The `bookings.status` field will use new values: "Completed" and "No Show" in addition to existing "Pending", "Confirmed", "Cancelled"
- Add a `final_charge` column (numeric, nullable) to the `bookings` table to store the actual amount charged at checkout (may differ from `total_price`)

**Migration SQL:**
```sql
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS final_charge numeric;
```

## Files to Create

- `src/components/booking-calendar/CheckoutDialog.tsx` -- checkout flow with "Completed" and "No Show" options
- `src/components/booking-calendar/ViewOrderDialog.tsx` -- read-only booking details
- `src/components/booking-calendar/EditAppointmentDialog.tsx` -- edit booking form

## Files to Modify

- `src/components/booking-calendar/BookingEvent.tsx` -- complete redesign of the popover with 3-dot dropdown menu, Book Again, and Check Out buttons
- `src/components/booking-calendar/WeeklyCalendar.tsx` -- pass new callback props for checkout, edit, view, and cancel actions
- `src/pages/BookingsPage.tsx` -- add state and handlers for the new dialogs (checkout, view order, edit appointment), add cancel mutation
- `src/components/groomer/GroomerCalendar.tsx` -- same new callbacks for groomer view (where applicable based on role permissions)

## Technical Details

- The 3-dot menu uses the existing `DropdownMenu` component from the UI library
- "No Show" email uses the existing `send-booking-email` edge function with a new `email_type: "no_show"`
- All actions (complete, no show, edit, cancel) write to `audit_logs` via the existing `logAudit()` utility
- The "Book Again" button reuses `NewBookingDialog` with pre-filled defaults from the selected booking
- Calendar colour logic in `BookingEvent.tsx` checks `booking.status === "No Show"` to apply grey styling

