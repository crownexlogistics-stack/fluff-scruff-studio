ALTER TABLE public.coupon_usages ADD COLUMN migrated_booking_id uuid REFERENCES public.migrated_bookings(id);

-- Allow groomers to insert coupon_usages (they currently can't due to RLS)
CREATE POLICY "Groomers can insert coupon_usages"
ON public.coupon_usages
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'groomer'::app_role));

-- Allow groomers to read coupon_usages for bookings they can see
CREATE POLICY "Groomers can read coupon_usages"
ON public.coupon_usages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role));