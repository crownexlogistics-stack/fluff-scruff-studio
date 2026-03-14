import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { CalendarPlus, Send, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerSearchInput, type CustomerResult } from "@/components/booking-calendar/CustomerSearchInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  dogName?: string;
  breedId?: string;
  serviceId?: string;
  lastStaffId?: string;
}

export function NewAppointmentDialog({
  open, onOpenChange,
  customerName, customerEmail, customerPhone,
  dogName, breedId, serviceId, lastStaffId,
}: Props) {
  const queryClient = useQueryClient();
  const [showDepositPrompt, setShowDepositPrompt] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [sendingDeposit, setSendingDeposit] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [breedOpen, setBreedOpen] = useState(false);

  // If opened from customer profile, we already have customer info
  const hasPrefilledCustomer = Boolean(customerName && customerEmail);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerSelected, setCustomerSelected] = useState(hasPrefilledCustomer);
  const [selectedDogs, setSelectedDogs] = useState<{ name: string; breed_id: string | null }[]>([]);

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
      const prefilled = Boolean(customerName);
      setCustomerSelected(prefilled);
      setIsNewCustomer(false);
      setSelectedDogs([]);
      setForm({
        customer_name: customerName,
        dog_name: dogName || "",
        customer_email: customerEmail,
        customer_phone: customerPhone,
        breed_id: breedId || "",
        service_id: serviceId || "",
        staff_id: lastStaffId || "",
        booking_date: "",
        booking_time: "09:00",
        total_price: 0,
        deposit_paid: 0,
        notes: "",
      });
      setSelectedAddOns([]);
      setCreatedBookingId(null);
    }
  }, [open, customerName, customerEmail, customerPhone, dogName, breedId, serviceId, lastStaffId]);

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

  const { data: addOns } = useQuery({
    queryKey: ["add-ons-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_ons").select("id, name, price").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: addOnServices } = useQuery({
    queryKey: ["add-on-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_on_services").select("add_on_id, service_id");
      if (error) throw error;
      return data;
    },
  });

  // Filter add-ons by selected service
  const availableAddOns = (addOns || []).filter(ao => {
    const links = (addOnServices || []).filter(l => l.add_on_id === ao.id);
    return links.length === 0 || links.some(l => l.service_id === form.service_id);
  });

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  // Auto-fill price when service or breed changes
  useEffect(() => {
    if (!form.service_id) return;
    const svc = services?.find(s => s.id === form.service_id);
    let price = 0;

    if (svc?.fixed_price) {
      price = Number(svc.fixed_price);
    } else if (form.breed_id) {
      const sp = servicePrices?.find(p => p.service_id === form.service_id && p.breed_id === form.breed_id);
      if (sp) {
        price = Number(sp.price);
      } else {
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

    // Add add-on prices
    const addOnTotal = selectedAddOns.reduce((sum, id) => {
      const ao = addOns?.find(a => a.id === id);
      return sum + (ao ? Number(ao.price) : 0);
    }, 0);

    const totalPrice = price + addOnTotal;
    if (totalPrice > 0) {
      const deposit = Math.round(totalPrice * 0.6 * 100) / 100;
      setForm(prev => ({ ...prev, total_price: totalPrice, deposit_paid: deposit }));
    }
  }, [form.service_id, form.breed_id, services, breeds, servicePrices, selectedAddOns, addOns]);

  const handleCustomerSelect = (customer: CustomerResult) => {
    setCustomerSelected(true);
    setIsNewCustomer(false);
    setSelectedDogs(customer.dogs);
    setForm(prev => ({
      ...prev,
      customer_name: customer.customer_name,
      customer_email: customer.customer_email,
      customer_phone: customer.customer_phone,
      dog_name: customer.dogs[0]?.name || "",
      breed_id: customer.dogs[0]?.breed_id || "",
    }));
  };

  const handleAddNew = () => {
    setIsNewCustomer(true);
    setCustomerSelected(false);
    setSelectedDogs([]);
    setForm(prev => ({
      ...prev,
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      dog_name: "",
      breed_id: "",
    }));
  };

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error("Customer name is required");
      if (!form.dog_name.trim()) throw new Error("Dog name is required");
      if (!form.booking_date) throw new Error("Date is required");
      if (!form.service_id) throw new Error("Service is required");

      // Build notes with add-ons info
      const addOnNames = selectedAddOns.map(id => addOns?.find(a => a.id === id)?.name).filter(Boolean);
      const notesWithAddOns = [
        form.notes,
        addOnNames.length > 0 ? `Add-ons: ${addOnNames.join(", ")}` : "",
      ].filter(Boolean).join("\n");

      const staffName = staff?.find(s => s.id === form.staff_id)?.name || "Unknown";

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
        notes: notesWithAddOns || null,
        status: "Confirmed",
        booking_source: "staff",
        created_by_staff: staffName,
      } as any).select("id").single();
      if (error) throw error;

      logAudit({
        staffId: form.staff_id || undefined,
        action: "BOOKING_CREATED",
        details: `Booking for ${form.customer_name} (${form.dog_name}) on ${form.booking_date} at ${form.booking_time.slice(0, 5)} with ${staffName}`,
      });

      // Audit trail entry
      if (insertedBooking?.id) {
        supabase.from("booking_audit_log" as any).insert({
          booking_id: insertedBooking.id,
          event_type: "created_by_staff",
          performed_by: staffName,
          note: "Booking created manually by staff",
        } as any).then(() => {});
      }

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

  const handleSkipDeposit = () => onOpenChange(false);

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
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleSkipDeposit}>Skip</Button>
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
          {/* Customer Search - only show if not pre-filled from profile */}
          {!hasPrefilledCustomer && !isNewCustomer && (
            <CustomerSearchInput
              onSelect={handleCustomerSelect}
              onAddNew={handleAddNew}
              initialSelectedName={customerSelected ? form.customer_name : null}
            />
          )}

          {/* Pre-filled customer info display */}
          {hasPrefilledCustomer && customerSelected && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
              <p className="text-sm font-medium">{form.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {[form.customer_email, form.customer_phone].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}

          {/* New customer manual entry */}
          {isNewCustomer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">New Customer</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setIsNewCustomer(false); setCustomerSelected(false); }}>
                  ← Back to search
                </Button>
              </div>
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
            </div>
          )}

          {/* Dog selector for multi-dog customers */}
          {customerSelected && selectedDogs.length > 1 && (
            <div className="space-y-1">
              <Label>Dog</Label>
              <Select
                value={form.dog_name}
                onValueChange={(v) => {
                  const dog = selectedDogs.find(d => d.name === v);
                  setForm(prev => ({ ...prev, dog_name: v, breed_id: dog?.breed_id || "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select dog" /></SelectTrigger>
                <SelectContent>
                  {selectedDogs.map((d, i) => (
                    <SelectItem key={i} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Rest of form */}
          {(customerSelected || isNewCustomer) && (
            <>
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

              {/* Add-ons */}
              {form.service_id && availableAddOns.length > 0 && (
                <div className="space-y-2">
                  <Label>Add-ons</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {availableAddOns.map(ao => (
                      <label key={ao.id} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors">
                        <Checkbox
                          checked={selectedAddOns.includes(ao.id)}
                          onCheckedChange={() => toggleAddOn(ao.id)}
                        />
                        <span className="text-sm flex-1">{ao.name}</span>
                        <span className="text-sm text-muted-foreground">£{Number(ao.price).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => createBooking.mutate()}
            disabled={createBooking.isPending || (!customerSelected && !isNewCustomer)}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {createBooking.isPending ? "Creating..." : "Create Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
