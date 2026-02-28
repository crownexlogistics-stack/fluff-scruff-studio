
-- Add referral_source column to bookings to track customer acquisition channels
ALTER TABLE public.bookings 
ADD COLUMN referral_source text DEFAULT 'direct';

-- Add comment for clarity
COMMENT ON COLUMN public.bookings.referral_source IS 'Customer acquisition channel: google, instagram, facebook, referral, walk_in, direct, other';
