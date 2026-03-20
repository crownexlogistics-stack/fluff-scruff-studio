import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface GroomerDailyBriefingProps {
  staffId: string;
  groomerName: string;
  careerTotal: number;
}

export function GroomerDailyBriefing({ staffId, groomerName, careerTotal }: GroomerDailyBriefingProps) {
  const [forceRefresh, setForceRefresh] = useState(0);
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todaysBookings = [] } = useQuery({
    queryKey: ["groomer-today-bookings", staffId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, dog_name, status, booking_time")
        .eq("staff_id", staffId)
        .eq("booking_date", today)
        .order("booking_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: weekBookingsCount = 0 } = useQuery({
    queryKey: ["groomer-week-count", staffId, today],
    queryFn: async () => {
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("staff_id", staffId)
        .gte("booking_date", today)
        .lte("booking_date", format(endOfWeek, "yyyy-MM-dd"))
        .in("status", ["Confirmed", "Pending"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: briefing, isLoading, isRefetching } = useQuery({
    queryKey: ["groomer-briefing", staffId, today, forceRefresh],
    queryFn: async () => {
      const confirmed = todaysBookings.filter(b => ["Confirmed", "Pending"].includes(b.status));
      const noShows = todaysBookings.filter(b => b.status === "No Show");
      const cancelled = todaysBookings.filter(b => b.status === "Cancelled");
      const dogNames = confirmed.map(b => b.dog_name).filter(Boolean);

      const firstName = groomerName.split(" ")[0];

      const { data, error } = await supabase.functions.invoke("groomer-briefing", {
        body: {
          groomerName: firstName,
          todayDate: format(new Date(), "EEEE, d MMMM yyyy"),
          appointmentCount: confirmed.length,
          dogNames,
          noShowCount: noShows.length,
          cancelledCount: cancelled.length,
          weekAppointments: weekBookingsCount,
          careerTotal,
        },
      });
      if (error) throw error;
      return {
        text: data.briefing,
        generatedAt: new Date().toISOString(),
      };
    },
    enabled: todaysBookings.length >= 0,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Card className="border-[hsl(var(--primary))]/20 overflow-hidden">
      <div className="h-1 bg-[hsl(var(--primary))]" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-heading font-bold text-base">Good Morning, {groomerName.split(" ")[0]}!</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setForceRefresh(n => n + 1)}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : briefing ? (
            <>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{briefing.text}</p>
              <p className="text-[10px] text-muted-foreground mt-3">
                Generated at {format(new Date(briefing.generatedAt), "HH:mm")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load briefing. Try refreshing.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
