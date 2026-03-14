

# Replace old domain with fluffandscruff.co.uk

All links across the codebase still reference the old Lovable staging domain `fluff-scruff-studio.lovable.app`. These need to be updated to `fluffandscruff.co.uk`.

## Affected files (15 files, ~121 occurrences)

**Frontend (src/):**
- `src/components/error-reporting/ErrorReportModal.tsx`
- `src/components/marketing/EmailMarketingSection.tsx`
- `src/pages/StaffDetailPage.tsx`

**Edge Functions (supabase/functions/):**
- `send-contract-email/index.ts`
- `sign-document/index.ts`
- `ai-grooming-assistant/index.ts`
- `generate-campaign-email/index.ts`
- `send-deposit-request/index.ts`
- `create-customer-pay-link/index.ts`
- `analyse-error/index.ts`
- `notify-purchase-request/index.ts`
- `send-booking-email/index.ts`
- `send-reminders/index.ts`
- `daily-summary-email/index.ts`
- `send-migration-invite/index.ts`

## Change

Global find-and-replace: `fluff-scruff-studio.lovable.app` → `fluffandscruff.co.uk` in every file listed above. No logic changes — purely a domain string swap.

All edge functions will auto-redeploy after the update.

