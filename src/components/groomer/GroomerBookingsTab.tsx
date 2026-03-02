import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, List, ChevronLeft, ChevronRight, CheckCircle, Clock, Dog } from "lucide-react";
import { GroomerCalendar } from "./GroomerCalendar";
import { Card, CardContent } from "@/components/ui/card";

interface GroomerBookingsTabProps {
  staffId: string;
}

type ViewMode = "1day" | "3day" | "list";

export function GroomerBookingsTab({ staffId }: GroomerBookingsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("3day");
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));

  const { data: allStaff = [] } = useQuery({
    queryKey: ["staff-list-groomer"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const daysToShow = viewMode === "1day" ? 1 : viewMode === "3day" ? 3 : 7;
  const endDate = addDays(currentDate, daysToShow - 1);

  const { data: bookings = [] } = useQuery({
    queryKey: ["groomer-bookings", format(currentDate, "yyyy-MM-dd"), daysToShow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, dog_name, booking_date, booking_time, status, notes, staff_id, services(name), breeds(name)")
        .gte("booking_date", format(currentDate, "yyyy-MM-dd"))
        .lte("booking_date", format(endDate, "yyyy-MM-dd"))
        .order("booking_time");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        id: b.id,
        customer_name: b.customer_name,
        dog_name: b.dog_name,
        booking_date: b.booking_date,
        booking_time: b.booking_time,
        status: b.status,
        notes: b.notes,
        staff_id: b.staff_id,
        staff_name: allStaff.find(s => s.id === b.staff_id)?.name || "Unassigned",
        service_name: b.services?.name ?? "",
        breed_name: b.breeds?.name ?? "",
        is_block: false,
        is_own: b.staff_id === staffId,
      }));
    },
    enabled: allStaff.length > 0,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["groomer-overrides", format(currentDate, "yyyy-MM-dd"), daysToShow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedule_overrides")
        .select("*, staff(name, id)")
        .gte("override_date", format(currentDate, "yyyy-MM-dd"))
        .lte("override_date", format(endDate, "yyyy-MM-dd"))
        .eq("is_working", false);
      if (error) throw error;
      return (data || []).map((o: any) => ({
        id: o.id,
        customer_name: o.note || "Blocked",
        dog_name: "",
        booking_date: o.override_date,
        booking_time: o.start_time || "09:00",
        end_time: o.end_time || undefined,
        status: "Blocked",
        notes: o.note,
        staff_id: o.staff?.id ?? o.staff_id,
        staff_name: o.staff?.name ?? "Unknown",
        service_name: "",
        breed_name: "",
        is_block: true,
        is_own: (o.staff?.id ?? o.staff_id) === staffId,
      }));
    },
  });

  const allEvents = useMemo(() => [...bookings, ...overrides], [bookings, overrides]);

  // List view: only own bookings
  const ownBookings = useMemo(() => 
    bookings
      .filter(b => b.is_own && !b.is_block)
      .sort((a, b) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`)),
    [bookings]
  );

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => addDays(d, -daysToShow))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(startOfDay(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => addDays(d, daysToShow))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {format(currentDate, "d MMM")}
            {daysToShow > 1 && ` — ${format(endDate, "d MMM yyyy")}`}
            {daysToShow === 1 && ` ${format(currentDate, "yyyy")}`}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <Button variant={viewMode === "1day" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("1day")}>
            1 Day
          </Button>
          <Button variant={viewMode === "3day" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("3day")}>
            3 Day
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setViewMode("list")}>
            <List className="h-3 w-3" /> List
          </Button>
        </div>
      </div>

      {/* Staff color legend */}
      {viewMode !== "list" && (
        <div className="flex flex-wrap gap-2">
          {allStaff.map((s, i) => {
            const isMe = s.id === staffId;
            return (
              <div key={s.id} className="flex items-center gap-1 text-xs">
                <div className={`h-2.5 w-2.5 rounded-sm ${isMe ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  style={{ backgroundColor: ["#9333ea","#b91c1c","#f59e0b","#059669","#2563eb","#db2777","#0d9488","#ea580c"][i % 8] }}
                />
                <span className={isMe ? "font-bold" : ""}>{s.name.split(" ")[0]}{isMe ? " (You)" : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar or List */}
      {viewMode !== "list" ? (
        <GroomerCalendar
          currentDate={currentDate}
          daysToShow={daysToShow}
          staff={allStaff}
          bookings={allEvents}
          currentStaffId={staffId}
        />
      ) : (
        <div className="space-y-2">
          {ownBookings.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No appointments in this period</p>
            </div>
          ) : (
            ownBookings.map(b => {
              const isToday = b.booking_date === today;
              const isPast = b.booking_date < today;
              return (
                <Card key={b.id} className={isPast ? "opacity-50" : ""}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Dog className="h-4 w-4 text-accent" />
                        <span className="font-semibold text-sm">{b.dog_name}</span>
                        <span className="text-muted-foreground text-xs">({b.customer_name})</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isToday ? "Today" : format(new Date(b.booking_date), "EEE d MMM")} at {b.booking_time.slice(0, 5)}
                      </p>
                      <div className="flex gap-1.5">
                        {b.service_name && <Badge variant="outline" className="text-[10px]">{b.service_name}</Badge>}
                        {b.breed_name && <Badge variant="secondary" className="text-[10px]">{b.breed_name}</Badge>}
                      </div>
                      {b.notes && <p className="text-xs text-muted-foreground">{b.notes}</p>}
                    </div>
                    <Badge variant={b.status === "Completed" ? "default" : b.status === "Confirmed" ? "secondary" : "outline"} className="text-xs shrink-0">
                      {b.status}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
