
-- Create timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Incident reports table
CREATE TABLE public.incident_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  person_name TEXT NOT NULL,
  person_address TEXT,
  person_occupation TEXT,
  reporter_name TEXT NOT NULL,
  reporter_occupation TEXT,
  accident_date DATE NOT NULL,
  accident_time TIME,
  accident_location TEXT,
  accident_description TEXT NOT NULL,
  injury_description TEXT,
  riddor_reportable BOOLEAN NOT NULL DEFAULT false,
  riddor_reference TEXT,
  employer_signed_by TEXT,
  employer_signed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Recipients table
CREATE TABLE public.incident_report_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL DEFAULT 'involved',
  has_read BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  signed_name TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage incident reports"
ON public.incident_reports FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can view reports they are recipients of"
ON public.incident_reports FOR SELECT
USING (
  has_role(auth.uid(), 'groomer'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.incident_report_recipients irr
    JOIN public.staff s ON s.id = irr.staff_id
    WHERE irr.report_id = incident_reports.id AND s.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Directors and managers can manage recipients"
ON public.incident_report_recipients FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can view own recipient records"
ON public.incident_report_recipients FOR SELECT
USING (
  has_role(auth.uid(), 'groomer'::app_role) AND
  staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Groomers can update own recipient records"
ON public.incident_report_recipients FOR UPDATE
USING (
  has_role(auth.uid(), 'groomer'::app_role) AND
  staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

-- Trigger
CREATE TRIGGER update_incident_reports_updated_at
BEFORE UPDATE ON public.incident_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
