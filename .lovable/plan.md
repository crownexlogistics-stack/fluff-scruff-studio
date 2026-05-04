# Reposition Bath & Brush suggestion

Make the suggestion banner less pushy. Instead of appearing at the top of the calendar step automatically, it only shows **after the user picks a date that has no Full Groom availability** — and renders **under the calendar / time-slots area**.

## Changes — `src/components/BookingFlow.tsx`

1. **Remove** the existing banner block at the top of the `step === "calendar"` view (lines ~1620–1673).

2. **Insert** the same banner block (unchanged styling and copy — no groomer name) inside the `selectedDate` branch of the time-slots section (~line 1789), wrapped so it only renders when:
   - `isFullGroomFlow === true`
   - `!verifyingSlots` (avoid flicker while checking)
   - `availableTimeSlots.length === 0` (the chosen date is fully booked for Full Groom)
   - `earlierBBSuggestion` exists
   - `!bbSuggestionDismissed`

3. Place it directly below the existing "We're fully booked on this date — please choose another day" line, with a small top margin (`mt-4`).

## Result

- User picks a date → if Full Groom is available, no suggestion shown at all.
- User picks a fully-booked date → the "fully booked" message appears, and **below it** the Bath & Brush suggestion offers an earlier alternative as a soft option (still dismissible, still has "No thanks, keep Full Groom").
- The banner no longer dominates the top of the calendar step.
