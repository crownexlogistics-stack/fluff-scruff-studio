

The "Welcome to your first day!" greeting is showing because the AI briefing is failing silently and falling back to a generic message — OR the prompt isn't getting the right context about the groomer's history.

Let me investigate the briefing component and edge function to confirm.
<lov-tool-use id="toolu_vrtx_01Gpwk5PJ9ZD1fiS78oyXZc6" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/groomer/overview/MyDayWidget.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XRqsiTyJfb6RPGNzhuauao" name="code--search_files" integration-id="code" data="{\"query\": \"GroomerDailyBriefing\", \"include_patterns\": \"*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LuQGE2RYXNnbbJgtFrVjSx" name="code--search_files" integration-id="code" data="{\"query\": \"GroomerDailyBriefing\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BuTjX6jNKXhgCgTBMRw6kh" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/groomer/overview/CareerStats.tsx\"}">
</lov-tool-use>
Found it. `GroomerPortalPage.tsx` line 255 hardcodes `careerTotal={0}` — so the AI always thinks it's the groomer's first day and produces a "welcome to your first day" greeting. Let me confirm.
<lov-tool-use id="toolu_vrtx_01REm6KJwmCrsfyRaPyVvfbj" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/GroomerPortalPage.tsx\", \"lines\": \"240-270\"}">
</lov-tool-use>
Confirmed. The bug is exactly what I expected.

<lov-plan>

## Bug found

`GroomerPortalPage.tsx` line 255 passes `careerTotal={0}` as a hardcoded zero to `GroomerDailyBriefing`. That gets sent to the `groomer-briefing` edge function, which tells Claude "Career total dogs groomed: 0" — so the AI naturally writes a "welcome to your first day!" greeting for everyone, including groomers with hundreds of completed bookings.

The real career total is already calculated inside `CareerStats.tsx` (combining native `bookings` with status `Completed` + migrated Wix bookings). We just never pass it to the briefing.

## Fix

**1. `GroomerPortalPage.tsx`** — compute `careerTotal` once at the page level (so both `GroomerDailyBriefing` and `CareerStats` use the same number), then pass it down:
- Query `bookings` count where `staff_id = staffId` and `status = 'Completed'`
- Add migrated bookings count via the existing `useMigratedBookings(staffId)` hook
- Sum them, pass to `<GroomerDailyBriefing ... careerTotal={combinedTotal} />`

**2. `groomer-briefing/index.ts` (edge function)** — tighten the system prompt so it doesn't default to "first day" language when career total is 0 or missing. Only mention "first day" / "welcome to the team" if `careerTotal === 0` AND it's the groomer's actual first appointment ever. Otherwise just a normal warm morning greeting based on today's load.

**3. Optional polish** — also fix `CareerStats.tsx` to not double-query the same data (small refactor: lift the query up). Skip if it adds complexity — the briefing fix alone solves the user's complaint.

### Files changed
- `src/pages/GroomerPortalPage.tsx` — query career total, pass real number
- `supabase/functions/groomer-briefing/index.ts` — smarter prompt so 0/unknown ≠ "first day"

### Out of scope
Director's `DailyBriefingCard`, weather widget, other dashboard sections.

