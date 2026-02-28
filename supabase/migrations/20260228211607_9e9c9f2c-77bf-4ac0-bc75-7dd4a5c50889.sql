
-- Create add_ons table
CREATE TABLE public.add_ons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon TEXT DEFAULT 'Sparkles',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;

-- Anyone can read active add-ons (for booking flow)
CREATE POLICY "Anyone can view active add-ons"
ON public.add_ons FOR SELECT
USING (true);

-- Only managers/directors can modify
CREATE POLICY "Managers can insert add-ons"
ON public.add_ons FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'director'))
);

CREATE POLICY "Managers can update add-ons"
ON public.add_ons FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'director'))
);

CREATE POLICY "Managers can delete add-ons"
ON public.add_ons FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'director'))
);

-- Seed initial add-ons
INSERT INTO public.add_ons (name, price, icon) VALUES
  ('VIP Treatment', 12, 'Sparkles'),
  ('De-shedding', 10, 'Dog');
