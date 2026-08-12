# Fix Scruff chat "Lab on Wednesday" hallucination

## What actually happened

Two bugs in the availability path of the chat assistant, both triggered by the single tap on "📅 Check availability":

1. **"your Lab"** — breed detection uses a plain substring match. The word **avai-lab-ility** contains "lab", which is in the breed list as Labrador (large). So the assistant was told the customer has a large Labrador. Any word containing a breed name (e.g. "collie", "pug", "boxer") can do the same.
2. **"Wednesday"** — when no date is mentioned, the code silently defaults the requested date to **today**, which was Wednesday. It then ran a real availability check for today for a 2-hour large-dog full groom, found nothing, and reported "no availability Wednesday".

So it wasn't invented by the model — the backend fed it a wrong breed and a wrong date.

## The fix

1. **Word-boundary breed matching**
   Match breed names only as whole words/phrases, so "availability" no longer matches "lab". Also skip very short aliases ("lab", "gsd", "pug") unless they appear as standalone words.

2. **Never assume a date**
   If the message contains no date reference at all (no "today", "tomorrow", weekday, or explicit date), do not run an availability check for today. Instead pass a note telling the assistant to ask which day and which dog/breed they'd like, and offer the booking link.

3. **Never assume a breed/service**
   Only pass breed and service context when the customer has actually mentioned one. Otherwise the assistant should ask rather than assume a "large full groom, 120 mins".

4. **Tighten the availability trigger words**
   Keywords like "next" and "free" fire far too easily. Require an explicit availability intent (availability/slot/when can/book a time) or a date reference.

## Technical detail

All changes in `supabase/functions/ai-grooming-assistant/index.ts`:

- `detectBreedSize` / `detectBreedName`: replace `lower.includes(breed)` with a regex `\b<breed>\b` test (escaped), and keep the longest-match-first ordering.
- Availability block (~line 519-605): introduce `hasExplicitDate`. When false, set `availabilityContext` to an "ASK THE CUSTOMER" instruction instead of calling `checkDetailedAvailability`.
- `breedContext` and service-duration wording only emitted when a breed was genuinely detected.

No UI changes; the quick-reply button stays as-is but now produces a clarifying question instead of a fabricated answer.
