

# Customer Email System: Confirmations, Reminders & In-App Inbox

## The Problem

Resend requires domain verification via DNS records, and Wix won't let you add those records for `fluffandscruff.co.uk`. This blocks all outgoing emails.

## The Solution

Use a temporary sender address (`onboarding@resend.dev`) with `Reply-To: info@fluffandscruff.co.uk` so emails go out immediately. When customers hit reply, their message lands in your real inbox. We also store a copy of every reply in an in-app inbox visible to you and your groomers.

Once you move your domain to a provider that supports custom DNS (e.g. Cloudflare, Namecheap, GoDaddy), we swap the sender back to `info@fluffandscruff.co.uk`.

---

## What Gets Built

### 1. Booking Confirmation Emails
When a customer completes a booking (from the website or when a manager creates one in the dashboard), they receive a confirmation email with:
- Dog name, service type, date and time
- Studio address and contact info
- A friendly "reply to this email if you need to change anything" line

### 2. Appointment Reminders (24h + 2h before)
A scheduled job runs every 15 minutes, checks for upcoming bookings, and sends:
- **24-hour reminder** the day before
- **2-hour reminder** on the day
Each booking is tracked so no duplicate emails are sent.

### 3. In-App Message Inbox
A new "Messages" page in the dashboard where managers and groomers can see customer replies. Replies arrive via a webhook that Resend calls when someone replies.

---

## Technical Details

### Database Changes

**New `booking_emails` table** (tracks what was sent to prevent duplicates):
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto-generated |
| booking_id | uuid | references bookings |
| email_type | text | 'confirmation', 'reminder_24h', 'reminder_2h' |
| sent_at | timestamptz | when email was sent |
| resend_id | text | Resend's email ID for tracking |

**New `customer_messages` table** (stores inbound replies):
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto-generated |
| booking_id | uuid | nullable, linked if we can match |
| from_email | text | sender's email |
| from_name | text | sender's name |
| subject | text | email subject |
| body | text | email body |
| is_read | boolean | default false |
| created_at | timestamptz | when received |

RLS: managers and directors can read/update all messages; groomers can read messages linked to their bookings.

### Edge Functions

**`send-booking-email`** (new):
- Accepts `booking_id` and `email_type`
- Fetches booking details from DB
- Sends via Resend with `from: "Fluff & Scruff Studio <onboarding@resend.dev>"` and `reply_to: "info@fluffandscruff.co.uk"`
- Records the send in `booking_emails`
- Called after booking creation (confirmation) and by the cron job (reminders)

**`send-reminders`** (new):
- Called every 15 minutes by a scheduled database job (pg_cron + pg_net)
- Finds bookings in the next 24h and 2h windows
- Skips any that already have a matching `booking_emails` row
- Calls `send-booking-email` for each

**`receive-reply`** (new, public webhook):
- Resend calls this URL when a customer replies
- Parses the inbound email payload
- Stores the message in `customer_messages`
- Tries to match to a booking by the sender's email

**Updates to existing functions:**
- `send-contract-email`: change `fromEmail` to use `onboarding@resend.dev` with `reply_to: "info@fluffandscruff.co.uk"`
- `send-test-email`: same change

### Frontend Changes

**New "Messages" page** (`/messages`):
- List of customer replies, newest first
- Each shows sender name, subject, body preview, timestamp, read/unread badge
- Click to expand full message
- Mark as read button
- Linked booking shown if matched

**Sidebar update:**
- Add "Messages" link with unread count badge under Management section

**Booking flow update:**
- After successful booking insert in `BookingFlow.tsx`, call `send-booking-email` with type `confirmation`
- Same for `NewBookingDialog.tsx` when manager creates a booking

**Dashboard booking update:**
- When a manager creates a booking via the calendar dialog, also trigger confirmation email

### Scheduled Job Setup

Enable `pg_cron` and `pg_net` extensions, then create a cron job that calls the `send-reminders` function every 15 minutes.

### Resend Webhook Setup (Manual Step)

After the `receive-reply` function is deployed, you'll need to:
1. Log into resend.com
2. Go to Webhooks
3. Add a webhook URL pointing to the `receive-reply` function
4. Select the "email.received" event (or configure an inbound domain if available on your Resend plan)

Note: Resend's inbound email feature may require a paid plan. If it's not available, replies still go to your `info@fluffandscruff.co.uk` mailbox normally; the in-app inbox would then be populated manually or via a future integration.

---

## Implementation Order

1. Update existing email functions to use temporary sender + reply-to header
2. Create `booking_emails` and `customer_messages` tables with RLS
3. Build `send-booking-email` edge function
4. Wire up confirmation emails in BookingFlow and NewBookingDialog
5. Build `send-reminders` edge function + set up the cron schedule
6. Build `receive-reply` webhook edge function
7. Build the Messages page and add it to the sidebar
8. Test the full flow end-to-end

