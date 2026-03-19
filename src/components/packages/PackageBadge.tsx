import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface PackageBadgeProps {
  bookingId: string;
  compact?: boolean;
}

export function PackageBadge({ bookingId, compact = false }: PackageBadgeProps) {
  const { data: session } = useQuery({
    queryKey: ["package-session-badge", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_sessions" as any)
        .select("session_number, package_booking_id, package_bookings(sessions_total, packages(name, discount_percentage))")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (!session) return null;

  const pb = session.package_bookings;
  const pkg = pb?.packages;
  const total = pb?.sessions_total || 0;

  if (compact) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] gap-1">
        <Package className="h-2.5 w-2.5" />
        {session.session_number}/{total}
      </Badge>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs space-y-0.5">
      <div className="flex items-center gap-1 font-semibold text-amber-800">
        <Package className="h-3.5 w-3.5" />
        Package Booking — Session {session.session_number} of {total}
      </div>
      {pkg && (
        <p className="text-amber-700">
          {pkg.name} ({pkg.discount_percentage}% off)
        </p>
      )}
    </div>
  );
}
