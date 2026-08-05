# Control session statuses from the Package Details screen

Right now the sessions table in Package Details is read-only. If a session gets cancelled and the customer calls back to reinstate it, there is no way to put it back from that screen. This adds status control there for every staff member (admin, manager, groomer).

## What changes

**1. Sessions table becomes actionable**

Each session row gets an action button next to its status badge:

- Cancelled session -> "Reinstate"
- Scheduled session -> "Cancel session"
- Completed sessions stay read-only (they are financial records).

**2. Reinstate flow (the pop-up chain)**

Step 1 — "Reinstate this session?" dialog with two choices:

- **Keep original date & time** — reinstates immediately at the session's existing date/time. Nothing else changes.
- **Amend date & time** — goes to step 2.

Step 2 — Warning dialog: "You must amend the appointment on the calendar first. Have you already done this?"

- **No** — closes the dialogs and takes you to the calendar, opened on that customer's original appointment day, so you can amend it there.
- **Yes** — opens a date picker + time picker so you record when it was amended to. A **Save** button applies it.

On save (either path) the session flips from Cancelled back to Scheduled with the chosen date/time.

**3. Everything stays in sync**

- Reinstating writes to the underlying calendar booking (status back to Confirmed, plus the new date/time when amended). The existing database trigger mirrors that onto the package session, so the calendar and the package screen never disagree.
- Marking an appointment Completed on the calendar already flows through to Package Details; with realtime already wired on this dialog, every staff member sees it update live.
- Package counters (Used / Remaining / Total) and package status recalculate automatically from the same trigger.
- Each action is written to the Activity Timeline on the package screen (who did it, old -> new status, and the date/time change when amended).

**4. Who can do it**

Admins, managers and groomers can all reinstate and cancel individual sessions. Cancelling the whole package stays admin-only, as today.

## Technical notes

- File: `src/components/packages/PackageDetailDialog.tsx` — add an Actions column to the sessions table plus a new `SessionStatusDialog` component (`src/components/packages/SessionStatusDialog.tsx`) holding the choice / warning / date-time steps.
- Writes go to `bookings` (status, `booking_date`, `booking_time`), not directly to `package_sessions` — `trg_sync_package_session_from_booking` already mirrors status, date/time, counters and audit rows.
- Sessions with no `booking_id` (rare legacy rows) update `package_sessions` directly as a fallback.
- Timeline entries use the existing `package_payment_audit` events `session_status_changed` / `session_rescheduled`, which the dialog already renders.
- "Take me to the calendar" navigates to the bookings calendar for the session's original date; no calendar code changes needed.
- No schema migration required.
