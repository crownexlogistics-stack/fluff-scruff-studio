
-- Add email and description to staff
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS description text;

-- Working hours per day of week
CREATE TABLE public.staff_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon, 6=Sun
  start_time time without time zone NOT NULL DEFAULT '09:00',
  end_time time without time zone NOT NULL DEFAULT '17:00',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(staff_id, day_of_week)
);

ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to staff_availability" ON public.staff_availability FOR ALL USING (true) WITH CHECK (true);

-- Junction table for staff <-> services
CREATE TABLE public.staff_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(staff_id, service_id)
);

ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to staff_services" ON public.staff_services FOR ALL USING (true) WITH CHECK (true);
