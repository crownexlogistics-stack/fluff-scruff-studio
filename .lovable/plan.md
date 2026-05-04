# Fix: Earlier Bath & Brush suggestion banner not showing

## Why it isn't working today

The banner compares the **earliest Full Groom day overall** with the **earliest Bath & Brush day overall**, and only shows if B&B is 2+ days earlier.

But Brylee, Lauren and Oksana **all do both Full Groom and Bath & Brush**. So on any day one of them is free, both services are available — the two "earliest" dates are nearly always the same day. Bohdan and Sevak (the B&B-only groomers) get drowned out by the FG-capable groomers' availability, and the banner condition is never met.

That's why testing as a Full Groom (Afghan Hound) on May 4 shows no banner even though Bohdan works Wednesday.

## The correct logic

We don't care about "overall earliest". We care about: **is there a day BEFORE the earliest Full Groom day where Bath & Brush is available?** Those are the days only the B&B-only groomers (Bohdan, Sevak) can save.

### New algorithm (in `BookingFlow.tsx`, replace the `earlierBBSuggestion` memo)

1. Loop forward day-by-day from tomorrow up to 14 days.
2. For each day, compute Full Groom slots (filtered by FG service id).
3. The first day with FG slots → that's `earliestFG`. Stop scanning FG.
4. Continue scanning earlier days only — i.e. **before `earliestFG`** — for B&B availability (filtered by B&B service id). The first earlier day with B&B slots wins.
5. If we find such a day at least **1 day earlier** than `earliestFG` (drop the 2-day gate to 1, since even 1 day sooner is meaningful), show the banner.
6. If no FG slot exists in 14 days, skip the banner (edge case — bigger problem).

In practice this means: walk forward, if day N has B&B but no FG, capture it as the candidate; the moment we hit a day with FG, stop and report the earliest captured B&B day.

### Code changes (single file)

**`src/components/BookingFlow.tsx`** — rewrite the `earlierBBSuggestion` useMemo (around lines 1226–1303):

```ts
const earlierBBSuggestion = useMemo(() => {
  if (!isFullGroomFlow) return null;
  if (!bbServiceRecord?.id || !currentServiceRecord?.id) return null;
  if (!groomers?.length || !baseSchedules) return null;
  if (!lookaheadOverrides || !lookaheadBookings) return null;
  if (isExistingCustomer && selectedStaffId) return null;

  const bbDuration = bbServiceRecord.duration_minutes ?? 60;
  const fgDuration = serviceDuration;

  let bbCandidate: { date: string; time: string; groomerName: string } | null = null;
  const cursor = new Date(lookaheadStart);

  for (let i = 0; i <= 14; i++) {
    const dateStr = fmtDate(cursor);
    const overridesForDay = lookaheadOverrides.filter(o => o.override_date === dateStr);
    const bookingsForDay = lookaheadBookings.filter(b => (b as any).booking_date === dateStr);

    // Does FG fit today? If yes, stop — earliest FG found.
    const fgSlots = generateAvailableSlots(
      cursor, fgDuration, groomers, baseSchedules,
      overridesForDay, bookingsForDay, 30,
      staffServices, currentServiceRecord.id,
    );
    if (fgSlots.length > 0) {
      if (!bbCandidate) return null; // FG available today/sooner — nothing to suggest
      const fgDate = dateStr;
      const bbDate = bbCandidate.date;
      const diff = Math.round(
        (new Date(fgDate + "T00:00:00").getTime() -
         new Date(bbDate + "T00:00:00").getTime()) / 86_400_000
      );
      if (diff < 1) return null;
      return { ...bbCandidate, fullGroomDate: fgDate, daysSooner: diff };
    }

    // No FG today — is B&B available?
    if (!bbCandidate) {
      const bbSlots = generateAvailableSlots(
        cursor, bbDuration, groomers, baseSchedules,
        overridesForDay, bookingsForDay, 30,
        staffServices, bbServiceRecord.id,
      );
      if (bbSlots.length > 0) {
        const g = findFreeGroomer(
          bbSlots[0], bbDuration, cursor, groomers, baseSchedules,
          overridesForDay, bookingsForDay, staffServices, bbServiceRecord.id,
        );
        bbCandidate = { date: dateStr, time: bbSlots[0], groomerName: g?.name || "one of our groomers" };
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}, [isFullGroomFlow, bbServiceRecord, currentServiceRecord?.id, groomers, baseSchedules, lookaheadOverrides, lookaheadBookings, isExistingCustomer, selectedStaffId, serviceDuration, staffServices, lookaheadStart]);
```

No other files need to change — JSX banner, switch handler, dismiss state and queries remain as they are.

## Result

Booking a Full Groom on Mon May 4: if FG-capable groomers are full or off until (e.g.) Friday, but Bohdan works Wednesday, the banner correctly appears on the calendar step offering Wednesday's Bath & Brush with Bohdan, with the same "not a Full Groom" warning copy.
