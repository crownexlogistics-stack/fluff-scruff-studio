CREATE POLICY "Groomers can delete own uploaded photos"
ON public.pet_photos
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'groomer'::app_role)
  AND user_id = auth.uid()
);