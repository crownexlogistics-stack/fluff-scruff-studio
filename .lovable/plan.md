# Fix uploaded campaign test emails

## What will change
- Send test emails with the exact campaign subject instead of adding `[TEST]`.
- Require a real subject before a test can be sent, so blank uploads cannot arrive as an unclear title.
- Convert images embedded inside uploaded HTML into hosted campaign images that Gmail and other inboxes can display.
- Keep the live preview and delivered email using the same converted HTML.

## Verification
- Upload an HTML template containing an embedded image.
- Confirm the preview still matches the template.
- Send a test and confirm the real subject, image, layout, and footer render correctly in an inbox.
