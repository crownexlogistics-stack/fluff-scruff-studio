import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBusinessBeginning() {
  return useQuery({
    queryKey: ["business-beginning"],
    queryFn: async () => {
      const queries = [
        supabase.from("bookings").select("booking_date").order("booking_date", { ascending: true }).limit(1),
        supabase.from("migrated_bookings").select("booking_date").order("booking_date", { ascending: true }).limit(1),
        supabase.from("expenses").select("expense_date, recurring_start_date, created_at").order("created_at", { ascending: true }).limit(1),
        supabase.from("purchases").select("purchased_at").order("purchased_at", { ascending: true }).limit(1),
      ];
      const results = await Promise.all(queries);
      const dates = [
        results[0].data?.[0]?.booking_date,
        results[1].data?.[0]?.booking_date,
        results[2].data?.[0]?.expense_date,
        results[2].data?.[0]?.recurring_start_date,
        results[2].data?.[0]?.created_at,
        results[3].data?.[0]?.purchased_at,
      ].filter(Boolean).map((value) => new Date(value as string)).filter((date) => !Number.isNaN(date.getTime()));
      return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
    },
    staleTime: Infinity,
  });
}
