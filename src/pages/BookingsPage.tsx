import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, addWeeks, format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarHeader } from "@/components/booking-calendar/CalendarHeader";
import { WeeklyCalendar } from "@/components/booking-calendar/WeeklyCalendar";
import { getStaffColor } from "@/components/booking-calendar/staffColors";
import { NewBookingDialog } from "@/components/booking-calendar/NewBookingDialog";
import { EditBlockDialog } from "@/components/booking-calendar/EditBlockDialog";
import type { BookingData } from "@/components/booking-calendar/BookingEvent";
import { toast } from "sonner";

const BookingsPage = () => {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"appointment" | "block">("appointment");
  const [dialogDefaults, setDialogDefaults] = useState<{ date?: Date; hour?: number; staffId?: string }>({});
  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BookingData | null>(null);

  const weekEnd = addDays(weekStart, 6);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const staffIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((s, i) => map.set(s.name, i));
    return map;
  }, [staff]);

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, breeds(name), services(name), staff(name, id)")
        .gte("booking_date", format(weekStart, "yyyy-MM-dd"))
        .lte("booking_date", format(weekEnd, "yyyy-MM-dd"))
        .order("booking_time");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        staff_name: b.staff?.name ?? "Unassigned",
        staff_id: b.staff?.id ?? b.staff_id,
        breed_name: b.breeds?.name ?? "",
        service_name: b.services?.name ?? "",
      })) as BookingData[];
    },
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["schedule-overrides", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedule_overrides")
        .select("*, staff(name, id)")
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
        end_time: o.end_time || undefined,
        total_price: 0,
        deposit_paid: 0,
        status: "Blocked",
        notes: o.note,
        customer_email: null,
        customer_phone: null,
        staff_name: o.staff?.name ?? "Unknown",
        staff_id: o.staff?.id ?? o.staff_id,
        breed_name: "",
        service_name: "",
        is_block: true,
      })) as BookingData[];
    },
  });

  const allEvents = useMemo(() => [...bookings, ...overrides], [bookings, overrides]);

  // Cancel block mutation
  const cancelBlock = useMutation({
    mutationFn: async (block: BookingData) => {
      const { error } = await supabase.from("staff_schedule_overrides").delete().eq("id", block.id);
      if (error) throw error;

      // Log cancellation to HR notes
      const { data: { user } } = await supabase.auth.getUser();
      if (user && block.staff_id) {
        const formattedDate = format(new Date(block.booking_date), "dd MMM yyyy");
        const hrNote = `🚫 BLOCK CANCELLED — ${formattedDate} ${block.booking_time.slice(0, 5)}-${block.end_time?.slice(0, 5) || "?"} — Original reason: ${block.notes || "No reason"}`;
        await supabase.from("staff_notes").insert({
          staff_id: block.staff_id,
          created_by: user.id,
          note: hrNote,
        });
      }
    },
    onSuccess: () => {
      toast.success("Block cancelled & logged to HR notes");
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

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

  const handleEditBlock = useCallback((block: BookingData) => {
    setEditingBlock(block);
    setEditBlockOpen(true);
  }, []);

  const handleCancelBlock = useCallback((block: BookingData) => {
    cancelBlock.mutate(block);
  }, [cancelBlock]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <CalendarHeader
          weekStart={weekStart}
          onPrevWeek={() => setWeekStart(w => addWeeks(w, -1))}
          onNextWeek={() => setWeekStart(w => addWeeks(w, 1))}
          onToday={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        />

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
          onEditBlock={handleEditBlock}
          onCancelBlock={handleCancelBlock}
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

      <EditBlockDialog
        open={editBlockOpen}
        onOpenChange={setEditBlockOpen}
        block={editingBlock}
      />
    </AppLayout>
  );
};

export default BookingsPage;
