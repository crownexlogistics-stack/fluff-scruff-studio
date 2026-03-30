
-- salon_emails table
CREATE TABLE public.salon_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_email text NOT NULL,
  customer_name text,
  subject text,
  body text,
  assigned_staff_id uuid REFERENCES public.staff(id),
  status text NOT NULL DEFAULT 'pending',
  last_reply_body text
);

-- email_replies table
CREATE TABLE public.email_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES public.salon_emails(id) ON DELETE CASCADE,
  reply_body text NOT NULL,
  replied_by uuid REFERENCES public.staff(id),
  replied_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_salon_emails_status ON public.salon_emails(status);
CREATE INDEX idx_salon_emails_assigned ON public.salon_emails(assigned_staff_id);
CREATE INDEX idx_email_replies_email ON public.email_replies(email_id);

-- RLS on salon_emails
ALTER TABLE public.salon_emails ENABLE ROW LEVEL SECURITY;

-- Directors/managers: full access
CREATE POLICY "Directors managers select salon_emails"
ON public.salon_emails FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Directors managers insert salon_emails"
ON public.salon_emails FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Directors managers update salon_emails"
ON public.salon_emails FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

-- Groomers: select/update only assigned emails
CREATE POLICY "Groomers select assigned salon_emails"
ON public.salon_emails FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer')
  AND assigned_staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Groomers update assigned salon_emails"
ON public.salon_emails FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer')
  AND assigned_staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'groomer')
  AND assigned_staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
);

-- RLS on email_replies
ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors managers select email_replies"
ON public.email_replies FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Directors managers insert email_replies"
ON public.email_replies FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Groomers select own email_replies"
ON public.email_replies FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'groomer')
  AND email_id IN (
    SELECT id FROM public.salon_emails
    WHERE assigned_staff_id IN (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
  )
);

CREATE POLICY "Groomers insert own email_replies"
ON public.email_replies FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'groomer')
  AND email_id IN (
    SELECT id FROM public.salon_emails
    WHERE assigned_staff_id IN (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
  )
);
