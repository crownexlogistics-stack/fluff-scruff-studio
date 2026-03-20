INSERT INTO public.audit_logs (action, details, user_id)
VALUES (
  'UNMATCHED_PAYMENT',
  'Payment of £50.00 received (pi_3TD6XgQfeHASnkQW1onchwcE) but no matching booking found. Manual review required. Discovered 2026-03-20.',
  '00000000-0000-0000-0000-000000000000'
);