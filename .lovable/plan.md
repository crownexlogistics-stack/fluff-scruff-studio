## Goal

1. Let groomers split the remaining balance at checkout between **Cash** and **Card** (any combination, including £0 of one). The dialog adds the two together and validates `deposit + cash + card == total_price`, flagging an anomaly exactly like today if it doesn't.
2. Give the admin a **Money Flow** section on the Finance page (weekly / monthly / yearly) that reconciles all card+deposit income, all cash income marked by groomers, payouts paid by transfer vs cash, and shows the cash balance the salon should be holding.
3. Make it work for past data automatically (backdated) using existing booking + payout records.

---

## 1. Checkout dialog — Cash + Card split

File: `src/components/booking-calendar/CheckoutDialog.tsx`

Replace the single `Final charge` field with **two inputs** in the "complete" step:

```text
Remaining balance: £42.00 (Total £52 – Deposit £10)

Cash collected  £ [ 10.00 ]
Card collected  £ [ 32.00 ]
─────────────────────────────
Paid in total   £ 42.00   ✓ Matches remaining
                          ⚠ Short by £5 / Over by £3
```

- Both fields default to `0`; the user can put any amount in either.
- Live sum line shows `cash + card` with a green tick if it equals the remaining balance, an amber warning if it's short, a blue note if it's over (tip from customer / overcharge).
- The existing anomaly logic stays: `final_charge = cash + card`. If `(deposit_paid + final_charge) != total_price` within ±£2, the booking is flagged `payment_anomaly = true` exactly as today — admin sees it in the Anomalies tab unchanged.
- The "Final charge to customer" wording is removed; the breakdown above replaces it.

`onComplete` signature becomes:
```
onComplete(bookingId, cashAmount, cardAmount, isOwnCustomer)
```
with `final_charge = cash + card` computed inside the mutation.

Update the two call sites:
- `src/pages/BookingsPage.tsx` (admin)
- `src/components/groomer/GroomerBookingsTab.tsx` (groomer)

In each `completeMutation`, write to `bookings`:
- `final_charge = cash + card` (unchanged math)
- `cash_collected = cash`
- `card_collected = card`
- `payment_method = 'cash' | 'card' | 'split'` (derived: whichever is non-zero, or `split` if both)

And mirror `cash_collected` / `card_collected` onto `commission_records` so Finance can sum them without re-joining bookings.

A small DB migration adds the new columns (nullable, default 0) and the matching columns on `commission_records`. Legacy rows stay NULL and are treated as card.

---

## 2. Money Flow tracker on Finance page

New tab on `FinancePage.tsx` called **Money Flow** + a small summary card at the top of the existing payouts view.

Component: `src/components/finance/MoneyFlowTab.tsx`

Period selector: **Weekly / Monthly / Yearly** (independent of payout selector).

```text
MONEY IN                 MONEY OUT              CASH ON HAND
Deposits (card)  £…      Transfer payouts £…    Cash collected £…
Card balances    £…      Cash payouts     £…    – Cash payouts £…
Cash balances    £…                             = Should hold  £…
────────────────         ────────────────       ────────────────
Total in £…              Total out £…           Difference vs
                                                recorded cash £…
```

### Sources (all already in DB, so backdated works automatically)

- **Deposits (card)** = `bookings.deposit_paid` in period + `customer_pay_links.amount` where `status='paid'` in period.
- **Card balances** = `bookings.card_collected` (NULL legacy → `final_charge`) for completed bookings in period.
- **Cash balances** = `bookings.cash_collected` (NULL legacy → 0) for completed bookings in period.
- **Transfer payouts** = `groomer_payout_history.payout_amount` where `payment_method='bank_transfer'` in period.
- **Cash payouts** = `groomer_payout_history.payout_amount` where `payment_method='cash'` in period.

A **By-groomer** subsection lists each groomer's cash collected this period and cash paid out this period, so the admin can see who is sitting on cash and confirm hand-over.

### Connection to Payout History

`PayoutHistoryTab` gets two extra summary chips at the top: **Paid by transfer** and **Paid in cash**, using the existing `payment_method` on `groomer_payout_history`.

---

## 3. Database migration

```sql
ALTER TABLE bookings
  ADD COLUMN cash_collected numeric DEFAULT 0,
  ADD COLUMN card_collected numeric DEFAULT 0;

ALTER TABLE commission_records
  ADD COLUMN cash_collected numeric DEFAULT 0,
  ADD COLUMN card_collected numeric DEFAULT 0;
```
`payment_method` already exists on `bookings`. Existing data untouched — legacy completed bookings are treated as 100 % card in Money Flow.

---

## Technical summary

- `CheckoutDialog.tsx`: replace single charge input with cash + card inputs, live sum, validation hint, new `onComplete` signature.
- `BookingsPage.tsx` + `GroomerBookingsTab.tsx`: persist `cash_collected`, `card_collected`, `payment_method`, `final_charge = cash + card`. Anomaly logic unchanged.
- New `MoneyFlowTab.tsx` registered on `FinancePage.tsx`, with three-column reconciliation + per-groomer cash breakdown via parallel `useQuery`s.
- `PayoutHistoryTab.tsx`: add transfer/cash split chips.
- One migration adds 2 columns on `bookings` and 2 on `commission_records`.
- No changes to `record-payment` / `cancel-booking-with-refund` (financial-integrity rule).