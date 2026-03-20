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
}

export function GroomerDailyBriefing({ staffId, groomerName }: GroomerDailyBriefingProps) {
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

  const { data: weekBookings = [] } = useQuery({
    queryKey: ["groomer-week-bookings", staffId, today],
    queryFn: async () => {
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      const { data, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("staff_id", staffId)
        .gte("booking_date", today)
        .lte("booking_date", format(endOfWeek, "yyyy-MM-dd"))
        .in("status", ["Confirmed", "Pending"]);
      if (error) throw error;
      return data;
    },
  });

  const { data: briefing, isLoading, isRefetching } = useQuery({
    queryKey: ["groomer-briefing", staffId, today, forceRefresh],
    queryFn: async () => {
      const confirmed = todaysBookings.filter(b => b.status === "Confirmed" || b.status === "Pending");
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
          weekAppointments: weekBookings.length,
        },
      });
      if (error) throw error;
      return {
        text: data.briefing,
        generatedAt: new Date().toISOString(),
      };
    },
    enabled: todaysBookings !== undefined,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-semibold text-sm">Your Daily Briefing</h3>
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
