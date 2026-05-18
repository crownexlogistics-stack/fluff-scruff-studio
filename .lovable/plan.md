
# Bullet-proof booking integrity + click tracking

Two things to deliver:

1. Make it **structurally impossible** for an online booking to be saved without a specific `service_id`, or to be assigned to a groomer who isn't allowed to perform that service.
2. **Log every click** the customer makes in the booking flow so any future booking can be audited end-to-end.

---

## Part 1 — Bullet-proof service & groomer integrity (4 layers)

The reason the Mollie/Bohdan booking happened is that **a single NULL `service_id`** silently disabled the service-eligibility check in two places (client `filterGroomersByService` and the `check-availability` edge function). One missing field, two safety nets gone. The fix is defence in depth — if any layer fails, the next one blocks.

### Layer 1 — Client (`src/components/BookingFlow.tsx`)
- Replace the `ilike('%name%')` service lookup with **exact match** on `name = resolvedServiceName` (the ilike was the original cause of races and ambiguous matches).
- In the submit handler: if the user is on the Grooming path and `currentServiceRecord?.id` is still null, **block submit** with a clear error ("Please re-select your service") and refetch — never fall through to a null insert.
- Wait for the `currentServiceRecord` query to be in `success` state (`isFetched && !isFetching`) before enabling the final Confirm & Pay button.

### Layer 2 — Server (`supabase/functions/check-availability/index.ts`)
- Require `service_id` for any request where `booking_source === 'online'` (or always, since the client always knows it). Return 400 if missing.
- Remove the `if (service_id)` wrapper around the `staff_services` check — always enforce: if the staff member has any rows in `staff_services`, the requested `service_id` must be one of them.

### Layer 3 — Database trigger: never accept a malformed online booking
A `BEFORE INSERT OR UPDATE` trigger on `bookings` that raises an exception when:
- `booking_source = 'online'` AND `service_id IS NULL`, OR
- `staff_id IS NOT NULL` AND `service_id IS NOT NULL` AND the staff has at least one `staff_services` row AND none of them matches the booking's `service_id`.

This is the last line of defence — even if a future code path forgets the guard, the database itself refuses the row. Staff-initiated bookings (manual override use case) keep working because the trigger only blocks `booking_source = 'online'` for the null-service case, and the staff_services rule is purely about consistency (staff with no rows = unrestricted, unchanged from today).

### Layer 4 — Retroactive cleanup (one-off)
Run the existing `service-id-integrity` heuristic backfill on the Mollie/Bohdan booking (and any other historical `service_id IS NULL` rows): match by `total_price` / `duration_minutes` / breed pricing, set the correct `service_id`, then reassign `staff_id` if the current groomer isn't allowed.

For the Mollie booking specifically:
- Set `service_id` = Full Groom (`be4f5259-…`).
- Since Bohdan isn't eligible, either reassign to a Full Groom groomer free on 19 May 14:30, or flag for manual reassignment in the inbox. Customer already paid in full → service must be honoured.

---

## Part 2 — Full booking-flow click tracking

A new table `booking_flow_events` capturing every meaningful interaction in `BookingFlow.tsx`. Each row has a `session_id` (one UUID per flow mount), a `step`, an `action`, a JSON payload, plus context (user-agent, referrer, customer email/phone once known). When the booking is finally inserted, all events for that session get backfilled with the new `booking_id` so the audit timeline is queryable per-booking.

### Tracked events
- `flow_started` — initial mount, with referrer + utm params
- `service_selected` — e.g. "Grooming"
- `sub_service_selected` — "Full Groom" / "Bath & Brush" (with resolved `service_id`)
- `breed_selected` — breed name + id
- `date_selected` — date
- `time_selected` — time + auto-assigned `staff_id`
- `bb_fallback_banner_shown` — when the "switch to Bath & Brush" banner appears
- `bb_fallback_banner_dismissed`
- `bb_fallback_banner_accepted` — clicked "Switch to Bath & Brush"
- `addon_toggled`
- `details_submitted` — final form submit, with the exact `service_id`, `staff_id`, `total_price`, `duration_minutes` about to be inserted
- `booking_created` — success, with `booking_id`
- `submit_blocked` — when a client guard refused to submit (with reason)

### UI surface
Add a "Customer Journey" tab to the existing booking detail dialog (`EditAppointmentDialog` / `BookingPopoverCard`) that shows a vertical timeline of these events for that booking, similar to the existing booking-lifecycle audit. So you can open any booking and see exactly what was clicked, when, and what state the flow was in.

---

## Technical details

### New table
```sql
booking_flow_events (
  id uuid pk,
  session_id uuid not null,           -- one per flow mount
  booking_id uuid null references bookings(id) on delete set null,
  customer_email text,
  customer_phone text,
  step text not null,
  action text not null,
  payload jsonb not null default '{}',
  user_agent text,
  referrer text,
  created_at timestamptz default now()
)
-- indexes on session_id, booking_id, created_at
-- RLS: insert allowed to anon (public booking flow); select only to staff/admin
```

### Backfill of booking_id
After the `bookings` insert succeeds in `BookingFlow.tsx`, run a single update:
`UPDATE booking_flow_events SET booking_id = $newId WHERE session_id = $sessionId AND booking_id IS NULL`.

### Trigger SQL (Layer 3)
```sql
CREATE FUNCTION enforce_booking_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.booking_source = 'online' AND NEW.service_id IS NULL THEN
    RAISE EXCEPTION 'Online bookings require a specific service_id';
  END IF;
  IF NEW.staff_id IS NOT NULL AND NEW.service_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM staff_services WHERE staff_id = NEW.staff_id)
       AND NOT EXISTS (SELECT 1 FROM staff_services
                       WHERE staff_id = NEW.staff_id AND service_id = NEW.service_id)
    THEN
      RAISE EXCEPTION 'Staff % is not assigned to service %', NEW.staff_id, NEW.service_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_booking_integrity_trg
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_booking_integrity();
```

### Files touched
- New migration: `booking_flow_events` table + RLS + trigger function `enforce_booking_integrity`.
- `src/components/BookingFlow.tsx` — exact-match service query, submit guard, event logging at each step, session_id generation, post-insert backfill.
- `supabase/functions/check-availability/index.ts` — require service_id, unconditional staff_services check.
- New tiny client helper `src/lib/logBookingFlowEvent.ts`.
- `src/components/booking-calendar/EditAppointmentDialog.tsx` (or a new sub-component) — "Customer Journey" timeline tab fed from `booking_flow_events`.
- One-off data fix for the Mollie booking (separate insert tool call after approval).

### Out of scope
- No change to `record-payment` or `cancel-booking-with-refund` (financial integrity rule).
- No change to staff-initiated bookings beyond the staff_services consistency check.
- No GA / Google Analytics work — tracking is stored in our DB so it's auditable per booking.

---

Approve and I'll execute it in this order: migration → edge function → client guards + tracking → audit-timeline UI → backfill the Mollie booking.
