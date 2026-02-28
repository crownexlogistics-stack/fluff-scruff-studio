
-- Update RLS policies to include director

-- bookings
DROP POLICY IF EXISTS "Managers can do everything with bookings" ON public.bookings;
CREATE POLICY "Directors and managers can do everything with bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- breeds
DROP POLICY IF EXISTS "Managers can manage breeds" ON public.breeds;
CREATE POLICY "Directors and managers can manage breeds"
  ON public.breeds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- services
DROP POLICY IF EXISTS "Managers can manage services" ON public.services;
CREATE POLICY "Directors and managers can manage services"
  ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- service_prices
DROP POLICY IF EXISTS "Managers can manage service_prices" ON public.service_prices;
CREATE POLICY "Directors and managers can manage service_prices"
  ON public.service_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- staff
DROP POLICY IF EXISTS "Managers can manage staff" ON public.staff;
CREATE POLICY "Directors and managers can manage staff"
  ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- staff_availability
DROP POLICY IF EXISTS "Managers can manage staff_availability" ON public.staff_availability;
CREATE POLICY "Directors and managers can manage staff_availability"
  ON public.staff_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- staff_services
DROP POLICY IF EXISTS "Managers can manage staff_services" ON public.staff_services;
CREATE POLICY "Directors and managers can manage staff_services"
  ON public.staff_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'director'));

-- Director can read ALL user_roles
CREATE POLICY "Directors can read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director'));

-- Director can update all roles
CREATE POLICY "Directors can update all roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'director'));

-- Director can read all profiles
CREATE POLICY "Directors can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director'));

-- Managers can read roles for user management
CREATE POLICY "Managers can read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));
