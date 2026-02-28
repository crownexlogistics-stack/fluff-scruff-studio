
-- Table for one-time schedule overrides (sick days, early leave, etc.)
CREATE TABLE public.staff_schedule_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT true,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(staff_id, override_date)
);

ALTER TABLE public.staff_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedule overrides"
  ON public.staff_schedule_overrides FOR SELECT USING (true);

CREATE POLICY "Directors and managers can manage schedule overrides"
  ON public.staff_schedule_overrides FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
