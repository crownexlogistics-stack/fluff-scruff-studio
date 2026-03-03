
-- Pet photos table (for both customer & groomer uploads)
CREATE TABLE public.pet_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.customer_pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by_role TEXT NOT NULL DEFAULT 'customer',
  groomer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_photos ENABLE ROW LEVEL SECURITY;

-- Customers can view photos for their own pets
CREATE POLICY "Customers can view own pet photos"
ON public.pet_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_pets cp
    WHERE cp.id = pet_photos.pet_id AND cp.user_id = auth.uid()
  )
);

-- Customers can insert photos for own pets
CREATE POLICY "Customers can insert own pet photos"
ON public.pet_photos FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.customer_pets cp
    WHERE cp.id = pet_photos.pet_id AND cp.user_id = auth.uid()
  )
);

-- Customers can delete own photos
CREATE POLICY "Customers can delete own pet photos"
ON public.pet_photos FOR DELETE
USING (auth.uid() = user_id);

-- Directors/managers can do everything
CREATE POLICY "Directors managers can manage all pet photos"
ON public.pet_photos FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Groomers can insert photos for their customers' pets
CREATE POLICY "Groomers can insert pet photos"
ON public.pet_photos FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) AND auth.uid() = user_id
);

-- Groomers can view photos for accessible customers
CREATE POLICY "Groomers can view accessible pet photos"
ON public.pet_photos FOR SELECT
USING (
  has_role(auth.uid(), 'groomer'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.customer_pets cp
    WHERE cp.id = pet_photos.pet_id AND groomer_can_access_customer(cp.user_id)
  )
);

-- Groomer recommendations table
CREATE TABLE public.groomer_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.customer_pets(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  recommendation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groomer_recommendations ENABLE ROW LEVEL SECURITY;

-- Customers can read recommendations for their pets
CREATE POLICY "Customers can read own pet recommendations"
ON public.groomer_recommendations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_pets cp
    WHERE cp.id = groomer_recommendations.pet_id AND cp.user_id = auth.uid()
  )
);

-- Directors/managers full access
CREATE POLICY "Directors managers manage recommendations"
ON public.groomer_recommendations FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Groomers can insert recommendations
CREATE POLICY "Groomers can insert recommendations"
ON public.groomer_recommendations FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'groomer'::app_role) AND
  staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

-- Groomers can view recommendations they created
CREATE POLICY "Groomers can view own recommendations"
ON public.groomer_recommendations FOR SELECT
USING (
  has_role(auth.uid(), 'groomer'::app_role) AND
  staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

-- Storage bucket for pet photos
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-photos', 'pet-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view pet photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-photos');

CREATE POLICY "Authenticated users can upload pet photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pet-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own pet photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
