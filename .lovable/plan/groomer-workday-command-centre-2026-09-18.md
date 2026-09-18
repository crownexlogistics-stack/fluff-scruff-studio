# Groomer workday command centre

## Goal
Redesign `/portal` around the groomer’s working day, not business analytics. Preserve all existing booking, payment, customer, messaging, earnings, assistant, permissions, and routing behaviour.

## What will change

### 1. My Day home
- Replace the generated motivational briefing with a concise live greeting, date, and factual daily summary.
- Show today’s appointment count, completed count, remaining count, and scheduled value from the logged-in groomer’s bookings.
- When today is empty, show the next real appointment and the number booked for the next calendar week; otherwise use an honest empty state.

### 2. Next appointment and today’s schedule
- Add a prominent next-appointment area using the next `Pending` or `Confirmed` booking in chronological order.
- Show available dog, customer, service, breed, booking notes, recent customer notes, and previous visit information.
- Make “Open appointment” use the existing booking interaction; retain the existing checkout/edit/payment controls rather than creating duplicate business logic.
- Add a chronological schedule with clear `Next`, `Upcoming`, `Completed`, `Cancelled`, and `No show` presentation based on existing statuses and current time.
- Make customer access use the existing profile-resolution rules, including phone-only and migrated customers.

### 3. Needs Me
- Consolidate real actionable items already supported by the application: missing deposits with the existing send-link action, unread customer conversations, and waiting AI inbox cases.
- Link every item to its working destination and show “You’re all caught up” only when every supported source is clear.
- Keep appointment/customer notes beside the relevant next appointment instead of treating all notes as alerts.

### 4. Assistant, earnings, performance, and customers
- Add a compact Assistant area linking to the existing operational chat with relevant prompts such as today’s schedule and next appointment.
- Make earnings prominent using `commission_records`, the existing source for groomer pay, with week, month, and all-time totals plus completed commission-record counts and a plain explanation.
- Replace “Your Career” and low-value retention cards with a restrained performance summary derived from completed appointments and commissions. Hide optional insights when there is not enough meaningful data.
- Add compact access to real upcoming/recent customers without duplicating the full booking calendar.
- Remove the weather card, activity-log browser, fluffy AI copy, large empty insight cards, and vanity career totals from the home screen. Existing specialist pages and data remain intact.

### 5. Groomer navigation
- Rename “My Portal” to “My Day”, “Groomer Assistant” to “Assistant”, “Bookings” to “My Bookings”, “Finance” to “My Earnings”, “Package Deals” to “Packages”, “Purchase Requests” to “Requests”, and “Blacklist” to “Blocked Customers”.
- Keep the two genuinely different communication tools clear as “Customer Messages” (SMS conversations) and “Email Inbox”; do not misleadingly merge their data or create dead links.
- Present existing destinations in warm, labelled groups with an orange active state and Fluff & Scruff branding. Keep Placements and all other working staff tools accessible.
- Replace the mobile header-only experience with a proper openable navigation drawer; keep sign-out and AI-inbox access available.

### 6. Visual hierarchy and mobile
- Use the existing cream, orange, dark brown, Fredoka One, and Nunito system, with fewer bordered cards and stronger spacing/type hierarchy.
- Keep the desktop page calm and scan-friendly; prioritize next appointment, schedule, Needs Me, Assistant, earnings, then performance on mobile.
- Use green only for completed/clear states and red only for genuine problems.

## Technical details
- Create one shared groomer-dashboard data hook so greeting, summary, next appointment, schedule, performance, and upcoming customers use the same live booking set.
- Scope all dashboard booking and customer data to the resolved logged-in `staffId`; preserve the existing full-calendar permission only on the bookings page.
- Reuse the current commission, deposit-link, customer-profile resolution, message-count, AI inbox, and booking-detail logic instead of duplicating calculations or writes.
- Do not add a new “in progress” state, average-duration claim, profile route, notification centre, or other unsupported feature.
- Keep the existing `/portal/*`, `/ai-inbox`, `/admin/packages`, `/placements`, and `/blacklist` routes valid.

## Verification
- Test a groomer with appointments and a groomer/day with none.
- Confirm completed appointments automatically advance “Next appointment”.
- Confirm schedule ordering, status labels, notes, previous visit, customer links, deposit actions, message/AI counts, and earnings against live records.
- Test desktop and mobile navigation, touch targets, empty states, permissions, sign-out, all existing groomer routes, and no owner-only financial information.
- Run the full project checks, then publish the verified portal update.
