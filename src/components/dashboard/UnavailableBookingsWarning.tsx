import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays } from "date-fns";
import { AlertTriangle, UserX, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

/**
 * Dashboard warning banner that flags bookings assigned to groomers
 * who are unavailable (schedule removed / day off override).
 */
export function UnavailableBookingsWarning() {
  const navigate = useNavigate();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Get all bookings this week
  const { data: weekBookings = [] } = useQuery({
    queryKey: ["unavail-warn-bookings", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, dog_name, booking_date, booking_time, staff_id, status, staff(name)")
        .gte("booking_date", weekStartStr)
        .lte("booking_date", weekEndStr)
        .in("status", ["Confirmed", "Pending"]);
      return (data ?? []) as any[];
    },
  });

  // Get base schedules for all staff
  const { data: baseSchedules = [] } = useQuery({
    queryKey: ["unavail-warn-schedules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_availability")
        .select("staff_id, day_of_week, is_available");
      return (data ?? []) as any[];
    },
  });

  // Get schedule overrides for this week
  const { data: overrides = [] } = useQuery({
    queryKey: ["unavail-warn-overrides", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_schedule_overrides")
        .select("staff_id, override_date, is_working, start_time, end_time")
        .gte("override_date", weekStartStr)
        .lte("override_date", weekEndStr);
      return (data ?? []) as any[];
    },
  });

  const affectedBookings = useMemo(() => {
    if (!weekBookings.length) return [];

    return weekBookings.filter((booking: any) => {
      if (!booking.staff_id) return false;
      const bookingDate = new Date(booking.booking_date + "T00:00:00");
      const dateStr = booking.booking_date;

      // Check for full-day off override (is_working=false, null times)
      const fullDayOff = overrides.some(
        (o: any) => o.staff_id === booking.staff_id && o.override_date === dateStr && !o.is_working && !o.start_time && !o.end_time
      );
      if (fullDayOff) return true;

      // Check for partial block override covering booking time
      const partialBlock = overrides.find(
        (o: any) => o.staff_id === booking.staff_id && o.override_date === dateStr && !o.is_working && o.start_time && o.end_time
      );
      if (partialBlock) {
        // If the booking time falls within the blocked range
        const bookingMins = parseTime(booking.booking_time);
        const blockStart = parseTime(partialBlock.start_time);
        const blockEnd = parseTime(partialBlock.end_time);
        if (bookingMins >= blockStart && bookingMins < blockEnd) return true;
      }

      // Check if there's a working override — if so, they're available
      const hasWorkingOverride = overrides.some(
        (o: any) => o.staff_id === booking.staff_id && o.override_date === dateStr && o.is_working
      );
      if (hasWorkingOverride) return false;

      // Check base schedule — if no entry for this day, they're unavailable
      const dayOfWeek = (bookingDate.getDay() + 6) % 7; // 0=Mon
      const hasBaseSchedule = baseSchedules.some(
        (s: any) => s.staff_id === booking.staff_id && s.day_of_week === dayOfWeek && s.is_available
      );
      if (!hasBaseSchedule) return true;

      return false;
    });
  }, [weekBookings, overrides, baseSchedules]);

  if (affectedBookings.length === 0) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive text-sm">
            ⚠️ ACTION NEEDED: {affectedBookings.length} booking{affectedBookings.length !== 1 ? "s" : ""} exist for groomers who are marked as unavailable
          </h3>
          <p className="text-xs text-destructive/80 mt-0.5">
            Please review and reassign or contact customers.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {affectedBookings.map((booking: any) => (
          <div
            key={booking.id}
            className="flex items-center gap-3 bg-card border border-destructive/20 rounded-lg p-3"
          >
            <UserX className="h-4 w-4 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{booking.customer_name} — {booking.dog_name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(booking.booking_date + "T00:00:00"), "EEE, dd MMM")} at {booking.booking_time?.slice(0, 5)} · with {booking.staff?.name || "Unknown"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="destructive" className="text-[10px]">Unavailable</Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => navigate("/admin/bookings")}
              >
                Review <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseTime(time: string): number {
  const [h, m] = (time || "00:00").split(":");
  return parseInt(h || "0", 10) * 60 + parseInt(m || "0", 10);
}
