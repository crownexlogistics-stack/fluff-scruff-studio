import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import type { BookingData } from "./BookingEvent";

interface EditOvertimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overtime: BookingData | null;
}

export function EditOvertimeDialog({ open, onOpenChange, overtime }: EditOvertimeDialogProps) {
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && overtime) {
      setStartTime(overtime.booking_time.slice(0, 5));
      setEndTime(overtime.end_time?.slice(0, 5) || "");
      setNotes(overtime.notes || "");
    }
  }, [open, overtime]);

  const updateOvertime = useMutation({
    mutationFn: async () => {
      if (!overtime) return;

      const originalStart = overtime.booking_time.slice(0, 5);
      const originalEnd = overtime.end_time?.slice(0, 5) || "Unknown";
      const formattedDate = format(new Date(overtime.booking_date), "dd MMM yyyy");

      const { error } = await supabase.from("staff_schedule_overrides").update({
        start_time: startTime,
        end_time: endTime,
        note: notes.trim() || "Overtime",
      }).eq("id", overtime.id);
      if (error) throw error;

      const changes: string[] = [];
      if (startTime !== originalStart || endTime !== originalEnd) {
        changes.push(`time changed from ${originalStart}-${originalEnd} to ${startTime}-${endTime}`);
      }
      if (notes.trim() !== (overtime.notes || "")) changes.push("notes updated");

      const { data: { user } } = await supabase.auth.getUser();
      if (user && overtime.staff_id) {
        const hrNote = `✏️ OVERTIME AMENDED — ${formattedDate} ${startTime}-${endTime} — ${changes.join(", ")} — Note: ${notes.trim() || "Overtime"}`;
        await supabase.from("staff_notes").insert({
          staff_id: overtime.staff_id,
          created_by: user.id,
          note: hrNote,
        });
      }

      logAudit({
        staffId: overtime.staff_id,
        action: "OVERTIME_AMENDED",
        details: `Amended overtime on ${formattedDate} ${startTime}-${endTime}. ${changes.join(", ")}`,
      });
    },
    onSuccess: () => {
      toast.success("Overtime updated");
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!overtime) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Overtime</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium">{overtime.staff_name}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(overtime.booking_date), "EEEE, dd MMM yyyy")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Saturday cover, extra shift"
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Changes will be logged in the staff member's HR notes and will immediately update customer availability.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => updateOvertime.mutate()} disabled={updateOvertime.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
