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
      const booking = results[0].data?.[0] as { booking_date?: string } | undefined;
      const migrated = results[1].data?.[0] as { booking_date?: string } | undefined;
      const expense = results[2].data?.[0] as { expense_date?: string; recurring_start_date?: string; created_at?: string } | undefined;
      const purchase = results[3].data?.[0] as { purchased_at?: string } | undefined;
      const dates = [
        booking?.booking_date,
        migrated?.booking_date,
        expense?.expense_date,
        expense?.recurring_start_date,
        expense?.created_at,
        purchase?.purchased_at,
      ].filter(Boolean).map((value) => new Date(value as string)).filter((date) => !Number.isNaN(date.getTime()));
      return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
    },
    staleTime: Infinity,
  });
}
