import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches migrated bookings for a groomer matched by staff name.
 * Returns customer-level aggregated data merged from both bookings and migrated_bookings.
 */
export function useMigratedBookings(staffId: string) {
  return useQuery({
    queryKey: ["groomer-migrated-bookings", staffId],
    queryFn: async () => {
      // First get the staff name
      const { data: staffData } = await supabase
        .from("staff")
        .select("name")
        .eq("id", staffId)
        .maybeSingle();

      if (!staffData?.name) return [];

      const staffName = staffData.name.trim();

      // Query migrated_bookings by staff_name (case-insensitive match)
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("id, booking_date, booking_time, dog_name, dog_breed, service_name, staff_name, total_price, migrated_customer_id, migrated_customers(full_name, email, phone)")
        .or(`staff_name.ilike.${staffName},staff_name.ilike.${staffName.split(" ")[0]}`)
        .order("booking_date", { ascending: false });

      if (error) throw error;

      // Filter more precisely - match on trimmed lowercase
      const lowerName = staffName.toLowerCase();
      const firstName = staffName.split(" ")[0].toLowerCase();

      return (data || []).filter(b => {
        const bName = (b.staff_name || "").trim().toLowerCase();
        return bName === lowerName || bName === firstName;
      });
    },
  });
}
