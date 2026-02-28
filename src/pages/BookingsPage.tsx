import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, addWeeks, format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarHeader } from "@/components/booking-calendar/CalendarHeader";
import { WeeklyCalendar } from "@/components/booking-calendar/WeeklyCalendar";
import { getStaffColor } from "@/components/booking-calendar/staffColors";
import { NewBookingDialog } from "@/components/booking-calendar/NewBookingDialog";
import type { BookingData } from "@/components/booking-calendar/BookingEvent";

const BookingsPage = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"appointment" | "block">("appointment");
  const [dialogDefaults, setDialogDefaults] = useState<{ date?: Date; hour?: number; staffId?: string }>({});

  const weekEnd = addDays(weekStart, 6);

  // Fetch staff
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Staff index map for color coding
  const staffIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((s, i) => map.set(s.name, i));
    return map;
  }, [staff]);

  // Fetch bookings for the week
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, breeds(name), services(name), staff(name)")
        .gte("booking_date", format(weekStart, "yyyy-MM-dd"))
        .lte("booking_date", format(weekEnd, "yyyy-MM-dd"))
        .order("booking_time");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        staff_name: b.staff?.name ?? "Unassigned",
        breed_name: b.breeds?.name ?? "",
        service_name: b.services?.name ?? "",
      })) as BookingData[];
    },
  });

  // Fetch schedule overrides (blocked time) for the week
  const { data: overrides = [] } = useQuery({
    queryKey: ["schedule-overrides", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedule_overrides")
        .select("*, staff(name)")
        .gte("override_date", format(weekStart, "yyyy-MM-dd"))
        .lte("override_date", format(weekEnd, "yyyy-MM-dd"))
        .eq("is_working", false);
      if (error) throw error;
      return (data || []).map((o: any) => ({
        id: o.id,
        customer_name: o.note || "Blocked",
        dog_name: "",
        booking_date: o.override_date,
        booking_time: o.start_time || "09:00",
        total_price: 0,
        deposit_paid: 0,
        status: "Blocked",
        notes: o.note,
        customer_email: null,
        customer_phone: null,
        staff_name: o.staff?.name ?? "Unknown",
        breed_name: "",
        service_name: "",
        is_block: true,
      })) as BookingData[];
    },
  });

  const allEvents = useMemo(() => [...bookings, ...overrides], [bookings, overrides]);

  const handleBook = useCallback((date: Date, hour: number, staffId: string) => {
    setDialogMode("appointment");
    setDialogDefaults({ date, hour, staffId });
    setDialogOpen(true);
  }, []);

  const handleBlock = useCallback((date: Date, hour: number, staffId: string) => {
    setDialogMode("block");
    setDialogDefaults({ date, hour, staffId });
    setDialogOpen(true);
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4">
        <CalendarHeader
          weekStart={weekStart}
          onPrevWeek={() => setWeekStart(w => addWeeks(w, -1))}
          onNextWeek={() => setWeekStart(w => addWeeks(w, 1))}
          onToday={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        />

        {/* Staff legend */}
        <div className="flex flex-wrap gap-2">
          {staff.map((s, i) => {
            const colors = getStaffColor(i);
            return (
              <div key={s.id} className="flex items-center gap-1.5 text-xs">
                <div className={cn("h-3 w-3 rounded-sm", colors.bg)} />
                <span>{s.name}</span>
              </div>
            );
          })}
        </div>

        <WeeklyCalendar
          weekStart={weekStart}
          staff={staff}
          bookings={allEvents}
          staffIndexMap={staffIndexMap}
          onBook={handleBook}
          onBlock={handleBlock}
        />
      </div>

      <NewBookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={dialogDefaults.date}
        defaultHour={dialogDefaults.hour}
        defaultStaffId={dialogDefaults.staffId}
        mode={dialogMode}
      />
    </AppLayout>
  );
};

export default BookingsPage;
