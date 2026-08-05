import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarIcon, Loader2, RotateCcw } from "lucide-react";

export interface PackageSessionRow {
  id: string;
  booking_id: string | null;
  session_number: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  session: PackageSessionRow | null;
  packageBookingId: string;
  mode: "reinstate" | "cancel";
  performedBy: string;
  onDone: () => void;
}

type Step = "choice" | "warning" | "pick" | "cancel";

export function SessionStatusDialog({ open, onClose, session, packageBookingId, mode, performedBy, onDone }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(mode === "cancel" ? "cancel" : "choice");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    setStep(mode === "cancel" ? "cancel" : "choice");
    setDate(session.scheduled_date ? new Date(session.scheduled_date + "T00:00:00") : undefined);
    setTime(session.scheduled_time?.slice(0, 5) || "");
  }, [open, session, mode]);

  if (!session) return null;

  const originalLabel = session.scheduled_date
    ? `${format(new Date(session.scheduled_date + "T00:00:00"), "dd MMM yyyy")}${session.scheduled_time ? ` at ${session.scheduled_time.slice(0, 5)}` : ""}`
    : "no date set";

  const logAudit = async (payload: Record<string, any>) => {
    await supabase.from("package_payment_audit" as any).insert({
      package_booking_id: packageBookingId,
      package_session_id: session.id,
      booking_id: session.booking_id,
      performed_by: performedBy,
      ...payload,
    });
  };

  const applyChange = async (opts: { newDate?: string; newTime?: string; toStatus: "scheduled" | "cancelled" }) => {
    const { newDate, newTime, toStatus } = opts;
    setSaving(true);
    try {
      if (session.booking_id) {
        const update: Record<string, any> = {
          status: toStatus === "scheduled" ? "Confirmed" : "Cancelled",
        };
        if (newDate) update.booking_date = newDate;
        if (newTime) update.booking_time = `${newTime}:00`;
        const { error } = await supabase.from("bookings").update(update).eq("id", session.booking_id);
        if (error) throw error;
      }

      // Fallback / safety net: keep the session row in step even if the
      // booking link is missing or the mirror trigger doesn't fire.
      const sessUpdate: Record<string, any> = { status: toStatus };
      if (newDate) sessUpdate.scheduled_date = newDate;
      if (newTime) sessUpdate.scheduled_time = `${newTime}:00`;
      const { error: sErr } = await supabase
        .from("package_sessions" as any)
        .update(sessUpdate)
        .eq("id", session.id);
      if (sErr) throw sErr;

      const changedDateTime = !!(newDate || newTime);
      await logAudit({
        event_type: changedDateTime ? "session_rescheduled" : "session_status_changed",
        old_status: session.status,
        new_status: toStatus,
        old_date: session.scheduled_date,
        old_time: session.scheduled_time,
        new_date: newDate || session.scheduled_date,
        new_time: newTime ? `${newTime}:00` : session.scheduled_time,
        note:
          toStatus === "scheduled"
            ? changedDateTime
              ? `Session ${session.session_number} reinstated with amended date/time by ${performedBy}.`
              : `Session ${session.session_number} reinstated at its original date/time by ${performedBy}.`
            : `Session ${session.session_number} cancelled by ${performedBy}.`,
      });

      toast.success(toStatus === "scheduled" ? "Session reinstated" : "Session cancelled");
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update session");
    } finally {
      setSaving(false);
    }
  };

  const goToCalendar = () => {
    onClose();
    if (session.booking_id) {
      navigate(`/bookings?highlight=${session.booking_id}`);
    } else {
      navigate("/bookings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        {step === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                Reinstate session {session.session_number}?
              </DialogTitle>
              <DialogDescription>
                Original slot: <strong>{originalLabel}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={saving || !session.scheduled_date}
                onClick={() => applyChange({ toStatus: "scheduled" })}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Keep original date &amp; time
              </Button>
              <Button variant="outline" className="w-full" disabled={saving} onClick={() => setStep("warning")}>
                Amend date &amp; time
              </Button>
            </div>
          </>
        )}

        {step === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Amend on the calendar first
              </DialogTitle>
              <DialogDescription>
                The appointment must be amended on the actual calendar before you record the new slot here.
                Have you already amended it on the calendar?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={goToCalendar}>
                No — take me to the calendar
              </Button>
              <Button onClick={() => setStep("pick")}>Yes</Button>
            </DialogFooter>
          </>
        )}

        {step === "pick" && (
          <>
            <DialogHeader>
              <DialogTitle>New date &amp; time</DialogTitle>
              <DialogDescription>Record when this session has been amended for.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep("choice")} disabled={saving}>
                Back
              </Button>
              <Button
                disabled={saving || !date || !time}
                onClick={() =>
                  applyChange({
                    toStatus: "scheduled",
                    newDate: date ? format(date, "yyyy-MM-dd") : undefined,
                    newTime: time,
                  })
                }
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "cancel" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Cancel session {session.session_number}?
              </DialogTitle>
              <DialogDescription>
                This cancels the appointment on {originalLabel}. You can reinstate it from here later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Go back
              </Button>
              <Button variant="destructive" disabled={saving} onClick={() => applyChange({ toStatus: "cancelled" })}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cancel session
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
