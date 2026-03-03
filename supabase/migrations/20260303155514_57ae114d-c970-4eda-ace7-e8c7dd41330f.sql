ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_status_check
CHECK (
  status = ANY (
    ARRAY[
      'Pending'::text,
      'Confirmed'::text,
      'Completed'::text,
      'Cancelled'::text,
      'No Show'::text,
      'Blocked'::text,
      'Refunded'::text,
      'Refunded/Cancelled'::text,
      'Cancelled/Refunded'::text
    ]
  )
);