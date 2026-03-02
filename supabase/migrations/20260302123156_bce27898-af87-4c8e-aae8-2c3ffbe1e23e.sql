
-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value NUMERIC NOT NULL DEFAULT 0, -- percentage (0-100) or fixed amount in £
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  max_uses INTEGER, -- total uses allowed (null = unlimited)
  max_uses_per_customer INTEGER DEFAULT 1, -- per customer email
  times_used INTEGER NOT NULL DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0, -- minimum order to apply
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_unique UNIQUE (code)
);

-- Create coupon usage tracking table
CREATE TABLE public.coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

-- Coupons: anyone can read active coupons (needed for validation), directors/managers can manage
CREATE POLICY "Anyone can read coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Directors can manage coupons" ON public.coupons FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

-- Coupon usages: anyone can insert (for booking), directors/managers can read
CREATE POLICY "Anyone can insert coupon_usages" ON public.coupon_usages FOR INSERT WITH CHECK (true);
CREATE POLICY "Directors and managers can read coupon_usages" ON public.coupon_usages FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));
CREATE POLICY "Directors can manage coupon_usages" ON public.coupon_usages FOR ALL
  USING (has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'director'::app_role));

-- Trigger for updated_at on coupons
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
