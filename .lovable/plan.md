## Add "Cancellation List" tab to AI Inbox

### 1. Database migration
Extend the `ai_inbox_cases.case_type` CHECK constraint to also allow `'cancellation_waitlist'`. Drop and recreate the constraint with the new value added.

### 2. Phone-booking edge function (`supabase/functions/phone-booking/index.ts`)
In the `log_callback_request` action (~line 1733):

- After computing `reasonTrimmed`, classify it:
  ```ts
  const isWaitlist = /cancellation list|cancellation|earlier|waitlist/i.test(reasonTrimmed);
  const caseType = isWaitlist ? "cancellation_waitlist" : "callback_requested";
  ```
- When `isWaitlist`, enrich the case by looking up the customer's next upcoming non-cancelled booking (by resolved phone, else by name) to capture:
  - dog name + breed
  - service name (join `services`)
  - appointment date/time
  Then set `dog_name`, `appointment_time`, and build a structured `summary` like:
  ```
  Wants to be contacted if an earlier slot opens.
  Dog: Bella (Cockapoo)
  Service: Full Groom
  Currently booked: Tue 3 Jun at 14:00
  Reason: <reason>
  ```
  If no booking found, fall back to the plain reason summary.
- Insert with the computed `case_type`. No other actions/paths change.

### 3. AI Inbox page (`src/pages/AIInboxPage.tsx`)
Frontend-only additions — no other tabs touched.

- Extend `CaseType` union with `"cancellation_waitlist"`.
- Add to `TAB_TYPES`: `waitlist: "cancellation_waitlist"`.
- Add to `RESOLUTION_OPTIONS.cancellation_waitlist`:
  - "Called — earlier slot offered"
  - "Called — no earlier slots available"
  - "Customer no longer needs earlier slot"
  - "No answer — will try again"
  - "Other"
- Add to `CASE_THEME.cancellation_waitlist` using teal:
  - `tabActive: "bg-teal-500 text-white border-teal-600"`
  - `tabIdle: "bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100"`
  - `border: "border-l-[4px] border-l-teal-500"` (spec: `#14B8A6` = `teal-500`)
  - `bg: "bg-teal-50 dark:bg-teal-950/20"` (spec: `#F0FDFA` = `teal-50`)
  - `badge: "bg-teal-500 text-white"`
- In `cardTheme()`, for unassigned `cancellation_waitlist`, override the default amber-left-border rule so the card uses **teal** left border with teal-50 background (per spec).
- Add a new tab button in both the mobile grid and desktop `TabsList` labelled **"Cancellation List"** with a `CalendarClock` (or `ListChecks`) icon, count = `unassignedCount("cancellation_waitlist")`.
- Add `<TabsContent value="waitlist">{renderTab("cancellation_waitlist", "Cancellation List")}</TabsContent>`.
- `renderTab` already handles unassigned + resolved + claim/resolve flows generically — no changes needed there.

### 4. Verification
- Build passes.
- Inserting a case with `case_type='cancellation_waitlist'` succeeds after the migration.
- New tab renders, claim flow moves item to My Cases, resolve dialog shows the 4 new options.

### Notes
- No changes to existing tabs, existing case types, claim logic, resolve logic, or any other edge functions.
- The amber left border requested in the spec text conflicts with the teal `#14B8A6` border requested two lines below; we follow the explicit hex (`#14B8A6` = teal) per the dedicated "tab colour" section.
