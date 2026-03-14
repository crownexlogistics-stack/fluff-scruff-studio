import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUrgentPurchaseRequests() {
  const { data: count = 0 } = useQuery({
    queryKey: ["urgent-purchase-requests-count"],
    queryFn: async () => {
      const { count, error } = await (supabase.from("purchase_requests" as any) as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("priority", "urgent");
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 60000,
  });
  return count;
}
