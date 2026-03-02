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
import type { BookingData } from "./BookingEvent";

interface EditBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: BookingData | null;
}

export function EditBlockDialog({ open, onOpenChange, block }: EditBlockDialogProps) {
  const queryClient = useQueryClient();
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && block) {
      setEndTime(block.end_time?.slice(0, 5) || "");
      setNotes(block.notes || "");
    }
  }, [open, block]);

  const updateBlock = useMutation({
    mutationFn: async () => {
      if (!block) return;
      if (!notes.trim()) throw new Error("Reason is required.");

      const originalStart = block.booking_time.slice(0, 5);
      const originalEnd = block.end_time?.slice(0, 5) || "Unknown";
      const formattedDate = format(new Date(block.booking_date), "dd MMM yyyy");

      // Update the override
      const { error } = await supabase.from("staff_schedule_overrides").update({
        end_time: endTime,
        note: notes.trim(),
      }).eq("id", block.id);
      if (error) throw error;

      // Log amendment to HR notes
      const { data: { user } } = await supabase.auth.getUser();
      if (user && block.staff_id) {
        const changes: string[] = [];
        if (endTime !== originalEnd) changes.push(`time changed from ${originalStart}-${originalEnd} to ${originalStart}-${endTime}`);
        if (notes.trim() !== block.notes) changes.push(`reason updated`);
        const hrNote = `✏️ BLOCK AMENDED — ${formattedDate} ${originalStart}-${endTime} — ${changes.join(", ")} — Current reason: ${notes.trim()}`;
        await supabase.from("staff_notes").insert({
          staff_id: block.staff_id,
          created_by: user.id,
          note: hrNote,
        });
      }
    },
    onSuccess: () => {
      toast.success("Block updated & amendment logged to HR notes");
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!block) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Blocked Time</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium">{block.staff_name}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(block.booking_date), "EEEE, dd MMM yyyy")} — from {block.booking_time.slice(0, 5)}
            </p>
          </div>

          <div className="space-y-1">
            <Label>End Time</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Reason / Notes <span className="text-destructive">*</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for block (required)"
              rows={3}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Changes will be logged as an amendment in the staff member's HR notes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => updateBlock.mutate()} disabled={updateBlock.isPending || !notes.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
