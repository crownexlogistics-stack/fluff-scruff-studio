import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useStaffBlockCheck } from "@/hooks/useStaffBlockCheck";
import { useFullCalendarAccess } from "@/hooks/useFullCalendarAccess";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  /**
   * When true, a groomer with the per-profile "Full Calendar Access" toggle
   * ON is also allowed in, even if "groomer" is not in `allowedRoles`.
   * Used to gate elevated-only views like /bookings.
   */
  allowFullCalendarGroomer?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, allowFullCalendarGroomer = false }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const isBlocked = useStaffBlockCheck(user?.id);
  const { hasFullCalendarAccess, loading: fcaLoading } = useFullCalendarAccess(user?.id);

  if (authLoading || roleLoading || (allowFullCalendarGroomer && fcaLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || isBlocked) {
    return <Navigate to="/auth" replace />;
  }

  const roleAllowed = !!role && allowedRoles.includes(role);
  const elevatedGroomerAllowed =
    allowFullCalendarGroomer && role === "groomer" && hasFullCalendarAccess;

  if (role && !roleAllowed && !elevatedGroomerAllowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
