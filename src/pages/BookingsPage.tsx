import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { startOfWeek, addWeeks, format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarHeader } from "@/components/booking-calendar/CalendarHeader";
import { WeeklyCalendar } from "@/components/booking-calendar/WeeklyCalendar";
import { getStaffColor } from "@/components/booking-calendar/staffColors";
import { NewBookingDialog } from "@/components/booking-calendar/NewBookingDialog";
import { EditBlockDialog } from "@/components/booking-calendar/EditBlockDialog";
import { CheckoutDialog } from "@/components/booking-calendar/CheckoutDialog";
import { ViewOrderDialog } from "@/components/booking-calendar/ViewOrderDialog";
import { OvertimeDialog } from "@/components/booking-calendar/OvertimeDialog";
import { EditOvertimeDialog } from "@/components/booking-calendar/EditOvertimeDialog";
import { EditAppointmentDialog } from "@/components/booking-calendar/EditAppointmentDialog";
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
import { CustomerSearchBar } from "@/components/booking-calendar/CustomerSearchBar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const BookingsPage = () => {
  const { user } = useAuth();
  const { role: userRole } = useUserRole(user?.id);
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"appointment" | "block">("appointment");
  const [dialogDefaults, setDialogDefaults] = useState<{ date?: Date; hour?: number; staffId?: string }>({});
  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BookingData | null>(null);

  // New dialog state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<BookingData | null>(null);
  const [viewOrderOpen, setViewOrderOpen] = useState(false);
  const [viewOrderBooking, setViewOrderBooking] = useState<BookingData | null>(null);
  const [editApptOpen, setEditApptOpen] = useState(false);
  const [editApptBooking, setEditApptBooking] = useState<BookingData | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelBooking, setCancelBookingState] = useState<BookingData | null>(null);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeDefaults, setOvertimeDefaults] = useState<{ date?: Date; hour?: number; staffId?: string }>({});
  const [editOvertimeOpen, setEditOvertimeOpen] = useState(false);
  const [editingOvertime, setEditingOvertime] = useState<BookingData | null>(null);

  const weekEnd = addDays(weekStart, 6);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, booking_priority").order("name");
      if (error) throw error;
      return data as { id: string; name: string; booking_priority: number | null }[];
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
        stripe_payment_id: b.stripe_payment_id ?? null,
        is_groomers_own_customer: b.is_groomers_own_customer ?? false,
      })) as BookingData[];
    },
  });

  // Fetch future migrated bookings for calendar display
  const { data: migratedBookings = [] } = useQuery({
    queryKey: ["migrated-calendar-bookings", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("*, migrated_customers(full_name, email, phone)")
        .gte("booking_date", format(weekStart, "yyyy-MM-dd"))
        .lte("booking_date", format(weekEnd, "yyyy-MM-dd"))
        .eq("is_future_booking", true);
      if (error) throw error;
      return (data || []).map((mb: any) => {
        // Match staff by first word of staff_name
        const staffFirstName = mb.staff_name?.split(" ")[0]?.trim() || "";
        const matchedStaff = staff.find(s => s.name.split(" ")[0].toLowerCase() === staffFirstName.toLowerCase());
        const isCompleted = mb.payment_status === "Completed";
        return {
          id: mb.id,
          customer_name: mb.migrated_customers?.full_name || "Unknown",
          dog_name: mb.dog_name || "",
          booking_date: mb.booking_date,
          booking_time: mb.booking_time || "09:00",
          total_price: Number(mb.total_price || 0),
          deposit_paid: Number(mb.deposit_paid || 0),
          status: isCompleted ? "Completed" : "Confirmed",
          notes: mb.notes,
          customer_email: mb.migrated_customers?.email || null,
          customer_phone: mb.migrated_customers?.phone || null,
          staff_name: matchedStaff?.name || mb.staff_name || "Unassigned",
          staff_id: matchedStaff?.id || undefined,
          breed_name: mb.dog_breed || "",
          service_name: mb.service_name || "",
          duration_minutes: mb.duration_minutes || 60,
          is_migrated: true,
          migrated_payment_status: mb.payment_status,
          migrated_amount_due: mb.amount_due != null ? Number(mb.amount_due) : null,
        } as BookingData;
      });
    },
    enabled: staff.length > 0,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["schedule-overrides", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedule_overrides")
        .select("*, staff(name, id)")
        .gte("override_date", format(weekStart, "yyyy-MM-dd"))
        .lte("override_date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []).map((o: any) => {
        // Full-day off: is_working=false with null times — show as full day block
        const isFullDayOff = !o.is_working && !o.start_time && !o.end_time;
        return {
          id: o.id,
          customer_name: o.is_working ? (o.note || "Overtime") : isFullDayOff ? `${o.staff?.name || "Unknown"} — Not working today` : (o.note || "Blocked"),
          dog_name: "",
          booking_date: o.override_date,
          booking_time: o.start_time || "08:00",
          end_time: o.end_time || (isFullDayOff ? "18:00" : undefined),
          total_price: 0,
          deposit_paid: 0,
          status: o.is_working ? "Overtime" : "Blocked",
          notes: isFullDayOff ? "Not working today" : o.note,
          customer_email: null,
          customer_phone: null,
          staff_name: o.staff?.name ?? "Unknown",
          staff_id: o.staff?.id ?? o.staff_id,
          breed_name: "",
          service_name: "",
          is_block: !o.is_working,
          is_overtime: o.is_working,
        } as BookingData;
      });
    },
  });

  const allEvents = useMemo(() => [...bookings, ...migratedBookings, ...overrides], [bookings, migratedBookings, overrides]);

  // Cancel block mutation
  const cancelBlockMutation = useMutation({
    mutationFn: async (block: BookingData) => {
      const { error } = await supabase.from("staff_schedule_overrides").delete().eq("id", block.id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user && block.staff_id) {
        const formattedDate = format(new Date(block.booking_date), "dd MMM yyyy");
        const hrNote = `🚫 BLOCK CANCELLED — ${formattedDate} ${block.booking_time.slice(0, 5)}-${block.end_time?.slice(0, 5) || "?"} — Original reason: ${block.notes || "No reason"}`;
        await supabase.from("staff_notes").insert({ staff_id: block.staff_id, created_by: user.id, note: hrNote });
      }
      logAudit({ staffId: block.staff_id, action: "BLOCK_CANCELLED", details: `Cancelled block on ${format(new Date(block.booking_date), "dd MMM yyyy")} ${block.booking_time.slice(0, 5)}-${block.end_time?.slice(0, 5) || "?"}` });
    },
    onSuccess: () => {
      toast.success("Block cancelled");
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cancel overtime mutation
  const cancelOvertimeMutation = useMutation({
    mutationFn: async (overtime: BookingData) => {
      const { error } = await supabase.from("staff_schedule_overrides").delete().eq("id", overtime.id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user && overtime.staff_id) {
        const formattedDate = format(new Date(overtime.booking_date), "dd MMM yyyy");
        const hrNote = `🚫 OVERTIME CANCELLED — ${formattedDate} ${overtime.booking_time.slice(0, 5)}-${overtime.end_time?.slice(0, 5) || "?"} — Note: ${overtime.notes || "Overtime"}`;
        await supabase.from("staff_notes").insert({ staff_id: overtime.staff_id, created_by: user.id, note: hrNote });
      }
      logAudit({ staffId: overtime.staff_id, action: "OVERTIME_CANCELLED", details: `Cancelled overtime on ${format(new Date(overtime.booking_date), "dd MMM yyyy")} ${overtime.booking_time.slice(0, 5)}-${overtime.end_time?.slice(0, 5) || "?"}` });
    },
    onSuccess: () => {
      toast.success("Overtime removed — slots hidden from customers");
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Complete booking mutation — also creates commission record
  const completeMutation = useMutation({
    mutationFn: async ({ bookingId, finalCharge, isOwnCustomer }: { bookingId: string; finalCharge: number; isOwnCustomer: boolean }) => {
      // Check if this is a migrated booking
      const isMigrated = checkoutBooking?.is_migrated;

      if (isMigrated) {
        const { error } = await supabase.from("migrated_bookings").update({
          payment_status: "Completed",
          amount_due: 0,
        }).eq("id", bookingId);
        if (error) throw error;

        // Find staff for commission
        const migratedBooking = migratedBookings?.find((b: any) => b.id === bookingId);
        const totalPrice = Number(checkoutBooking?.total_price || 0);
        const eventStaffId = migratedBooking?.staff_id || checkoutBooking?.staff_id;
        const rate = isOwnCustomer ? 0.5 : 0.4;
        const groomerPay = Math.round(totalPrice * rate * 100) / 100;
        const studioShare = Math.round((totalPrice - groomerPay) * 100) / 100;

        if (eventStaffId) {
          await supabase.from("commission_records").insert({
            booking_id: null,
            migrated_booking_id: bookingId,
            staff_id: eventStaffId,
            total_price: totalPrice,
            deposit_paid: Number(migratedBooking?.deposit_paid || checkoutBooking?.deposit_paid || 0),
            final_charge: finalCharge,
            commission_type: isOwnCustomer ? "own_customer" : "normal",
            commission_rate: rate,
            groomer_pay: groomerPay,
            studio_share: studioShare,
          } as any);
        }

        logAudit({ staffId: eventStaffId, action: "MIGRATED_BOOKING_COMPLETED", details: `Completed migrated booking for ${checkoutBooking?.customer_name}. Total: £${totalPrice.toFixed(2)}. Final charge: £${finalCharge.toFixed(2)}. Commission: ${isOwnCustomer ? "Own 50%" : "Standard 40%"} = £${groomerPay.toFixed(2)} groomer / £${studioShare.toFixed(2)} studio.` });
      } else {
        const { error } = await (supabase.from("bookings") as any).update({ status: "Completed", final_charge: finalCharge, is_groomers_own_customer: isOwnCustomer }).eq("id", bookingId);
        if (error) throw error;

        // Find the booking to calculate commission on TOTAL SERVICE PRICE (not final charge)
        const booking = bookings.find(b => b.id === bookingId);
        const totalPrice = Number(booking?.total_price || 0);
        const rate = isOwnCustomer ? 0.5 : 0.4;
        const groomerPay = Math.round(totalPrice * rate * 100) / 100;
        const studioShare = Math.round((totalPrice - groomerPay) * 100) / 100;

        if (booking && booking.staff_id) {
          await supabase.from("commission_records").insert({
            booking_id: bookingId,
            staff_id: booking.staff_id,
            total_price: totalPrice,
            deposit_paid: Number(booking.deposit_paid),
            final_charge: finalCharge,
            commission_type: isOwnCustomer ? "own_customer" : "normal",
            commission_rate: rate,
            groomer_pay: groomerPay,
            studio_share: studioShare,
          });
        }

        const expectedRemaining = totalPrice - Number(booking?.deposit_paid || 0);
        const chargeChanged = Math.abs(finalCharge - expectedRemaining) > 0.01;
        const auditParts = [
          `Completed booking for ${booking?.customer_name || "Unknown"} (${booking?.dog_name || "Unknown"}).`,
          `Service: ${booking?.service_name || "Unknown"}.`,
          `Total price: £${totalPrice.toFixed(2)}.`,
          `Deposit: £${Number(booking?.deposit_paid || 0).toFixed(2)}.`,
          chargeChanged
            ? `⚠️ FINAL CHARGE ADJUSTED — Expected: £${expectedRemaining.toFixed(2)} → Actual: £${finalCharge.toFixed(2)}`
            : `Final charge: £${finalCharge.toFixed(2)}.`,
          `Commission: ${isOwnCustomer ? "Own Customer 50%" : "Standard 40%"} = £${groomerPay.toFixed(2)} groomer / £${studioShare.toFixed(2)} studio.`,
        ];
        logAudit({ staffId: booking?.staff_id, action: chargeChanged ? "BOOKING_COMPLETED_CHARGE_ADJUSTED" : "BOOKING_COMPLETED", details: auditParts.join(" ") });
      }
    },
    onSuccess: () => {
      toast.success("Appointment completed");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["migrated-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["commission-records"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // No Show mutation — creates commission record (50% of deposit)
  const noShowMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("bookings").update({ status: "No Show" }).eq("id", bookingId);
      if (error) throw error;

      // Calculate no-show commission: groomer gets 50% of deposit
      const booking = bookings.find(b => b.id === bookingId);
      if (booking && booking.staff_id) {
        const deposit = Number(booking.deposit_paid);
        const groomerPay = Math.round(deposit * 0.5 * 100) / 100;
        const studioShare = Math.round((deposit - groomerPay) * 100) / 100;

        await supabase.from("commission_records").insert({
          booking_id: bookingId,
          staff_id: booking.staff_id,
          total_price: Number(booking.total_price),
          deposit_paid: deposit,
          final_charge: 0,
          commission_type: "no_show",
          commission_rate: 0.5,
          groomer_pay: groomerPay,
          studio_share: studioShare,
        });
      }

      const noShowGroomerPay = booking ? Math.round(Number(booking.deposit_paid) * 0.5 * 100) / 100 : 0;
      logAudit({ staffId: booking?.staff_id, action: "BOOKING_NO_SHOW", details: `No Show: ${booking?.customer_name || "Unknown"} (${booking?.dog_name || "Unknown"}) on ${booking ? format(new Date(booking.booking_date), "dd MMM yyyy") : "?"} at ${booking?.booking_time?.slice(0, 5) || "?"}. Deposit held: £${Number(booking?.deposit_paid || 0).toFixed(2)}. Groomer pay: £${noShowGroomerPay.toFixed(2)}.` });
      supabase.functions.invoke("send-booking-email", { body: { booking_id: bookingId, email_type: "no_show" } }).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Marked as No Show");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["commission-records"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (booking: BookingData) => {
      // Use cancel-with-refund edge function for auto-refund if 48h+ away
      const { data, error } = await supabase.functions.invoke("cancel-booking-with-refund", {
        body: { booking_id: booking.id, cancelled_by: "staff" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { booking, result: data };
    },
    onSuccess: ({ booking, result }) => {
      if (result?.refunded) {
        toast.success(`Booking cancelled. Refund of £${result.refund_amount?.toFixed(2)} processed automatically (48h+ policy). Please advise the customer: "Your appointment has been cancelled and your deposit has been refunded. It should appear in your account within 5-10 business days."`);
      } else {
        toast.success(`Booking cancelled. Deposit of £${Number(booking.deposit_paid).toFixed(2)} retained (within 48h). Please advise the customer: "Your appointment has been cancelled. As per our policy, the deposit is non-refundable for cancellations within 48 hours."`);
      }
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setCancelConfirmOpen(false);
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

  const handleOvertime = useCallback((date: Date, hour: number, staffId: string) => {
    setOvertimeDefaults({ date, hour, staffId });
    setOvertimeOpen(true);
  }, []);

  const handleEditBlock = useCallback((block: BookingData) => {
    setEditingBlock(block);
    setEditBlockOpen(true);
  }, []);

  const handleCancelBlock = useCallback((block: BookingData) => {
    cancelBlockMutation.mutate(block);
  }, [cancelBlockMutation]);

  const handleEditOvertime = useCallback((overtime: BookingData) => {
    setEditingOvertime(overtime);
    setEditOvertimeOpen(true);
  }, []);

  const handleCancelOvertime = useCallback((overtime: BookingData) => {
    cancelOvertimeMutation.mutate(overtime);
  }, [cancelOvertimeMutation]);

  const handleViewOrder = useCallback((booking: BookingData) => {
    setViewOrderBooking(booking);
    setViewOrderOpen(true);
  }, []);

  const handleEditAppointment = useCallback((booking: BookingData) => {
    setEditApptBooking(booking);
    setEditApptOpen(true);
  }, []);

  const handleCancelBooking = useCallback((booking: BookingData) => {
    setCancelBookingState(booking);
    setCancelConfirmOpen(true);
  }, []);

  const handleBookAgain = useCallback((booking: BookingData) => {
    setDialogMode("appointment");
    setDialogDefaults({ date: new Date(booking.booking_date), staffId: booking.staff_id });
    setDialogOpen(true);
  }, []);

  const handleCheckout = useCallback((booking: BookingData) => {
    setCheckoutBooking(booking);
    setCheckoutOpen(true);
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4">
        <CustomerSearchBar className="max-w-lg" />

        <CalendarHeader
          weekStart={weekStart}
          onPrevWeek={() => setWeekStart(w => addWeeks(w, -1))}
          onNextWeek={() => setWeekStart(w => addWeeks(w, 1))}
          onToday={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        />

        <div className="flex flex-wrap gap-2">
          {staff.map((s, i) => {
            const colors = getStaffColor(i);
            const priorityEmoji = s.booking_priority === 1 ? "🥇" : s.booking_priority === 2 ? "🥈" : s.booking_priority === 3 ? "🥉" : null;
            return (
              <div key={s.id} className="flex items-center gap-1.5 text-xs">
                <div className={cn("h-3 w-3 rounded-sm", colors.bg)} />
                <span>{s.name}</span>
                {priorityEmoji && <span className="text-[10px]">{priorityEmoji}</span>}
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
      </div>

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

      <EditOvertimeDialog
        open={editOvertimeOpen}
        onOpenChange={setEditOvertimeOpen}
        overtime={editingOvertime}
      />

      <EditBlockDialog
        open={editBlockOpen}
        onOpenChange={setEditBlockOpen}
        block={editingBlock}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        booking={checkoutBooking}
        onComplete={(id, charge, isOwn) => completeMutation.mutate({ bookingId: id, finalCharge: charge, isOwnCustomer: isOwn })}
        onNoShow={(id) => noShowMutation.mutate(id)}
      />

      <ViewOrderDialog
        open={viewOrderOpen}
        onOpenChange={setViewOrderOpen}
        booking={viewOrderBooking}
        userRole={userRole}
        onRefundComplete={() => queryClient.invalidateQueries({ queryKey: ["bookings"] })}
      />

      <EditAppointmentDialog
        open={editApptOpen}
        onOpenChange={setEditApptOpen}
        booking={editApptBooking}
      />

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {cancelBooking?.customer_name}'s appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelBooking && cancelBookingMutation.mutate(cancelBooking)}
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default BookingsPage;
