

# Ad-Hoc Pay Links from Customer Profile

## What We're Building

A new "💳 Pay Links" tab on the customer profile page where admins (and groomers for their own customers) can generate standalone Stripe payment links for any amount, with optional notes. These are independent of bookings — for forgotten charges, off-system grooms, etc.

The system tracks each pay link's status live from Stripe (pending → paid), shows history per customer, and feeds into the finance/dashboard revenue.

## Database

### New table: `customer_pay_links`

```sql
CREATE TABLE customer_pay_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  amount NUMERIC NOT NULL,
  notes TEXT,
  stripe_payment_link_id TEXT,
  stripe_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, paid, expired
  paid_at TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE customer_pay_links ENABLE ROW LEVEL SECURITY;

-- Directors/managers: full access
CREATE POLICY "Directors and managers can manage pay links"
ON customer_pay_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Groomers: read their own created links
CREATE POLICY "Groomers can view own pay links"
ON customer_pay_links FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Groomers can insert pay links"
ON customer_pay_links FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
```

### New edge function: `create-customer-pay-link`

- Accepts: `customer_email`, `customer_name`, `amount`, `notes` (optional)
- Creates a Stripe product + price + payment link for the amount
- Sends the link via email (Resend) to the customer
- Inserts into `customer_pay_links` with `stripe_payment_link_id` and `stripe_url`
- Records audit log
- After-completion redirect URL includes the pay link ID for status tracking

### New edge function: `check-pay-link-status`

- Accepts: `pay_link_id` (our UUID)
- Looks up the `stripe_payment_link_id`, queries Stripe for completed sessions
- If a completed session is found, updates status to `paid` and sets `paid_at`
- Returns current status

### UI: New "Pay Links" tab on CustomerProfilePage

Added next to the Email tab. Contains:

1. **Generate form**: Amount input (£), optional notes textarea, "Generate & Send" button
2. **History list**: All pay links for this customer, showing amount, date sent, status badge (🟡 Pending / 🟢 Paid with date), notes, and a "Check Status" button that calls `check-pay-link-status`

### Finance Integration

The Finance page revenue query will be updated to also sum `paid` entries from `customer_pay_links` within the period, so ad-hoc payments appear in revenue totals alongside booking payments.

### Dashboard Integration

Dashboard revenue cards will include paid pay links in their totals.

## Files to Create
- `supabase/functions/create-customer-pay-link/index.ts`
- `supabase/functions/check-pay-link-status/index.ts`
- Migration SQL for `customer_pay_links` table + RLS

## Files to Edit
- `src/pages/CustomerProfilePage.tsx` — add Pay Links tab with form + history
- `src/pages/FinancePage.tsx` — include pay link revenue in totals
- `src/integrations/supabase/types.ts` — will auto-update after migration

## Not Modified
- `record-payment`, `cancel-booking-with-refund`, or any existing booking logic

