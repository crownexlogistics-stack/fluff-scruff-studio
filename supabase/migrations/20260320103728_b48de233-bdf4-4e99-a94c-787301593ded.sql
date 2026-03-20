-- Add pdf_storage_path column to package_tc_signatures
ALTER TABLE public.package_tc_signatures
ADD COLUMN IF NOT EXISTS pdf_storage_path text;

-- RLS policies for package-agreements bucket (director/manager only)
CREATE POLICY "Directors can read package agreements"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-agreements'
  AND (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Directors can insert package agreements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'package-agreements'
  AND (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager'))
);