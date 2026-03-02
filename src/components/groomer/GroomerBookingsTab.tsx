import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { format, addDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, List, ChevronLeft, ChevronRight, Dog } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { GroomerCalendar, type GroomerCalendarBooking } from "./GroomerCalendar";
import { Card, CardContent } from "@/components/ui/card";
import { BookingPopoverCard } from "@/components/booking-calendar/BookingPopoverCard";
import { NewBookingDialog } from "@/components/booking-calendar/NewBookingDialog";
import { OvertimeDialog } from "@/components/booking-calendar/OvertimeDialog";
import { EditOvertimeDialog } from "@/components/booking-calendar/EditOvertimeDialog";
import { EditBlockDialog } from "@/components/booking-calendar/EditBlockDialog";
import { CheckoutDialog } from "@/components/booking-calendar/CheckoutDialog";
import { ViewOrderDialog } from "@/components/booking-calendar/ViewOrderDialog";
import { EditAppointmentDialog } from "@/components/booking-calendar/EditAppointmentDialog";
import { CustomerSearchBar } from "@/components/booking-calendar/CustomerSearchBar";
import type { BookingData } from "@/components/booking-calendar/BookingEvent";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GroomerBookingsTabProps {
  staffId: string;
  userRole?: string | null;
}

type ViewMode = "1day" | "3day" | "7day" | "list";

