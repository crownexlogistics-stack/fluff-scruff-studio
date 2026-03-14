

# Fix: Groomer can't see full profile of their own customers

## Problem

Two related issues:

1. **Customer Profile access**: When Brylee opens a customer profile (e.g. Kadee Louise), the system checks if any booking for that customer is assigned to Brylee **within the current pay week**. If Kadee's last appointment was before this week, Brylee is treated as "not the assigned groomer" and sees only a limited view saying "Last groomed by Brylee" — which is obviously wrong since she IS Brylee.

2. **Search bar "Your customer" badge**: The search uses `staff_id` comparison against the most recent booking, which works but doesn't help when the profile itself blocks access.

## Root cause

Lines 168-189 in `CustomerProfilePage.tsx` restrict groomer access to customers who have a booking **in the current pay week or later**. This is too restrictive — if Brylee groomed Kadee last week, she can't see the profile this week.

## Fix

Expand the groomer access window from "current pay week" to a more practical range: any booking in the **last 90 days or any future booking**. This way groomers retain access to their recent customers while still preventing access to customers they haven't seen in months.

### Changes

**`src/pages/CustomerProfilePage.tsx`** (lines ~170-187):
- Replace the `payWeekStart` date calculation with a 90-day lookback window
- Update both `hasLiveAssignedAccess` and `hasWixAssignedAccess` to use `booking_date >= ninetyDaysAgo` instead of `booking_date >= payWeekStartIso`

This is a ~5 line change in one file. No database or edge function changes needed.

