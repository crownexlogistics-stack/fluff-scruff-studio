
CREATE POLICY "Customers can insert booking_audit_log"
ON booking_audit_log FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'customer'::app_role)
);
