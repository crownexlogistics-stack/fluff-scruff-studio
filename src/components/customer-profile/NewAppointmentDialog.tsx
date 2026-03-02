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
import { CalendarPlus, Send, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  dogName?: string;
  breedId?: string;
  lastStaffId?: string;
}

export function NewAppointmentDialog({
  open, onOpenChange,
  customerName, customerEmail, customerPhone,
  dogName, breedId, lastStaffId,
}: Props) {
  const queryClient = useQueryClient();
  const [showDepositPrompt, setShowDepositPrompt] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [sendingDeposit, setSendingDeposit] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    dog_name: "",
    customer_email: "",
    customer_phone: "",
    breed_id: "",
    service_id: "",
    staff_id: "",
    booking_date: "",
    booking_time: "09:00",
    total_price: 0,
    deposit_paid: 0,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        customer_name: customerName,
        dog_name: dogName || "",
        customer_email: customerEmail,
        customer_phone: customerPhone,
        breed_id: breedId || "",
        service_id: "",
        staff_id: lastStaffId || "",
        booking_date: "",
        booking_time: "09:00",
        total_price: 0,
        deposit_paid: 0,
        notes: "",
      });
      setShowDepositPrompt(false);
      setCreatedBookingId(null);
    }
  }, [open, customerName, customerEmail, customerPhone, dogName, breedId, lastStaffId]);

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
      const { data, error } = await supabase.from("services").select("id, name, fixed_price").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("id, name, price_bath_brush, price_full_groom").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: servicePrices } = useQuery({
    queryKey: ["service-prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_prices").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Auto-fill price when service or breed changes
  useEffect(() => {
    if (!form.service_id) return;
    const svc = services?.find(s => s.id === form.service_id);

    let price = 0;

    if (svc?.fixed_price) {
      // Fixed-price service (e.g. Nail Trim, Teeth Cleaning)
      price = Number(svc.fixed_price);
    } else if (form.breed_id) {
      // Check service_prices table first
      const sp = servicePrices?.find(p => p.service_id === form.service_id && p.breed_id === form.breed_id);
      if (sp) {
        price = Number(sp.price);
      } else {
        // Fallback to breed pricing columns
        const breed = breeds?.find(b => b.id === form.breed_id);
        if (breed) {
          const name = svc?.name?.toLowerCase() || "";
          if (name.includes("bath") && name.includes("brush")) {
            price = Number(breed.price_bath_brush);
          } else if (name.includes("full") || name.includes("groom")) {
            price = Number(breed.price_full_groom);
          }
        }
      }
    }

    if (price > 0) {
      const deposit = Math.round(price * 0.6 * 100) / 100;
      setForm(prev => ({ ...prev, total_price: price, deposit_paid: deposit }));
    }
  }, [form.service_id, form.breed_id, services, breeds, servicePrices]);

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error("Customer name is required");
      if (!form.dog_name.trim()) throw new Error("Dog name is required");
      if (!form.booking_date) throw new Error("Date is required");
      if (!form.service_id) throw new Error("Service is required");

      const { data: insertedBooking, error } = await supabase.from("bookings").insert({
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
      }).select("id").single();
      if (error) throw error;

      const staffName = staff?.find(s => s.id === form.staff_id)?.name || "Unknown";
      logAudit({
        staffId: form.staff_id || undefined,
        action: "BOOKING_CREATED",
        details: `Booking for ${form.customer_name} (${form.dog_name}) on ${form.booking_date} at ${form.booking_time.slice(0, 5)} with ${staffName}`,
      });

      // Send confirmation email
      if (form.customer_email && insertedBooking?.id) {
        supabase.functions.invoke("send-booking-email", {
          body: { booking_id: insertedBooking.id, email_type: "confirmation" },
        }).catch(() => {});
      }

      return insertedBooking.id;
    },
    onSuccess: (bookingId) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["customer-profile-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
      toast.success("Appointment created");
      setCreatedBookingId(bookingId);
      setShowDepositPrompt(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSendDeposit = async () => {
    if (!createdBookingId) return;
    setSendingDeposit(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-deposit-request", {
        body: { booking_id: createdBookingId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Deposit request sent to customer");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Failed to send deposit: ${e.message}`);
    } finally {
      setSendingDeposit(false);
    }
  };

  const handleSkipDeposit = () => {
    onOpenChange(false);
  };

  // Deposit prompt view
  if (showDepositPrompt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              Appointment Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              The appointment for <span className="font-medium text-foreground">{form.dog_name}</span> has been confirmed.
            </p>
            {form.customer_email ? (
              <p className="text-sm">
                Would you like to send a deposit request to <span className="font-medium">{form.customer_email}</span>?
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No email on file — deposit request cannot be sent.
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleSkipDeposit}>
              Skip
            </Button>
            {form.customer_email && (
              <Button className="w-full sm:w-auto" onClick={handleSendDeposit} disabled={sendingDeposit}>
                <Send className="h-4 w-4 mr-2" />
                {sendingDeposit ? "Sending..." : "Send Deposit Request"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Booking form view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            New Appointment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Dog Name</Label>
              <Input value={form.dog_name} onChange={(e) => setForm({ ...form, dog_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Service <span className="text-destructive">*</span></Label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date <span className="text-destructive">*</span></Label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Label>Notes for groomer</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any special instructions..." />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => createBooking.mutate()}
            disabled={createBooking.isPending}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {createBooking.isPending ? "Creating..." : "Create Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