export function GroomerBookingsTab({ staffId, userRole }: GroomerBookingsTabProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>(() => isMobile ? "3day" : "7day");
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"appointment" | "block">("appointment");
  const [dialogDefaults, setDialogDefaults] = useState<{ date?: Date; hour?: number; staffId?: string }>({});
  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BookingData | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<BookingData | null>(null);
  const [viewOrderOpen, setViewOrderOpen] = useState(false);
  const [viewOrderBooking, setViewOrderBooking] = useState<BookingData | null>(null);
  const [editApptOpen, setEditApptOpen] = useState(false);
  const [editApptBooking, setEditApptBooking] = useState<BookingData | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelBookingData, setCancelBookingData] = useState<BookingData | null>(null);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeDefaults, setOvertimeDefaults] = useState<{ date?: Date; hour?: number; staffId?: string }>({});
  const [editOvertimeOpen, setEditOvertimeOpen] = useState(false);
  const [editingOvertime, setEditingOvertime] = useState<BookingData | null>(null);

  const { data: allStaff = [] } = useQuery({
    queryKey: ["staff-list-groomer"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const daysToShow = viewMode === "1day" ? 1 : viewMode === "3day" ? 3 : viewMode === "7day" ? 7 : 7;
  const endDate = addDays(currentDate, daysToShow - 1);

  const { data: bookings = [] } = useQuery({
    queryKey: ["groomer-bookings", format(currentDate, "yyyy-MM-dd"), daysToShow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, dog_name, booking_date, booking_time, status, notes, staff_id, total_price, deposit_paid, customer_email, customer_phone, service_id, breed_id, final_charge, stripe_payment_id, services(name), breeds(name, duration_minutes)")
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
        breed_duration_minutes: b.breeds?.duration_minutes ?? undefined,
        total_price: b.total_price,
        deposit_paid: b.deposit_paid,
        customer_email: b.customer_email,
        customer_phone: b.customer_phone,
        service_id: b.service_id,
        breed_id: b.breed_id,
        final_charge: b.final_charge,
        stripe_payment_id: b.stripe_payment_id ?? null,
        is_block: false,
        is_own: b.staff_id === staffId,
      })) as GroomerCalendarBooking[];
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
        .lte("override_date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []).map((o: any) => ({
        id: o.id,
        customer_name: o.is_working ? (o.note || "Overtime") : (o.note || "Blocked"),
        dog_name: "",
        booking_date: o.override_date,
        booking_time: o.start_time || "09:00",
        end_time: o.end_time || undefined,
        status: o.is_working ? "Overtime" : "Blocked",
        notes: o.note,
        staff_id: o.staff?.id ?? o.staff_id,
        staff_name: o.staff?.name ?? "Unknown",
        service_name: "",
        breed_name: "",
        is_block: !o.is_working,
        is_overtime: o.is_working,
        is_own: (o.staff?.id ?? o.staff_id) === staffId,
        total_price: 0,
        deposit_paid: 0,
        customer_email: null,
        customer_phone: null,
      })) as GroomerCalendarBooking[];
    },
  });

  const allEvents = useMemo(() => [...bookings, ...overrides], [bookings, overrides]);

  const ownBookings = useMemo(() =>
    bookings
      .filter(b => b.is_own && !b.is_block)
      .sort((a, b) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`)),
    [bookings]
  );

  const today = format(new Date(), "yyyy-MM-dd");

  // Helper to map to BookingData for shared dialogs
  const toBookingData = (b: GroomerCalendarBooking): BookingData => ({
    id: b.id,
    customer_name: b.customer_name,
    dog_name: b.dog_name,
    booking_date: b.booking_date,
    booking_time: b.booking_time,
    total_price: b.total_price || 0,
    deposit_paid: b.deposit_paid || 0,
    status: b.status,
    notes: b.notes,
    customer_email: b.customer_email || null,
    customer_phone: b.customer_phone || null,
    staff_name: b.staff_name,
    staff_id: b.staff_id,
    breed_name: b.breed_name,
    service_name: b.service_name,
    is_block: b.is_block,
    end_time: b.end_time,
    service_id: b.service_id,
    breed_id: b.breed_id,
    final_charge: b.final_charge,
    stripe_payment_id: b.stripe_payment_id ?? null,
  });

  const handleBook = useCallback((date: Date, hour: number, sid: string) => {
    setDialogMode("appointment");
    setDialogDefaults({ date, hour, staffId: sid });
    setDialogOpen(true);
  }, []);

  const handleBlock = useCallback((date: Date, hour: number, sid: string) => {
    setDialogMode("block");
    setDialogDefaults({ date, hour, staffId: sid });
    setDialogOpen(true);
  }, []);

  const handleOvertime = useCallback((date: Date, hour: number, sid: string) => {
    setOvertimeDefaults({ date, hour, staffId: sid });
    setOvertimeOpen(true);
  }, []);

  const handleEditBlock = useCallback((block: GroomerCalendarBooking) => {
    setEditingBlock(toBookingData(block));
    setEditBlockOpen(true);
  }, []);

  const handleEditOvertime = useCallback((overtime: GroomerCalendarBooking) => {
    setEditingOvertime(toBookingData(overtime));
    setEditOvertimeOpen(true);
  }, []);

  // handleCancelOvertime defined after cancelBlock mutation below

  const handleViewOrder = useCallback((booking: GroomerCalendarBooking) => {
    setViewOrderBooking(toBookingData(booking));
    setViewOrderOpen(true);
  }, []);

  const handleEditAppointment = useCallback((booking: GroomerCalendarBooking) => {
    setEditApptBooking(toBookingData(booking));
    setEditApptOpen(true);
  }, []);

  const handleCancelBooking = useCallback((booking: GroomerCalendarBooking) => {
    setCancelBookingData(toBookingData(booking));
    setCancelConfirmOpen(true);
  }, []);

  const handleBookAgain = useCallback((booking: GroomerCalendarBooking) => {
    setDialogMode("appointment");
    setDialogDefaults({ date: new Date(booking.booking_date), staffId: booking.staff_id });
    setDialogOpen(true);
  }, []);

  const handleCheckout = useCallback((booking: GroomerCalendarBooking) => {
    setCheckoutBooking(toBookingData(booking));
    setCheckoutOpen(true);
  }, []);

  const cancelBlock = useMutation({
    mutationFn: async (block: GroomerCalendarBooking) => {
      const { error } = await supabase.from("staff_schedule_overrides").delete().eq("id", block.id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user && block.staff_id) {
        const formattedDate = format(new Date(block.booking_date), "dd MMM yyyy");
        const hrNote = `🚫 BLOCK CANCELLED — ${formattedDate} ${block.booking_time?.slice(0, 5)}-${block.end_time?.slice(0, 5) || "?"} — Original reason: ${block.notes || "No reason"}`;
        try {
          await supabase.from("staff_notes").insert({ staff_id: block.staff_id, created_by: user.id, note: hrNote });
        } catch {}
      }
      logAudit({ staffId: block.staff_id, action: "BLOCK_CANCELLED", details: `Cancelled block on ${format(new Date(block.booking_date), "dd MMM yyyy")} ${block.booking_time?.slice(0, 5)}-${block.end_time?.slice(0, 5) || "?"}` });
    },
    onSuccess: () => {
      toast.success("Block cancelled");
      queryClient.invalidateQueries({ queryKey: ["groomer-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ bookingId, finalCharge }: { bookingId: string; finalCharge: number }) => {
      const { error } = await (supabase.from("bookings") as any).update({ status: "Completed", final_charge: finalCharge }).eq("id", bookingId);
      if (error) throw error;
      logAudit({ action: "BOOKING_COMPLETED", details: `Completed booking ${bookingId}. Final charge: £${finalCharge.toFixed(2)}` });
    },
    onSuccess: () => {
      toast.success("Appointment completed");
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const noShowMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("bookings").update({ status: "No Show" }).eq("id", bookingId);
      if (error) throw error;
      logAudit({ action: "BOOKING_NO_SHOW", details: `Marked booking ${bookingId} as No Show` });
      supabase.functions.invoke("send-booking-email", { body: { booking_id: bookingId, email_type: "no_show" } }).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Marked as No Show");
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (booking: BookingData) => {
      const { error } = await supabase.from("bookings").update({ status: "Cancelled" }).eq("id", booking.id);
      if (error) throw error;
      logAudit({ action: "BOOKING_CANCELLED", details: `Cancelled booking ${booking.id}` });
      if (booking.staff_id) {
        supabase.functions.invoke("notify-groomer", { body: { booking_id: booking.id, notification_type: "booking_cancelled" } }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
      setCancelConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCancelBlock = useCallback((block: GroomerCalendarBooking) => {
    cancelBlock.mutate(block);
  }, [cancelBlock]);

  const handleCancelOvertime = useCallback((overtime: GroomerCalendarBooking) => {
    cancelBlock.mutate(overtime);
  }, [cancelBlock]);

  return (
    <div className="space-y-4">
      {/* Customer Search */}
      <CustomerSearchBar currentStaffId={staffId} />

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
          <Button variant={viewMode === "1day" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("1day")}>1 Day</Button>
          <Button variant={viewMode === "3day" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("3day")}>3 Day</Button>
          <Button variant={viewMode === "7day" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("7day")}>7 Day</Button>
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
          userRole={userRole}
          onBook={handleBook}
          onBlock={handleBlock}
          onOvertime={handleOvertime}
          onEditBlock={handleEditBlock}
          onCancelBlock={handleCancelBlock}
          onEditOvertime={handleEditOvertime}
          onCancelOvertime={handleCancelOvertime}
          onViewOrder={handleViewOrder}
          onEditAppointment={handleEditAppointment}
          onCancelBooking={handleCancelBooking}
          onBookAgain={handleBookAgain}
          onCheckout={handleCheckout}
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
              const bookingData = toBookingData(b);
              const sIdx = allStaff.findIndex(s => s.id === b.staff_id);
              return (
                <Popover key={b.id}>
                  <PopoverTrigger asChild>
                    <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", isPast && "opacity-50")}>
                      <CardContent className="p-4 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Dog className="h-4 w-4 text-accent" />
                            <span className="font-semibold text-sm">{b.dog_name}</span>
                            <span
                              className="text-muted-foreground text-xs hover:underline hover:text-foreground cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (b.customer_email) navigate(`/admin/customers/${encodeURIComponent(b.customer_email)}`);
                              }}
                            >
                              ({b.customer_name})
                            </span>
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
                        <Badge variant={b.status === "Completed" ? "default" : b.status === "Confirmed" ? "secondary" : b.status === "Cancelled" || b.status === "No Show" ? "destructive" : "outline"} className="text-xs shrink-0">
                          {b.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-0" side="bottom" align="start" sideOffset={4}>
                    <BookingPopoverCard
                      booking={bookingData}
                      staffIndex={sIdx >= 0 ? sIdx : 0}
                      userRole={userRole}
                      onEditBlock={b.is_block ? (bd) => handleEditBlock(b) : undefined}
                      onCancelBlock={b.is_block ? (bd) => handleCancelBlock(b) : undefined}
                      onViewOrder={(bd) => handleViewOrder(b)}
                      onEditAppointment={(bd) => handleEditAppointment(b)}
                      onCancelBooking={(bd) => handleCancelBooking(b)}
                      onBookAgain={(bd) => handleBookAgain(b)}
                      onCheckout={(bd) => handleCheckout(b)}
                      onRefundComplete={() => queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] })}
                    />
                  </PopoverContent>
                </Popover>
              );
            })
          )}
        </div>
      )}

      {/* Dialogs */}
      <NewBookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={dialogDefaults.date}
        defaultHour={dialogDefaults.hour}
        defaultStaffId={dialogDefaults.staffId}
        mode={dialogMode}
      />
      <OvertimeDialog
        open={overtimeOpen}
        onOpenChange={setOvertimeOpen}
        defaultDate={overtimeDefaults.date}
        defaultHour={overtimeDefaults.hour}
        defaultStaffId={overtimeDefaults.staffId}
      />
      <EditOvertimeDialog open={editOvertimeOpen} onOpenChange={setEditOvertimeOpen} overtime={editingOvertime} />
      <EditBlockDialog open={editBlockOpen} onOpenChange={setEditBlockOpen} block={editingBlock} />
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        booking={checkoutBooking}
        onComplete={(id, charge) => completeMutation.mutate({ bookingId: id, finalCharge: charge })}
        onNoShow={(id) => noShowMutation.mutate(id)}
      />
      <ViewOrderDialog open={viewOrderOpen} onOpenChange={setViewOrderOpen} booking={viewOrderBooking} />
      <EditAppointmentDialog open={editApptOpen} onOpenChange={setEditApptOpen} booking={editApptBooking} />

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {cancelBookingData?.customer_name}'s appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelBookingData && cancelBookingMutation.mutate(cancelBookingData)}
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
