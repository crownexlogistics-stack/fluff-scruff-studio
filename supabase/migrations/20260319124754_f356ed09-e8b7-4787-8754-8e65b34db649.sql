
CREATE TABLE package_tc_signatures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  package_booking_id uuid REFERENCES package_bookings(id),
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  signed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  signature_text text,
  tc_version text DEFAULT '1.0',
  email_sent_at timestamptz,
  status text DEFAULT 'pending',
  signing_token text UNIQUE,
  token_expires_at timestamptz,
  performed_by text,
  manual_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE package_bookings ADD COLUMN IF NOT EXISTS tc_signed boolean DEFAULT false;
ALTER TABLE package_bookings ADD COLUMN IF NOT EXISTS tc_signed_at timestamptz;

ALTER TABLE package_tc_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tc signatures"
  ON package_tc_signatures FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tc signatures"
  ON package_tc_signatures FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tc signatures"
  ON package_tc_signatures FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Anon can read tc signatures by token"
  ON package_tc_signatures FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can update tc signatures by token"
  ON package_tc_signatures FOR UPDATE TO anon
  USING (true);
