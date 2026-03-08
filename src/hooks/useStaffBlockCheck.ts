import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Checks if the logged-in user's staff account is blocked.
 * If blocked, signs them out immediately.
 */
export function useStaffBlockCheck(userId: string | undefined) {
  const { data: isBlocked } = useQuery({
    queryKey: ["staff-block-check", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("staff")
        .select("account_blocked")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (error || !data) return false;
      return (data as any).account_blocked === true;
    },
    enabled: !!userId,
    refetchInterval: 30000, // Re-check every 30s
  });

  useEffect(() => {
    if (isBlocked) {
      toast.error("Your account access has been suspended. Please contact Fluff & Scruff Studio for more information.");
      supabase.auth.signOut();
    }
  }, [isBlocked]);

  return isBlocked;
}
