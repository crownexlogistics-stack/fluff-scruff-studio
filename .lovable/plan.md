# Adding a dog to a customer fails for some customers

## What happened, in plain English

When Oksana opens a customer's profile and clicks "Register Dog", the app has to attach the dog to a real customer account.

Two kinds of customers don't have a real account behind them:

1. Customers who came across from the old Wix system and never set a password (64 of them today). The app hands the dog record an ID that isn't a real account, and the database refuses it with a technical error.
2. Customers with no email on file (phone-only). The app can't find any account at all and shows "Unable to link customer profile".

So the error is not a permissions problem — Oksana is allowed to add dogs. It's that the dog can only be saved against a real customer account, and these customers don't have one.

## How to fix it

Let a dog be saved against a customer who has no account yet, and make the error messages plain instead of technical.

- Before saving, check whether the ID we have is a real customer account. If it isn't, save the dog against the old-system customer record instead.
- Allow dogs to be stored for old-system/phone-only customers so they show up on the profile and in booking screens exactly as they do now.
- Replace the raw database error with a clear message telling Oksana what to do.

## Technical section

Cause confirmed by reading the code and the database:

- `src/pages/CustomerProfilePage.tsx` (Register Dog, ~line 2144) inserts into `customer_pets` with `user_id: customerUserId`, where `customerUserId` comes from `rpc("get_user_id_by_email")`.
- `get_user_id_by_email` falls back to `migrated_customers.supabase_user_id`, and then to `migrated_customers.id`. That last fallback is not an `auth.users` id.
- `customer_pets.user_id` has `FOREIGN KEY ... REFERENCES auth.users(id)`, so the insert fails with a foreign-key violation for any migrated customer with no auth account (64 rows have `supabase_user_id IS NULL`).
- RLS is fine: policy "Groomers can insert pets for any customer" allows `has_role(auth.uid(),'groomer')`.
- Phone-only profiles resolve `customerUserId` to null, which triggers the existing "Unable to link customer profile" toast.

Planned changes:

1. Migration on `public.customer_pets`:
   - add nullable `migrated_customer_id uuid references public.migrated_customers(id) on delete cascade`
   - make `user_id` nullable and add a check that exactly one of `user_id` / `migrated_customer_id` is set
   - add RLS policies mirroring the existing groomer/manager/director policies for the new column path; customer-owned policies stay unchanged
2. `CustomerProfilePage.tsx`:
   - resolve whether the profile is backed by an auth user or a `migrated_customers` row (the page already loads `migratedCustomer`), and insert with the matching column
   - fetch pets by either key in the `customer-profile-pets` query
   - wrap the insert error with `friendlyError` plus a specific message when no customer record can be resolved at all
3. Verify other readers of `customer_pets` (`MyPetsPage`, `BookingFlow`, `BookingEntryPage`, `AdminPetTools`) still behave, since those paths are auth-user based and unaffected.
