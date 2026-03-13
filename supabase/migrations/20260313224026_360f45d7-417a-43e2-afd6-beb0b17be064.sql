
-- HR Events timeline table
CREATE TABLE public.hr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date date NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage hr_events"
  ON public.hr_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- HR Employment Status table
CREATE TABLE public.hr_employment_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE UNIQUE,
  current_status text NOT NULL DEFAULT 'Active',
  notice_period text,
  reason_for_leaving text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_employment_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage hr_employment_status"
  ON public.hr_employment_status FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- HR Documents table
CREATE TABLE public.hr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage hr_documents"
  ON public.hr_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Storage bucket for HR documents
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', false);

-- Storage RLS: only directors/managers can upload and read
CREATE POLICY "Directors managers can upload hr docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents' AND (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Directors managers can read hr docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents' AND (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Directors managers can delete hr docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hr-documents' AND (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
