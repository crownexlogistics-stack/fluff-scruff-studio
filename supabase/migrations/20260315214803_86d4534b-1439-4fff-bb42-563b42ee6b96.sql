
ALTER TABLE public.coupon_usages 
ADD COLUMN applied_by_staff_id uuid REFERENCES public.staff(id) DEFAULT NULL,
ADD COLUMN applied_by_staff_name text DEFAULT NULL;
