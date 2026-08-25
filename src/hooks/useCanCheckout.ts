import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { usePermissions } from "@/config/rolePermissions";

/**
 * Only the groomer the appointment is assigned to — or a manager/director —
 * may check an appointment out. "Full Calendar Access" grants visibility and
 * scheduling rights, NOT the right to complete someone else's work.
 */
export function useCanCheckout(bookingStaffId?: string | null) {
  const { staff } = useCurrentStaff();
  const { isManagement } = usePermissions();

  if (isManagement) return true;
  if (!bookingStaffId) return false;
  return !!staff && staff.id === bookingStaffId;
}
