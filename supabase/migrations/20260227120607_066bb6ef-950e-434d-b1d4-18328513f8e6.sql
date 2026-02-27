
-- Breeds table
CREATE TABLE public.breeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  size_category TEXT NOT NULL CHECK (size_category IN ('Small', 'Medium', 'Large', 'Extra Large')),
  base_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Service pricing per breed
CREATE TABLE public.service_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  breed_id UUID NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, breed_id)
);

-- Staff table
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_self_employed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  dog_name TEXT NOT NULL,
  breed_id UUID REFERENCES public.breeds(id),
  service_id UUID REFERENCES public.services(id),
  staff_id UUID REFERENCES public.staff(id),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_groomers_own_customer BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (admin system, no per-user scoping needed yet)
CREATE POLICY "Allow all access to breeds" ON public.breeds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to services" ON public.services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to service_prices" ON public.service_prices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

-- Seed default services
INSERT INTO public.services (name, description) VALUES
  ('Full Groom', 'Complete grooming including bath, dry, haircut, nail trim, and ear clean'),
  ('Bath & Brush', 'Bath, blow-dry, and thorough brush out'),
  ('Puppy Groom', 'Gentle introduction groom for puppies under 6 months'),
  ('Hand Strip', 'Hand stripping for wire-coated breeds'),
  ('Nail Trim', 'Nail clipping and filing'),
  ('Teeth Cleaning', 'Dental hygiene treatment');
