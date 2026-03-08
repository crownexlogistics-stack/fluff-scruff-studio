import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useStaffBlockCheck } from "@/hooks/useStaffBlockCheck";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const isBlocked = useStaffBlockCheck(user?.id);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || isBlocked) {
    return <Navigate to="/auth" replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
