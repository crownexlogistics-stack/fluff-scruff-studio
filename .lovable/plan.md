

# Fix: Include Migrated Wix Customers in Messages

## Problem

The Messages page (both admin and groomer views) only queries the `bookings` table for customers. The 812 migrated Wix customers exist in `migrated_customers` (with phone numbers) and their booking history is in `migrated_bookings` — but neither table is queried by the messaging feature. This means:

- Admins cannot find or message any Wix-migrated customer
- Groomers cannot see customers they previously groomed (via Wix) in their message list

## Solution

Update the customer-fetching queries in both `MessagesPage.tsx` and `GroomerMessagesTab.tsx` to also pull from `migrated_customers` (joined with `migrated_bookings` for groomer filtering), then merge and deduplicate by phone number.

## Changes

### 1. `src/pages/MessagesPage.tsx` — Admin/Manager customer query

After fetching from `bookings`, also fetch from `migrated_customers` where phone is not null. For groomers, join through `migrated_bookings` filtering by `staff_name` (since migrated bookings use staff_name, not staff_id). Merge both sets into the same `Map<phone, CustomerContact>`, with the `bookings` record taking priority (newer data).

### 2. `src/components/groomer/GroomerMessagesTab.tsx` — Groomer customer query

Same approach: fetch the groomer's `staff.name`, then query `migrated_bookings` joined with `migrated_customers` where `staff_name` matches. Merge with existing bookings-based customers, deduplicating by phone.

### 3. No database changes needed

Both `migrated_customers` and `migrated_bookings` already have appropriate RLS policies — directors/managers have full access, and customers can read their own records. The edge function uses a service role key so queries will work. The frontend queries run as authenticated users with manager/director/groomer roles which already have SELECT access to both tables.

## Technical Detail

```text
Current flow:
  bookings → Map<phone, customer> → customer list

New flow:
  bookings → Map<phone, customer>
  migrated_customers (+ migrated_bookings for groomers) → merge into same Map
  → deduplicated customer list
```

For groomers: `migrated_bookings.staff_name` will be matched against the groomer's `staff.name` to filter relevant migrated customers. The bookings entry takes priority if both exist (same phone), ensuring the most up-to-date name/email is shown.

