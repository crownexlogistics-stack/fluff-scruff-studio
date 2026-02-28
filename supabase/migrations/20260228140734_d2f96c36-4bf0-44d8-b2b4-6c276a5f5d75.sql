
-- 1. Create enum
CREATE TYPE public.app_role AS ENUM ('manager', 'groomer', 'customer');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Customer pets table
CREATE TABLE public.customer_pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_name text NOT NULL,
  breed_id uuid REFERENCES public.breeds(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_pets ENABLE ROW LEVEL SECURITY;

-- 5. Link groomers to staff records
ALTER TABLE public.staff ADD COLUMN auth_user_id uuid REFERENCES auth.users(id);

-- 6. Security-definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7. Auto-create profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. RLS policies for user_roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 9. RLS policies for profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 10. RLS policies for customer_pets
CREATE POLICY "Users can read own pets"
  ON public.customer_pets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pets"
  ON public.customer_pets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pets"
  ON public.customer_pets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pets"
  ON public.customer_pets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 11. Replace existing permissive policies on bookings with role-based ones
DROP POLICY IF EXISTS "Allow all access to bookings" ON public.bookings;

CREATE POLICY "Managers can do everything with bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Groomers can view assigned bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'groomer')
    AND staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Groomers can update assigned bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'groomer')
    AND staff_id IN (SELECT id FROM public.staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Customers can view own bookings by email"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer')
    AND customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow anonymous inserts for guest booking
CREATE POLICY "Anyone can create bookings"
  ON public.bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 12. Update existing table policies: public read, manager write
-- breeds
DROP POLICY IF EXISTS "Allow all access to breeds" ON public.breeds;
CREATE POLICY "Anyone can read breeds" ON public.breeds FOR SELECT USING (true);
CREATE POLICY "Managers can manage breeds" ON public.breeds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- services
DROP POLICY IF EXISTS "Allow all access to services" ON public.services;
CREATE POLICY "Anyone can read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Managers can manage services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- service_prices
DROP POLICY IF EXISTS "Allow all access to service_prices" ON public.service_prices;
CREATE POLICY "Anyone can read service_prices" ON public.service_prices FOR SELECT USING (true);
CREATE POLICY "Managers can manage service_prices" ON public.service_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- staff
DROP POLICY IF EXISTS "Allow all access to staff" ON public.staff;
CREATE POLICY "Anyone can read staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Managers can manage staff" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- staff_availability
DROP POLICY IF EXISTS "Allow all access to staff_availability" ON public.staff_availability;
CREATE POLICY "Anyone can read staff_availability" ON public.staff_availability FOR SELECT USING (true);
CREATE POLICY "Managers can manage staff_availability" ON public.staff_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- staff_services
DROP POLICY IF EXISTS "Allow all access to staff_services" ON public.staff_services;
CREATE POLICY "Anyone can read staff_services" ON public.staff_services FOR SELECT USING (true);
CREATE POLICY "Managers can manage staff_services" ON public.staff_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
