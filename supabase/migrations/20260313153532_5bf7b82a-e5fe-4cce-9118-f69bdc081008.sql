-- Reset Daniel Owers booking to pre-checkout state
UPDATE public.bookings 
SET status = 'Confirmed', final_charge = NULL 
WHERE id = '07d1c977-7400-4da6-ac3d-292a5b9a8414';

-- Remove the commission record so checkout creates a fresh one
DELETE FROM public.commission_records 
WHERE booking_id = '07d1c977-7400-4da6-ac3d-292a5b9a8414';
