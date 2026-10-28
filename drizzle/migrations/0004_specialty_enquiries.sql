CREATE TABLE public.specialty_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_user_id uuid,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  dog_name text,
  breed text,
  request_details text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','claimed','booked','declined')),
  claimed_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  claimed_by_name text,
  claimed_at timestamptz,
  outcome_note text,
  resolved_at timestamptz
);
GRANT INSERT ON public.specialty_enquiries TO anon;
GRANT SELECT, INSERT, UPDATE ON public.specialty_enquiries TO authenticated;
GRANT ALL ON public.specialty_enquiries TO service_role;
ALTER TABLE public.specialty_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a specialty enquiry" ON public.specialty_enquiries
FOR INSERT TO anon, authenticated
WITH CHECK (status = 'new' AND claimed_by_staff_id IS NULL AND outcome_note IS NULL
  AND length(customer_name) <= 120 AND length(phone) <= 40 AND length(request_details) <= 4000);

CREATE POLICY "Admins see all specialty enquiries" ON public.specialty_enquiries
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director'));

CREATE POLICY "Groomers see open pool and their own" ON public.specialty_enquiries
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'groomer') AND (status = 'new' OR claimed_by_staff_id = public.current_staff_id()));

CREATE POLICY "Admins update specialty enquiries" ON public.specialty_enquiries
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director'));

CREATE POLICY "Groomers claim or update their own" ON public.specialty_enquiries
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'groomer') AND (status = 'new' OR claimed_by_staff_id = public.current_staff_id()))
WITH CHECK (public.has_role(auth.uid(),'groomer') AND claimed_by_staff_id = public.current_staff_id());

CREATE TRIGGER trg_specialty_enquiries_updated_at BEFORE UPDATE ON public.specialty_enquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can upload specialty enquiry files" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'specialty-enquiries');

CREATE POLICY "Staff can view specialty enquiry files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'specialty-enquiries' AND (public.has_role(auth.uid(),'groomer') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'director')));