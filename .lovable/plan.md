## Goal

Make `/admin/historical` a **live weekly performance dashboard** that always includes every current groomer and rebooking stats.

## Why it's broken today

The page reads only `wix_historical_bookings` (a one-off CSV import). Nothing writes to that table, so:
- New groomers never appear.
- Charts flatline at the migration cutover — live appointments live in `bookings`.

## Changes

### 1. Merge live + historical data (`useTimelineAnalytics.ts` + `useYoYAnalytics.ts`)

Fetch both sources in parallel and concatenate into one normalized row stream:

- **Historical:** `wix_historical_bookings` (unchanged fields).
- **Live:** page through `bookings` selecting `booking_date`, `status`, `total_price`, `final_charge`, `customer_email`, `staff:staff_id(name, commission_rate)`, `service:service_id(name)`.
- Map live rows to the existing `RawRow` shape:
  - year/month derived from `booking_date`
  - `booking_status`: `confirmed`/`completed` → `"Confirmed"`; anything containing `"cancel"` kept so cancellation logic still works
  - `price_charged`: `final_charge ?? total_price` (project's revenue source of truth)
- Carry an optional `_liveCommissionRate` per row; Wix rows fall back to 40%.
- No dedupe needed (Wix = pre-migration, live = post-migration).

### 2. Bucket everything by week (Mon–Sun)

Replace the year/month grouping with ISO-week bucketing:

- Key = Monday-of-week ISO date (e.g. `2026-05-25`).
- Label = `"26 May"` (Monday date, short month).
- Rolling avg becomes a **4-week rolling avg** instead of 3-month.
- Returning-customer logic uses week buckets instead of month buckets (an email seen in a previous week counts as returning).
- "Best week" highlight replaces "best month ever / this year".
- Cancellation rate, new vs returning, bookings-over-time charts all switch to weekly points.

### 3. Remove annual summary cards

Delete the `annualSummary` block from `YearOnYearTab.tsx` (the four 2024/2025/2026 cards). Keep the top KPI pills (Total Bookings, Revenue, Customers, Returning, Avg).
- Rename "Avg Monthly Revenue" → **"Avg Weekly Revenue"** and recompute over weeks.
- Replace "Showing all data from first booking to present" caption with a small week range (e.g. "Wk of 7 Jul 2024 → Wk of 26 May 2026 · always live").

### 4. Groomer Performance section

- Same weekly x-axis on each groomer's chart.
- Drop the hardcoded `EXCLUDED_GROOMERS = ["Kirsty Nails", "Lauren Nails"]` — the existing `groomer_visibility_settings` hide UI already handles this and a hardcode means new groomers need code changes.
- Per-row commission: live rows use the staff's `commission_rate`, Wix rows use 40% default; sum per week.
- New groomers appear automatically as soon as they have ≥1 confirmed/completed live booking.

### 5. Always-live (no Sunday cron needed)

React Query already refetches on mount and window focus. To make sure stale month-keyed cache is dropped:
- Rename query keys to `["timeline-weekly-v1"]` and `["yoy-weekly-v1"]`.
- Add `staleTime: 0` and `refetchOnWindowFocus: true`.

So every time you open the page (and every time you come back to the tab), it pulls fresh data — no waiting until Sunday.

## Files touched

- `src/components/historical/year-on-year/useTimelineAnalytics.ts` — merge sources, week buckets, per-row commission, drop exclude list, drop annualSummary export.
- `src/components/historical/year-on-year/useYoYAnalytics.ts` — same merge + week buckets.
- `src/components/historical/YearOnYearTab.tsx` — remove annual cards, rename "monthly" → "weekly" copy, update axis label.
- `src/components/historical/year-on-year/GroomerPerformanceSection.tsx` — no logic change, just inherits weekly data from the hook.
- `src/components/historical/year-on-year/TimelineHighlightsSidebar.tsx` — "Best month" → "Best week".

## Out of scope

- No DB migration, no edge function, no cron.
- No edits to `wix_historical_bookings`, `record-payment`, or `cancel-booking-with-refund`.
- No change to PDF export layout or the hide-groomer UX.

## Expected result

- Every chart shows a point per week, current week always included.
- Annual £ cards are gone.
- Brylee/Oksana lines continue into May/Jun '26 and beyond.
- Any newly hired groomer appears automatically once they take their first booking.
- Reload (or just switch tabs back) = latest numbers, no Sunday wait.
