import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
export function usePhoneIntakeHolds(from: string, to: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["phone-intake-holds", user?.id, from, to], enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("active_phone_intake_holds", { _from: from, _to: to });
      if (error) throw error;
      return data ?? [];
    },
  });
}