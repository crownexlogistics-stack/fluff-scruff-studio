import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when the signed-in user is a groomer whose staff record
 * has the `full_calendar_access` toggle enabled.
 *
 * Off by default. When ON, the groomer is granted elevated calendar &
 * customer access (see usePermissions / RLS for details). The toggle is
 * managed by directors/managers from the staff profile screen.
 */
export function useFullCalendarAccess(userId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["staff-full-calendar-access", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("staff")
        .select("full_calendar_access")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (error) return false;
      return !!data?.full_calendar_access;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  return { hasFullCalendarAccess: !!data, loading: isLoading };
}