
-- Add date_of_birth to staff
ALTER TABLE public.staff ADD COLUMN date_of_birth date;

-- Create staff_notes table for HR notes (director-only)
CREATE TABLE public.staff_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;

-- Only directors can read notes
CREATE POLICY "Directors can read staff notes"
ON public.staff_notes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));

-- Only directors can insert notes
CREATE POLICY "Directors can insert staff notes"
ON public.staff_notes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role) AND auth.uid() = created_by);

-- Only directors can delete notes
CREATE POLICY "Directors can delete staff notes"
ON public.staff_notes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));
