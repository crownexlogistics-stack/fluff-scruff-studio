
-- Backfill service_id for bookings with breed_id
UPDATE bookings b
SET service_id = CASE
  WHEN (
    b.total_price - COALESCE((
      SELECT SUM(a.price) FROM booking_addons ba JOIN add_ons a ON a.id = ba.addon_id WHERE ba.booking_id = b.id
    ), 0)
  ) <= (br.price_bath_brush + br.price_full_groom) / 2.0
  THEN '697bc124-1dd0-4cdf-be5f-3123aa22eefa'::uuid
  ELSE 'be4f5259-e546-4b31-96b4-3301012b4d73'::uuid
END
FROM breeds br
WHERE b.service_id IS NULL
  AND b.breed_id IS NOT NULL
  AND br.id = b.breed_id;

-- Backfill bookings without breed_id - default to Full Groom
UPDATE bookings
SET service_id = 'be4f5259-e546-4b31-96b4-3301012b4d73'::uuid
WHERE service_id IS NULL AND breed_id IS NULL;
