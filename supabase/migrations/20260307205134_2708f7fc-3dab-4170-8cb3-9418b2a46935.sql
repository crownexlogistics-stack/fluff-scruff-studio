
CREATE TABLE IF NOT EXISTS booking_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  addon_id uuid REFERENCES add_ons(id) ON DELETE CASCADE NOT NULL,
  added_by_staff boolean DEFAULT true,
  added_at timestamp with time zone DEFAULT now(),
  UNIQUE(booking_id, addon_id)
);

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors and managers can manage booking_addons"
  ON booking_addons FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Groomers can view booking_addons"
  ON booking_addons FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'groomer'::app_role));

CREATE POLICY "Customers can view own booking_addons"
  ON booking_addons FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE customer_email = (auth.jwt() ->> 'email'::text)
    )
  );
