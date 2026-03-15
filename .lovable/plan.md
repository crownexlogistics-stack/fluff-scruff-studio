

# Why Only 592 of 816 Emails Were Sent

## Root Cause

The `send-campaign` edge function **timed out** before processing all 816 emails. Edge functions have a maximum execution time (~60 seconds), and with rate-limiting delays (1 second between batches of 2), sending 816 emails would take ~7+ minutes — far exceeding the timeout.

The campaign was invoked multiple times (logs show sends from 11:05 to 14:00), accumulating 592 successful sends. But ~224 emails were **never attempted** — they aren't logged as "sent" or "failed", they simply weren't reached before each timeout.

The "Retry Failed" button can't help because these emails were never logged as "failed" — they just weren't processed at all.

## Fix: Chunked Sending with Progress Tracking

### Changes

1. **`send-campaign` edge function** — Before sending, check which emails already have a `sent` log entry for this campaign and skip them. This way, each re-invocation picks up where the last one left off instead of re-starting from the beginning.

2. **Frontend `EmailMarketingSection.tsx`** — After a send completes, check if all recipients were processed. If not (due to timeout), automatically show a "Continue Sending" option or auto-retry the remaining unsent emails.

3. **Add a "not_attempted" awareness** — When the function finishes (or times out), the frontend can compare `sent + failed + skipped` vs `total` to detect incomplete sends and surface a "X emails remaining" indicator.

### Technical Detail

**Edge function change** (most impactful):
```
// Before sending, get already-sent emails for this campaign
const { data: alreadySent } = await supabase
  .from("campaign_send_log")
  .select("email")
  .eq("campaign_id", campaignId)
  .in("status", ["sent", "skipped"]);

const alreadySentSet = new Set(
  (alreadySent || []).map(r => r.email.toLowerCase())
);

// Filter out already-processed emails
const remainingEmails = validEmails.filter(
  e => !alreadySentSet.has(e.toLowerCase())
);
```

**Frontend change**: After send mutation succeeds, compare `result.sent + result.skipped + result.failed` against `effectiveList.length`. If there's a gap, show a toast with a "Continue Sending" button that re-invokes the same campaign. This creates an automatic resume loop until all emails are processed.

### Result
- Each invocation resumes from where the last left off
- No duplicate sends
- Full 816 emails will be delivered across multiple automatic retries
- Clear UI feedback on progress

