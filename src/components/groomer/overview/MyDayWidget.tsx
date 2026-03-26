import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  CalendarDays, CheckCircle2, XCircle, ArrowRightLeft,
  CreditCard, MessageSquare, Package, StickyNote, Clock,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  booking_created: CalendarDays,
  checkout_complete: CheckCircle2,
  checkout_noshow: XCircle,
  reschedule: ArrowRightLeft,
  cancel: XCircle,
  payment_link: CreditCard,
  sms_sent: MessageSquare,
  package_created: Package,
  note_added: StickyNote,
};

export function MyDayWidget({ staffId }: { staffId: string }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: activities = [] } = useQuery({
    queryKey: ["groomer-activity", staffId, selectedDate],
    queryFn: async () => {
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;
      const { data, error } = await supabase
        .from("groomer_activity_log" as any)
        .select("*")
        .eq("staff_id", staffId)
        .gte("performed_at", startOfDay)
        .lte("performed_at", endOfDay)
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const isToday = selectedDate === today;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {isToday ? "Today's Activity" : `Activity — ${format(new Date(selectedDate + "T00:00:00"), "EEEE, d MMMM")}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map((a: any) => {
              const Icon = iconMap[a.action_type] || CalendarDays;
              return (
                <div key={a.id} className="flex items-start gap-2.5 text-sm">
                  <div className="p-1 rounded bg-muted shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground leading-snug">{a.action_summary}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(a.performed_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {isToday
              ? "No activity logged yet today — your actions will appear here as you work"
              : "No activity recorded for this date"}
          </p>
        )}

        {/* Browse previous days */}
        <div className="pt-2 border-t">
          <label className="text-xs text-muted-foreground block mb-1">Browse previous days</label>
          <Input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-fit text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
