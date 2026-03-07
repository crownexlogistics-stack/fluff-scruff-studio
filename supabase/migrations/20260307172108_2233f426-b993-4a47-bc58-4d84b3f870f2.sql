
CREATE TABLE public.error_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  customer_email TEXT,
  customer_name TEXT,
  page_url TEXT NOT NULL,
  error_description TEXT NOT NULL,
  steps_to_reproduce TEXT NOT NULL,
  browser_info TEXT,
  device_info TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  user_id UUID
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert error reports
CREATE POLICY "Anyone can insert error reports"
  ON public.error_reports
  FOR INSERT
  WITH CHECK (true);

-- Directors and managers can do everything
CREATE POLICY "Directors and managers can manage error reports"
  ON public.error_reports
  FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Customers can view their own reports
CREATE POLICY "Users can view own error reports"
  ON public.error_reports
  FOR SELECT
  USING (auth.uid() = user_id);
