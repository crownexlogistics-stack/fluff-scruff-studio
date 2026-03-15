

## Plan: Increase Bulk SMS Batch Delay

**Change**: Update `DELAY_MS` from `500` to `1000` in `supabase/functions/send-bulk-sms/index.ts` (line 14).

This single constant controls the pause between each batch of 5 messages. Doubling it to 1000ms will reduce the request rate from ~10/sec to ~5/sec, avoiding the Twilio 401/429 auth rejections seen in the last campaign.

