# Blacklist (banned customers)

A new **Blacklist** section in the staff sidebar so any staff member can ban a customer from booking — online, by phone, or through the AI receptionist — and keep a permanent, audited record of who banned them, when, and why.

## What staff will see

New sidebar item **Blacklist** (visible to every staff member, admin and groomer portals) with two tabs:

**1. Make a new record**
- Search box: name, surname, email or phone number.
- Results list customers from bookings, migrated customers and profiles (same search already used elsewhere).
- Each result has a **Blacklist this account** button.
- Clicking it opens a pop-up with a free-text **Reason** box (required). Saving moves that account into the historic list immediately.

**2. Historic record**
- Every blacklisted account with: name, email, phone, the reason note, date and time, and the staff member who did it.
- **Remove from blacklist** button → pop-up asking for a free-text reason → the record moves to a third **Unblocked** list.

**3. Unblocked (audit)**
- Previously blacklisted accounts kept forever for audit: original reason, who banned and when, the unban reason, who unbanned and when.

## How the ban works

Matching is on **email and phone number only** — never on name, since two people can share a name. Phone numbers are compared in a normalised form (spaces, dashes and 07/+44 variants all treated as the same number), so someone can't slip through by typing their number differently.

Blocked at three points:
- **Online booking** — when the booking is submitted (and at the customer-details step), the customer sees a neutral message: *"Sorry, something went wrong on our side. Please try again later or call the salon."* No mention of a blacklist, ever.
- **Phone / AI receptionist booking** — the AI declines to take the booking and logs it, again without revealing the reason.
- **Staff-created bookings** — the calendar's new-appointment screen shows a clear red banner *"This customer is on the blacklist"* with the reason, and blocks saving. This is deliberate: staff should know, customers should not.

Every blocked attempt is recorded so you can see if a banned person keeps trying.

## Technical detail

**New table `customer_blacklist`** (public schema, with GRANTs):
`id`, `customer_name`, `email` (lowercased, nullable), `phone_normalised` (nullable), `phone_raw`, `reason`, `blacklisted_by_staff_id`, `blacklisted_by_name`, `created_at`, `status` ('active' | 'removed'), `removed_reason`, `removed_by_staff_id`, `removed_by_name`, `removed_at`. Partial unique indexes on email and phone_normalised where status = 'active'. Rows are never deleted — unbanning flips `status`.

**New table `blacklist_block_events`**: which identifier matched, channel (online / phone / staff), timestamp — for the "they keep trying" view.

**RLS**: all staff roles (groomer, manager, director) may select and insert; update (removal) allowed for the same roles; no anon/customer access at all.

**Normalisation helper** `public.normalise_phone(text)` (immutable) mirroring the logic already used in `attribute_booking_to_campaign`, plus a matching TypeScript helper so client and server agree.

**Server-side enforcement** is the real gate — a new edge function `check-blacklist` (service-role, called from the booking submit path and from `phone-booking` / `ai-receptionist` before a booking is created). The client check is only for the friendly message; the block cannot be bypassed by editing the page.

**Files touched**
- New: `src/pages/BlacklistPage.tsx`, `src/components/blacklist/BlacklistSearchTab.tsx`, `HistoricListTab.tsx`, `UnblockedTab.tsx`, `BlacklistReasonDialog.tsx`, `src/lib/phoneNormalise.ts`, `supabase/functions/check-blacklist/index.ts`.
- Edited: `src/App.tsx` (route `/blacklist`), `src/components/AppSidebar.tsx` and `src/components/GroomerLayout.tsx` (nav item), `src/components/BookingFlow.tsx` (pre-submit check + neutral error), `src/components/booking-calendar/NewBookingDialog.tsx` and `src/components/customer-profile/NewAppointmentDialog.tsx` (staff warning + block), `supabase/functions/phone-booking/index.ts` and `supabase/functions/ai-receptionist/index.ts` (decline politely).

## Open decision

Staff-created bookings are **blocked** for blacklisted customers in this plan (with the reason shown to staff). If you'd rather let a manager override and book anyway, say so and I'll add a manager-only override.
