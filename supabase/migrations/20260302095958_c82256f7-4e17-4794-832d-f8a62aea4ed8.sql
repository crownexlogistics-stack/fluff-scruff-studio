
-- Create audit_logs table for tracking all user actions
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only directors can read audit logs
CREATE POLICY "Directors can read all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'director'::app_role));

-- Any authenticated user can insert their own audit logs
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by staff
CREATE INDEX idx_audit_logs_staff_id ON public.audit_logs(staff_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Remove manager access to HR notes (HR is director-only)
DROP POLICY IF EXISTS "Managers can insert staff notes" ON public.staff_notes;
DROP POLICY IF EXISTS "Managers can read staff notes" ON public.staff_notes;
