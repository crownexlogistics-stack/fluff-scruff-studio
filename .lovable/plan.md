# Fix the Scruff chat widget

## What's wrong
The chat widget fails on every message. The backend logs show the AI provider rejecting the request:

`not_found_error: model: claude-sonnet-4-20250514`

The Scruff assistant still calls Anthropic directly with a model name that no longer exists on that account, so every reply falls back to "Oops, I got a bit tangled up!". Nothing else in the chat (live pricing, handoff emails, conversation logging) is broken — only the model call.

## Fix
Move the Scruff assistant onto the built-in Lovable AI gateway, the same route already used for the daily briefing and groomer briefing (which were fixed the same way). No provider key or billing setup needed, and it removes the dependency on the outdated Anthropic model name.

## Technical detail
In `supabase/functions/ai-grooming-assistant/index.ts`:
- Replace the `https://api.anthropic.com/v1/messages` call with the Lovable AI gateway chat endpoint using `LOVABLE_API_KEY`, keeping the same system prompt + live-data context and conversation history.
- Map the system prompt into a leading `system` message and read the reply from the standard chat-completions response shape instead of `data.content[0].text`.
- Keep all existing downstream logic untouched: handoff markers, escalation email, `scruff_handoffs` / `scruff_conversations` / `scruff_messages` writes, and the booking/call button flags.
- Surface clearer errors: 429 (busy, try again) and 402 (credits) get friendly messages rather than the generic tangled-up line.

## Verification
Deploy the function, send a "Check availability" message through the widget, and confirm a real reply plus a clean function log.
