
CREATE TABLE public.work_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  education_place text,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  added_by uuid REFERENCES public.staff(id),
  completed_by uuid REFERENCES public.staff(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.placement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.work_placements(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id),
  staff_name text,
  log_entry text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_placement_logs_placement ON public.placement_logs(placement_id);
CREATE INDEX idx_work_placements_status ON public.work_placements(status);

ALTER TABLE public.work_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_logs ENABLE ROW LEVEL SECURITY;

-- work_placements policies
CREATE POLICY "Staff can view all placements"
ON public.work_placements FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'director') OR
  public.has_role(auth.uid(), 'volunteer') OR
  public.has_role(auth.uid(), 'work_placement')
);

CREATE POLICY "Staff can insert placements"
ON public.work_placements FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'groomer') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'director') OR
  public.has_role(auth.uid(), 'volunteer') OR
  public.has_role(auth.uid(), 'work_placement')
);

CREATE POLICY "Managers and directors can update placements"
ON public.work_placements FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Managers and directors can delete placements"
ON public.work_placements FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- placement_logs policies
CREATE POLICY "Staff can view all placement logs"
ON public.placement_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'director') OR
  public.has_role(auth.uid(), 'volunteer') OR
  public.has_role(auth.uid(), 'work_placement')
);

CREATE POLICY "Staff can insert placement logs"
ON public.placement_logs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'groomer') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'director') OR
  public.has_role(auth.uid(), 'volunteer') OR
  public.has_role(auth.uid(), 'work_placement')
);

-- updated_at trigger
CREATE TRIGGER update_work_placements_updated_at
BEFORE UPDATE ON public.work_placements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
