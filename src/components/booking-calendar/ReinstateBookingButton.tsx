import { useState } from "react";
import { format } from "date-fns";
import { Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { logAudit } from "@/lib/auditLog";
import { logGroomerActivity } from "@/lib/logGroomerActivity";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";

export interface ReinstatableBooking {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  total_price: number;
  deposit_paid: number;
  status: string;
  staff_id?: string | null;
  staff_name?: string | null;
  service_name?: string | null;
  breed_name?: string | null;
  duration_minutes?: number | null;
  end_time?: string | null;
  is_migrated?: boolean;
  booking_source?: string | null;
}

const REINSTATABLE = ["Cancelled", "No Show", "Refunded"];

export function canReinstate(booking: { status: string; booking_source?: string | null }) {
  return (
    REINSTATABLE.includes(booking.status) &&
    booking.booking_source !== "package" &&
    booking.booking_source !== "package_online"
  );
}

function minutesOf(time: string) {
  const [h, m] = time.split(":");
  return parseInt(h) * 60 + parseInt(m || "0");
}

export function ReinstateBookingButton({
  booking,
  onDone,
  className,
}: {
  booking: ReinstatableBooking;
  onDone?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clash, setClash] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const queryClient = useQueryClient();
  const { staff } = useCurrentStaff();

  const deposit = Number(booking.deposit_paid || 0);
  const total = Number(booking.total_price || 0);
  const wasRefunded = booking.status === "Refunded";
  const depositAfter = wasRefunded ? 0 : deposit;
  const dueAfter = Math.max(0, total - depositAfter);

  const openDialog = async () => {
    setOpen(true);
    setClash(null);
    if (!booking.staff_id) return;
    setChecking(true);
    try {
      const startMin = minutesOf(booking.booking_time);
      const endMin = booking.end_time
        ? minutesOf(booking.end_time)
        : startMin + (booking.duration_minutes || 90);

      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, booking_time, end_time, duration_minutes, status")
        .eq("staff_id", booking.staff_id)
        .eq("booking_date", booking.booking_date)
        .neq("id", booking.id);

      const conflicts = (data || []).filter((b: any) => {
        if (["Cancelled", "No Show", "Refunded"].includes(b.status)) return false;
        const s = minutesOf(b.booking_time);
        const e = b.end_time ? minutesOf(b.end_time) : s + (b.duration_minutes || 90);
        return s < endMin && e > startMin;
      });

      if (conflicts.length > 0) {
        setClash(
          conflicts
            .map((c: any) => `${c.customer_name} at ${c.booking_time.slice(0, 5)}`)
            .join(", ")
        );
      }
    } catch {
      // clash check is advisory only
    } finally {
      setChecking(false);
    }
  };

  const handleReinstate = async () => {
    setBusy(true);
    try {
      const who = staff?.name || "Staff";

      // Wix/migrated appointments live in their own table and have no audit rows
      if (booking.is_migrated) {
        const { error: migErr } = await (supabase.from("migrated_bookings") as any)
          .update({ payment_status: null, is_future_booking: true })
          .eq("id", booking.id);
        if (migErr) throw migErr;

        logAudit({
          staffId: booking.staff_id || undefined,
          action: "BOOKING_REINSTATED",
          details: `Reinstated Wix appointment for ${booking.customer_name} (${booking.dog_name}) on ${format(new Date(booking.booking_date), "dd MMM yyyy")} at ${booking.booking_time.slice(0, 5)} by ${who}.`,
        });

        toast.success("Appointment reinstated");
        queryClient.invalidateQueries({ queryKey: ["bookings"] });
        queryClient.invalidateQueries({ queryKey: ["migrated-calendar-bookings"] });
        queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
        setOpen(false);
        onDone?.();
        return;
      }

      // Work out the status the appointment had before it was cancelled
      let restoredStatus: string | null = null;
      const { data: history } = await supabase
        .from("booking_audit_log" as any)
        .select("event_type, note, performed_at")
        .eq("booking_id", booking.id)
        .order("performed_at", { ascending: false })
        .limit(20);

      const cancelEntry = (history as any[] | null)?.find(
        (h) => h.event_type === "cancelled" || (h.event_type === "status_changed" && /cancel/i.test(h.note || ""))
      );
      const match = cancelEntry?.note?.match(/was\s+(Pending|Confirmed|Completed)/i);
      if (match) restoredStatus = match[1];
      if (!restoredStatus) restoredStatus = depositAfter > 0 ? "Confirmed" : "Pending";

      const update: Record<string, any> = { status: restoredStatus };
      if (wasRefunded) update.deposit_paid = 0;

      const { error } = await (supabase.from("bookings") as any)
        .update(update)
        .eq("id", booking.id);
      if (error) throw error;

      const cancelledAt = cancelEntry?.performed_at
        ? format(new Date(cancelEntry.performed_at), "dd MMM yyyy, HH:mm")
        : null;
      const note =
        `Reinstated by ${who} — back to ${restoredStatus} on ${format(new Date(booking.booking_date), "dd MMM yyyy")} at ${booking.booking_time.slice(0, 5)} with ${booking.staff_name || "the same groomer"}.` +
        (cancelledAt ? ` Was cancelled ${cancelledAt}.` : "") +
        (wasRefunded
          ? ` Deposit reset to £0.00 — £${deposit.toFixed(2)} had already been refunded to the customer, so payment is due again.`
          : "") +
        (clash ? ` Warning: slot already had ${clash}.` : "");

      await supabase.from("booking_audit_log" as any).insert({
        booking_id: booking.id,
        event_type: "reinstated",
        performed_by: who,
        note,
      });

      logAudit({
        staffId: booking.staff_id || undefined,
        action: "BOOKING_REINSTATED",
        details: `${note} Customer: ${booking.customer_name} (${booking.dog_name}).`,
      });

      if (staff?.id) {
        logGroomerActivity({
          staffId: staff.id,
          actionType: "booking_reinstated",
          actionSummary: `Reinstated ${booking.customer_name}'s appointment (${booking.dog_name})`,
          bookingId: booking.id,
          customerName: booking.customer_name,
          dogName: booking.dog_name,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          serviceName: booking.service_name || undefined,
        });
      }

      toast.success(
        wasRefunded
          ? "Appointment reinstated — deposit now shows as due again"
          : "Appointment reinstated"
      );

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-audit-log", booking.id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setOpen(false);
      onDone?.();
    } catch (e: any) {
      toast.error("Could not reinstate: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  if (!canReinstate(booking)) return null;

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={openDialog}>
        <Undo2 className="h-3.5 w-3.5 mr-1" /> Reinstate
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reinstate this appointment?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>It will go back in the diary exactly as it was booked:</p>
                <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                  <div className="flex justify-between"><span>Date &amp; time</span><span className="font-medium">{format(new Date(booking.booking_date), "EEE d MMM yyyy")} at {booking.booking_time.slice(0, 5)}</span></div>
                  <div className="flex justify-between"><span>Groomer</span><span className="font-medium">{booking.staff_name || "—"}</span></div>
                  <div className="flex justify-between"><span>Customer</span><span className="font-medium">{booking.customer_name}</span></div>
                  <div className="flex justify-between"><span>Dog</span><span className="font-medium">{booking.dog_name}{booking.breed_name ? ` (${booking.breed_name})` : ""}</span></div>
                  <div className="flex justify-between"><span>Service</span><span className="font-medium">{booking.service_name || "Grooming"}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span>Total</span><span className="font-semibold">£{total.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Paid</span><span className="font-semibold">£{depositAfter.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Still due</span><span className="font-bold">£{dueAfter.toFixed(2)}</span></div>
                </div>

                {wasRefunded && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                    £{deposit.toFixed(2)} was already refunded to the customer, so the appointment comes back with the deposit
                    showing as <strong>due again</strong>. Take payment or send a payment link as normal.
                  </div>
                )}

                {checking && <p className="text-muted-foreground">Checking the slot…</p>}

                {clash && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      That slot is already taken with {booking.staff_name || "this groomer"}: {clash}. You can still go ahead —
                      both appointments will show on the calendar.
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleReinstate(); }} disabled={busy}>
              {busy ? "Reinstating…" : "Yes, reinstate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
