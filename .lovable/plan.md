## Goal

When a customer is booking a **Full Groom** and the next available date is several days away, scan for **earlier Bath & Brush** availability from groomers who offer it (e.g. Bohdan who only does B&B) and surface a clear, friendly suggestion banner — making it visually impossible to confuse with a Full Groom booking.

## How it will work

1. The customer picks **Full Groom** and lands on the calendar step as today.
2. In the background we compute:
   - The **earliest Full Groom date** with at least one available slot (already known — current calendar logic).
   - The **earliest Bath & Brush date** with available slots, using the same availability engine but with the B&B `service_id` and B&B duration (so groomers like Bohdan, who are only linked to B&B in `staff_services`, are included).
3. If the earliest B&B date is at least **2 days earlier** than the earliest Full Groom date (threshold configurable, default 2 days), show a distinct **suggestion card** at the top of the calendar step.

## The suggestion card (visual + copy)

Friendly, warm, unmistakably a *different* service offer — uses the brand orange `#FF6B35` outline, a "Different service" pill, and a paw/scissors icon. Example copy:

> 🛁 **Earlier opening — but it's a Bath & Brush, not a Full Groom**
>
> The next Full Groom we have for [Dog Name] is **Saturday 9 May**. If you'd like to bring [Dog] in sooner, we have a **Bath & Brush** available on **Tuesday 5 May at 10:30am** with Bohdan.
>
> Bath & Brush is a wash, blow-dry and brush-out — it does **not** include a haircut, scissor work or styling.
>
> [ Switch to Bath & Brush ]   [ No thanks, keep Full Groom ]

Tapping **Switch to Bath & Brush** changes the in-flow service to B&B (re-uses the existing `selectedSub` switch logic that already exists for puppy switching), recalculates duration/price, and jumps the calendar to that earlier date with the slot pre-highlighted. The customer still has to confirm and pay — so the booking is unambiguously a B&B in the database, in the email confirmation, and in the calendar.

If they tap **No thanks**, the banner is dismissed for this session and the Full Groom flow continues unchanged.

## Where the calculation runs

In `src/components/BookingFlow.tsx`, alongside the existing `clientSideSlots` memo. We add a second memo `earlierBathBrushSuggestion` that:

- Only runs when `serviceType === "Full Groom"`.
- Fetches the B&B service record (id + duration) once.
- Loops forward day-by-day from tomorrow up to the customer's currently-selected/earliest Full Groom date, calling the existing `generateAvailableSlots()` from `src/lib/availability.ts` with the B&B `service_id` and duration. The first day with a slot wins.
- Returns `{ date, time, groomerName }` or `null`.

This re-uses the exact same engine the rest of the booking system uses — so `staff_services` already filters Bohdan in for B&B and out for Full Groom, working hours/blocks/overrides/existing bookings are respected, and there is no risk of suggesting an actually unavailable slot. Final booking still goes through the server-side `check-availability` edge function, so it's bulletproof.

## Safety / no-confusion guarantees

- Different colour and explicit "**Bath & Brush, not Full Groom**" header.
- Plain-English explanation that there is **no haircut**.
- Two clear buttons — no auto-switch.
- The cart summary, confirmation page and email already display the chosen service name, so once switched it shows "Bath & Brush" everywhere.

## Files to change

- `src/components/BookingFlow.tsx` — add suggestion memo + banner UI on the `calendar` step + handler that switches `selectedSub` to "Bath & Brush" and pre-selects the suggested date/time.
- (No changes needed to `src/lib/availability.ts`, edge functions, or the database — the engine already supports per-service filtering.)

## Out of scope

- No new admin toggle (uses existing `staff_services` assignments which already define who does what).
- Reverse direction (suggesting Full Groom to a B&B customer) — not requested.
