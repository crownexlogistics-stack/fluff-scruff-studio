
ALTER TABLE public.customer_pets 
ADD COLUMN dog_age_years integer DEFAULT NULL,
ADD COLUMN dog_age_months integer DEFAULT NULL;
