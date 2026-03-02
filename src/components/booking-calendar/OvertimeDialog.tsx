import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface OvertimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultHour?: number;
  defaultStaffId?: string;
}

export function OvertimeDialog({ open, onOpenChange, defaultDate, defaultHour, defaultStaffId }: OvertimeDialogProps) {
  const queryClient = useQueryClient();

  const dateStr = defaultDate ? format(defaultDate, "yyyy-MM-dd") : "";
  const timeStr = defaultHour != null ? `${String(defaultHour).padStart(2, "0")}:00` : "09:00";
  const defaultEndHour = defaultHour != null ? Math.min(defaultHour + 2, 23) : 17;
  const endTimeStr = `${String(defaultEndHour).padStart(2, "0")}:00`;

  const [form, setForm] = useState({
    staff_id: defaultStaffId || "",
    date: dateStr,
    start_time: timeStr,
    end_time: endTimeStr,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        staff_id: defaultStaffId || "",
        date: dateStr,
        start_time: timeStr,
        end_time: endTimeStr,
        notes: "",
      });
    }
  }, [open, defaultDate, defaultHour, defaultStaffId]);

  const { data: staff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createOvertime = useMutation({
    mutationFn: async () => {
      if (!form.staff_id) throw new Error("Please select a staff member.");
      if (!form.start_time || !form.end_time) throw new Error("Please set start and end times.");
      if (form.start_time >= form.end_time) throw new Error("End time must be after start time.");

      const { error } = await supabase.from("staff_schedule_overrides").insert({
        staff_id: form.staff_id,
        override_date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        is_working: true,
        note: form.notes.trim() || "Overtime",
      });
      if (error) throw error;

      const staffName = staff?.find(s => s.id === form.staff_id)?.name || "Unknown";
      const formattedDate = format(new Date(form.date), "dd MMM yyyy");

      // HR note
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const hrNote = `⏱️ OVERTIME ADDED — ${formattedDate} from ${form.start_time.slice(0, 5)} to ${form.end_time.slice(0, 5)} — Note: ${form.notes.trim() || "Overtime"}`;
        try {
          await supabase.from("staff_notes").insert({
            staff_id: form.staff_id,
            created_by: user.id,
            note: hrNote,
          });
        } catch {}
      }

      logAudit({
        staffId: form.staff_id,
        action: "OVERTIME_ADDED",
        details: `Overtime for ${staffName} on ${formattedDate} ${form.start_time.slice(0, 5)}-${form.end_time.slice(0, 5)}`,
      });
    },
    onSuccess: () => {
      toast.success("Overtime added — slots are now available for customers");
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Overtime / Open Calendar</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Open this groomer's calendar for a time when they are normally off. These slots will become available for customer bookings.
        </p>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {defaultDate ? format(defaultDate, "EEEE, dd MMM yyyy") : ""}
            </p>
          </div>

          <div className="space-y-1">
            <Label>Staff Member</Label>
            <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Time</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>End Time</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Saturday cover, extra shift"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createOvertime.mutate()} disabled={createOvertime.isPending}>
            {createOvertime.isPending ? "Saving…" : "Save Overtime"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
