# Fix the confusing "Login failed {}" screen

## What actually happened

Oksana's password was never rejected. At the time she tried, the sign-in service
stalled and the request timed out with an empty reply. The login screen doesn't
know what to do with an empty reply, so it printed `{}` under "Login failed".

Evidence from the sign-in service log for her account (ksiujone@gmail.com):
repeated sign-in requests ending in `request_timeout` / `context deadline
exceeded` rather than "wrong password". The backend is responding normally again
now (around 130ms), so this was a temporary stall — not an account problem.

## What to change

1. **Never show a blank or code-like error.** If the sign-in reply is empty,
   times out, or is a server-side failure (5xx), show:
   "Couldn't reach the studio system — check your connection and try again."
   Only show "Incorrect email or password" when the service actually says the
   credentials are wrong.

2. **Retry automatically.** On a timeout or server error, retry the sign-in up to
   two more times with a short pause before showing any message. Most stalls
   clear within seconds, so staff would simply be signed in.

3. **Retry button.** When all attempts fail, the message includes a "Try again"
   button so nobody has to retype their password.

4. **Apply to both login screens** — the main sign-in page and the booking-entry
   sign-in — so staff and customers get the same honest wording.

5. **Log it correctly.** A timeout should be recorded as a connection problem,
   not as "customer entered incorrect password", so future investigations aren't
   misled.

## Can this be prevented completely?

No — the stall was in the hosted sign-in service, not in the app. What we can
guarantee is that a stall no longer looks like a rejected password: the app
retries quietly and, if it still can't get through, says so plainly.

## Technical notes

- `src/pages/AuthPage.tsx` `handleLogin`: wrap `signInWithPassword` in a small
  retry helper (3 attempts, ~800ms backoff) that retries only when the error has
  no message, has an empty/`{}` message, or carries a 5xx / timeout status.
  Branch the toast on classified error kind: `invalid_credentials`,
  `rate_limited`, `network` (new), `unknown`.
- Same helper reused in `src/pages/BookingEntryPage.tsx` (line ~135).
- Keep the existing migrated-customer lookup path untouched; it must only run on
  a genuine `Invalid login credentials`.
- `logLoginEvent` gains a `LOGIN_UNAVAILABLE` event type for the network case.
- No backend, schema, or auth-configuration changes.
