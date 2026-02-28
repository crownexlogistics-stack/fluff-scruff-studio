import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultHour?: number;
  defaultStaffId?: string;
  mode: "appointment" | "block";
}

export function NewBookingDialog({ open, onOpenChange, defaultDate, defaultHour, defaultStaffId, mode }: NewBookingDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer_name: "",
    dog_name: "",
    customer_email: "",
    customer_phone: "",
    breed_id: "",
    service_id: "",
    staff_id: defaultStaffId || "",
    booking_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    booking_time: defaultHour ? `${String(defaultHour).padStart(2, "0")}:00` : "09:00",
    total_price: 0,
    deposit_paid: 0,
    notes: "",
  });

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

  const createBooking = useMutation({
    mutationFn: async () => {
      if (mode === "block") {
        const { error } = await supabase.from("staff_schedule_overrides").insert({
          staff_id: form.staff_id,
          override_date: form.booking_date,
          start_time: form.booking_time,
          end_time: `${String(parseInt(form.booking_time) + 1).padStart(2, "0")}:00`,
          is_working: false,
          note: form.notes || "Blocked",
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookings").insert({
          customer_name: form.customer_name,
          dog_name: form.dog_name,
          customer_email: form.customer_email || null,
          customer_phone: form.customer_phone || null,
          breed_id: form.breed_id || null,
          service_id: form.service_id || null,
          staff_id: form.staff_id || null,
          booking_date: form.booking_date,
          booking_time: form.booking_time,
          total_price: form.total_price,
          deposit_paid: form.deposit_paid,
          notes: form.notes || null,
          status: "Confirmed",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "block" ? "Time blocked" : "Booking created");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "block" ? "Block Time" : "New Appointment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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

          {mode === "appointment" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Customer Name</Label>
                  <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Dog Name</Label>
                  <Input value={form.dog_name} onChange={(e) => setForm({ ...form, dog_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Total Price (£)</Label>
                  <Input type="number" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Deposit (£)</Label>
                  <Input type="number" value={form.deposit_paid} onChange={(e) => setForm({ ...form, deposit_paid: Number(e.target.value) })} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createBooking.mutate()} disabled={createBooking.isPending}>
            {mode === "block" ? "Block Time" : "Create Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
