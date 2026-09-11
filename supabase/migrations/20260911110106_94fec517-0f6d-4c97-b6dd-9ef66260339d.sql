CREATE POLICY "Managers can upload service images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')));

CREATE POLICY "Managers can update service images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')))
WITH CHECK (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')));

CREATE POLICY "Managers can delete service images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-images' AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')));

CREATE POLICY "Staff can read service images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'service-images');