Add a new `log_callback_request` action to the existing `phone-booking` edge function.

### What to build
1. **Action handler** inside `supabase/functions/phone-booking/index.ts` (after the existing `log_running_late` block and before the final `Unknown action` fallback).
2. **Input parsing** — read `customer_phone`, `customer_name`, `reason` from the request body.
3. **Phone fallback** — if `customer_phone` is empty/missing, search `bookings` for today's date where `customer_name ILIKE` the provided name and `status NOT IN ('Cancelled','No Show','Refunded')`, then use the matched row's `customer_phone`.
4. **Insert case** — create a row in `ai_inbox_cases` with:
   - `case_type: "callback_requested"`
   - `status: "unassigned"`
   - `caller_number` (from input or booking fallback, normalized if found)
   - `caller_name: customer_name`
   - `summary: "Customer called and needs a callback. Reason: " + reason`
5. **Graceful failure** — wrap the `ai_inbox_cases` insert in try/catch. If it fails, log the error but still return `{ success: true, message: "Callback request logged. Someone will call you back shortly." }`. The live call must never fail because of an inbox insert error.
6. **Logging** — add `console.log("[log_callback_request] starting", JSON.stringify(params))` at the start and `console.log("[log_callback_request] case created")` after successful insert.
7. **Return** — always return `{ success: true, message: "Callback request logged. Someone will call you back shortly." }`.

### Out of scope
- No changes to any other actions (`get_services`, `check_availability`, `create_booking`, `cancel_booking`, `get_appointments`, `log_running_late`).
- No frontend changes.
- No database migrations (the `ai_inbox_cases` table already exists).