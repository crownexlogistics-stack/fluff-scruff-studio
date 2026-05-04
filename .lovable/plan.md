## Change the Bath & Brush suggestion to be date-specific and shorter

### Problem
The current banner runs a 14-day server sweep and suggests a different (earlier) date for Bath & Brush. When the user clicks "Switch", it jumps them to that other date, forcing them to re-pick the date they originally wanted. The banner is also too long.

### New behaviour
When the customer clicks a specific date in the calendar and there are **no Full Groom slots** on that exact date, check whether **Bath & Brush has slots on that same date**. If yes, show a short banner offering to switch the service (keeping the same date).

If Bath & Brush is also unavailable on that date, show nothing extra (just the existing "fully booked" message).

### Implementation (in `src/components/BookingFlow.tsx`)

1. **Replace the `earlierBBSuggestion` query** with a client-side computation tied to `selectedDate`:
   - Reuse `generateAvailableSlots` from `@/lib/availability` with `bathBrushDuration`, `bbServiceRecord.id`, the same `groomers`, `baseSchedules`, `allOverridesForDate`, `existingBookingsForDate`, and `staffServices` already loaded for the picked date.
   - Result: `bbSlotsOnSelectedDate: string[]`. Suggestion exists when `isFullGroomFlow && availableTimeSlots.length === 0 && bbSlotsOnSelectedDate.length > 0`.
   - Pick the earliest BB time as the headline time.
   - Reset `bbSuggestionDismissed` to false whenever `selectedDate` changes (so dismissal applies per date).

2. **Update `handleSwitchToBathBrush`** to keep `selectedDate` and `weekStart` unchanged — only set `setSelectedSub("Bath & Brush")` and clear `selectedTime`. Toast: "Switched to Bath & Brush — pick your time".

3. **Shorten the banner** (the block at lines ~1748–1799):
   - Remove the "Different service" pill, the long explanatory paragraph about Full Groom dates / days sooner, and the info box about what Bath & Brush includes.
   - New compact content:
     - Headline (one line): "No Full Groom available on {date} — but Bath & Brush is."
     - Sub-line (small): "Wash, blow-dry & brush-out (no haircut). From {earliest BB time}."
     - Two small buttons: "Switch to Bath & Brush" (primary) and a small "X" dismiss in the corner. Drop the wide "No thanks, keep Full Groom" button (the X handles dismissal).
   - Tighter padding (`p-3`), smaller heading (`text-sm`), single column layout.

4. **Delete the `find-earlier-bb-suggestion` edge function** (`supabase/functions/find-earlier-bb-suggestion/index.ts`) since it's no longer used.

### Files touched
- `src/components/BookingFlow.tsx` — replace query, update handler, shorten banner, reset dismissal on date change.
- `supabase/functions/find-earlier-bb-suggestion/index.ts` — delete.
