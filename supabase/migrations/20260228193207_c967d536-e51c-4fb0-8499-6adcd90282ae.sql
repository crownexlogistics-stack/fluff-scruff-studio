
-- Simple key-value config table for site settings like image positions
CREATE TABLE public.site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can read site config"
  ON public.site_config FOR SELECT USING (true);

-- Only managers/directors can update
CREATE POLICY "Managers can manage site config"
  ON public.site_config FOR ALL
  USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director')
  );

-- Seed default positions
INSERT INTO public.site_config (key, value) VALUES
  ('sub_service_images', '{"Bath & Brush": "50% 35%", "Full Groom": "50% 40%"}'::jsonb);
