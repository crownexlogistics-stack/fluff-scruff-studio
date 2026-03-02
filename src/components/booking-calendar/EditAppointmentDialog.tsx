import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { Mail } from "lucide-react";
import type { BookingData } from "./BookingEvent";

interface EditAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
}

export function EditAppointmentDialog({ open, onOpenChange, booking }: EditAppointmentDialogProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    booking_date: "",
    booking_time: "",
    service_id: "",
    breed_id: "",
    staff_id: "",
    total_price: 0,
    deposit_paid: 0,
    notes: "",
  });

  useEffect(() => {
    if (open && booking) {
      setForm({
        booking_date: booking.booking_date,
        booking_time: booking.booking_time.slice(0, 5),
        service_id: (booking as any).service_id || "",
        breed_id: (booking as any).breed_id || "",
        staff_id: booking.staff_id || "",
        total_price: Number(booking.total_price),
        deposit_paid: Number(booking.deposit_paid),
        notes: booking.notes || "",
      });
    }
  }, [open, booking]);

  const { data: staff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateBooking = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      const { error } = await supabase.from("bookings").update({
        booking_date: form.booking_date,
        booking_time: form.booking_time,
        service_id: form.service_id || null,
        breed_id: form.breed_id || null,
        staff_id: form.staff_id || null,
        total_price: form.total_price,
        deposit_paid: form.deposit_paid,
        notes: form.notes || null,
      }).eq("id", booking.id);
      if (error) throw error;

      logAudit({
        staffId: form.staff_id || undefined,
        action: "BOOKING_EDITED",
        details: `Edited booking for ${booking.customer_name} on ${form.booking_date} at ${form.booking_time}`,
      });
      // Notify groomer of the edit
      if (form.staff_id) {
        supabase.functions.invoke("notify-groomer", {
          body: { booking_id: booking.id, notification_type: "booking_edited" },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success("Appointment updated");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [notifying, setNotifying] = useState(false);
  const handleNotifyClient = async () => {
    if (!booking?.customer_email) {
      toast.error("No customer email on this booking");
      return;
    }
    setNotifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-booking-email", {
        body: { booking_id: booking.id, email_type: "appointment_updated" },
      });
      if (error) throw error;
      toast.success("Update notification sent to " + booking.customer_email);
    } catch (e: any) {
      toast.error("Failed to send: " + e.message);
    } finally {
      setNotifying(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Appointment — {booking.customer_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Time</Label>
              <Input type="time" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} />
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <Label>Service</Label>
              <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Breed</Label>
              <Select value={form.breed_id} onValueChange={(v) => setForm({ ...form, breed_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger>
                <SelectContent>
                  {breeds?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <Label>Total Price (£)</Label>
              <NumericInput value={form.total_price} onValueChange={(v) => setForm({ ...form, total_price: v })} />
            </div>
            <div className="space-y-1">
              <Label>Deposit (£)</Label>
              <NumericInput value={form.deposit_paid} onValueChange={(v) => setForm({ ...form, deposit_paid: v })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={handleNotifyClient}
            disabled={notifying || !booking.customer_email}
            className="sm:mr-auto"
          >
            <Mail className="h-4 w-4 mr-1" />
            {notifying ? "Sending…" : "Notify Client by Email"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => updateBooking.mutate()} disabled={updateBooking.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
