
-- Risk assessments table
CREATE TABLE public.risk_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'Fluff and Scruff Studio',
  assessed_by TEXT NOT NULL,
  assessment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Risk assessment hazard items
CREATE TABLE public.risk_assessment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  hazard TEXT NOT NULL,
  who_harmed TEXT NOT NULL,
  existing_controls TEXT NOT NULL,
  additional_actions TEXT,
  who_responsible TEXT,
  from_when DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for risk_assessments
CREATE POLICY "Directors and managers can manage risk assessments"
ON public.risk_assessments FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Groomers can view risk assessments (read-only for awareness)
CREATE POLICY "Groomers can view risk assessments"
ON public.risk_assessments FOR SELECT
USING (has_role(auth.uid(), 'groomer'::app_role));

-- RLS policies for risk_assessment_items
CREATE POLICY "Directors and managers can manage risk assessment items"
ON public.risk_assessment_items FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can view risk assessment items"
ON public.risk_assessment_items FOR SELECT
USING (has_role(auth.uid(), 'groomer'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_risk_assessments_updated_at
BEFORE UPDATE ON public.risk_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
