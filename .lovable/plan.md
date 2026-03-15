

## Fix Rate Limiting in Both Campaign Send Functions

### Problem
Both `send-campaign` and `send-scheduled-campaigns` use `BATCH_SIZE = 10` with `Promise.all()`, firing 10 concurrent requests per second — far exceeding Resend's 2 req/sec limit, causing 496 out of 818 emails to fail with 429 errors.

### Changes

**File 1: `supabase/functions/send-campaign/index.ts`**
- Change `BATCH_SIZE` from 10 to 2
- Replace the inner `Promise.all(batch.map(...))` send loop with a sequential send pattern that includes 429 retry logic:
  - On 429: read `Retry-After` header (default 1s), wait that duration, retry up to 3 times
  - Only mark as failed after 3 consecutive 429s
  - On success or non-429 error: behave as before (log sent/failed)

**File 2: `supabase/functions/send-scheduled-campaigns/index.ts`**
- Same changes: `BATCH_SIZE = 2`, sequential sends within each batch, 429 retry with exponential backoff (max 3 attempts)

### Shared retry logic (in both files)

```text
for each batch of 2 emails:
  for each email in batch (sequentially, not Promise.all):
    attempt = 0
    while attempt < 3:
      call Resend API
      if 200 OK → log sent, break
      if 429 → read Retry-After (default 1s), wait, attempt++
      if other error → log failed, break
    if attempt == 3 → log failed "rate_limit_exceeded after 3 retries"
  wait 1000ms before next batch
```

### Post-deploy
- Deploy both functions
- Test by invoking `send-campaign` with 5 copies of `info@fluffandscruff.co.uk` to confirm zero 429 errors
- Wait for user confirmation before any retry of the 496 failed sends

### No database changes needed

