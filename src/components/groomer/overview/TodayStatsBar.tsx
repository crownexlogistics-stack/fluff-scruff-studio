import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, PawPrint, Clock } from "lucide-react";

interface TodayStatsBarProps {
  staffId: string;
}

export function TodayStatsBar({ staffId }: TodayStatsBarProps) {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayBookings = [] } = useQuery({
    queryKey: ["groomer-today-stats", staffId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("status")
        .eq("staff_id", staffId)
        .eq("booking_date", today)
        .not("status", "eq", "Cancelled");
      if (error) throw error;
      return data;
    },
  });

  const { data: weekCount = 0 } = useQuery({
    queryKey: ["groomer-week-dogs", staffId, today],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - start.getDay() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("staff_id", staffId)
        .gte("booking_date", format(start, "yyyy-MM-dd"))
        .lte("booking_date", format(end, "yyyy-MM-dd"))
        .in("status", ["Confirmed", "Pending", "Completed"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const total = todayBookings.length;
  const completed = todayBookings.filter(b => b.status === "Completed").length;
  const remaining = todayBookings.filter(b => ["Confirmed", "Pending"].includes(b.status)).length;

  const stats = [
    { icon: CalendarDays, label: "Today", value: total, emoji: "📅" },
    { icon: CheckCircle2, label: "Completed", value: completed, emoji: "✅" },
    { icon: PawPrint, label: "This week", value: weekCount, emoji: "🐾" },
    { icon: Clock, label: "Remaining", value: remaining, emoji: "⏳" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
          <span className="text-xl">{s.emoji}</span>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
