UPDATE bookings b
SET duration_minutes = br.duration_minutes
FROM breeds br
WHERE b.breed_id = br.id
AND b.duration_minutes != br.duration_minutes
AND b.status NOT IN ('Cancelled','No Show','Refunded')