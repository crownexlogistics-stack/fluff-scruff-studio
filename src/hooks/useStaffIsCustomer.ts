import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if the current authenticated user (staff member) also has
 * customer bookings in the system (by matching their email).
 */
export function useStaffIsCustomer(userEmail: string | undefined) {
  const { data: hasCustomerBookings = false, isLoading } = useQuery({
    queryKey: ["staff-is-customer", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      if (!userEmail) return false;

      // Check bookings table for any booking with this email as customer
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .ilike("customer_email", userEmail)
        .limit(1);

      if (error) {
        console.error("Error checking staff customer bookings:", error);
        return false;
      }

      if (count && count > 0) return true;

      // Also check migrated_customers
      const { count: migratedCount, error: migratedErr } = await supabase
        .from("migrated_customers")
        .select("id", { count: "exact", head: true })
        .ilike("email", userEmail)
        .limit(1);

      if (migratedErr) return false;

      return (migratedCount ?? 0) > 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { hasCustomerBookings, isLoading };
}
