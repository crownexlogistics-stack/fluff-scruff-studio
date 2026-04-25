import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { logGroomerActivity } from "@/lib/logGroomerActivity";
import { CustomerSearchInput, type CustomerResult } from "./CustomerSearchInput";

export interface BookAgainData {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  dog_name: string;
  breed_id?: string;
  service_id?: string;
  notes?: string | null;
}

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultHour?: number;
  defaultStaffId?: string;
  mode: "appointment" | "block";
  bookAgainData?: BookAgainData | null;
}

export function NewBookingDialog({ open, onOpenChange, defaultDate, defaultHour, defaultStaffId, mode, bookAgainData }: NewBookingDialogProps) {
  const queryClient = useQueryClient();

  const dateStr = defaultDate ? format(defaultDate, "yyyy-MM-dd") : "";
  const timeStr = defaultHour != null ? `${String(defaultHour).padStart(2, "0")}:00` : "09:00";
  const defaultEndHour = defaultHour != null ? defaultHour + 1 : 10;
  const endTimeStr = `${String(defaultEndHour).padStart(2, "0")}:00`;

  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerSelected, setCustomerSelected] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");
  const [selectedDogs, setSelectedDogs] = useState<{ name: string; breed_id: string | null }[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const [form, setForm] = useState({
    customer_name: "",
    dog_name: "",
    customer_email: "",
    customer_phone: "",
    breed_id: "",
    service_id: "",
    staff_id: defaultStaffId || "",
    booking_date: dateStr,
    booking_time: timeStr,
    end_time: endTimeStr,
    total_price: 0,
    deposit_paid: 0,
    notes: "",
  });

  // Only reset form when the dialog opens — NOT on prop reference changes while open
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setNewCustomerError("");
      setSelectedAddOns([]);

      if (bookAgainData) {
        // Pre-fill from existing booking
        setIsNewCustomer(false);
        setCustomerSelected(true);
        setSelectedDogs([{ name: bookAgainData.dog_name, breed_id: bookAgainData.breed_id || null }]);
        setForm({
          customer_name: bookAgainData.customer_name,
          dog_name: bookAgainData.dog_name,
          customer_email: bookAgainData.customer_email || "",
          customer_phone: bookAgainData.customer_phone || "",
          breed_id: bookAgainData.breed_id || "",
          service_id: bookAgainData.service_id || "",
          staff_id: "",
          booking_date: "",
          booking_time: "09:00",
          end_time: "10:00",
          total_price: 0,
          deposit_paid: 0,
          notes: "",
        });
      } else {
        setIsNewCustomer(false);
        setCustomerSelected(false);
        setSelectedDogs([]);
        setForm({
          customer_name: "",
          dog_name: "",
          customer_email: "",
          customer_phone: "",
          breed_id: "",
          service_id: "",
          staff_id: defaultStaffId || "",
          booking_date: dateStr,
          booking_time: timeStr,
          end_time: endTimeStr,
          total_price: 0,
          deposit_paid: 0,
          notes: "",
        });
      }
    }
    prevOpenRef.current = open;
  }, [open]);

  const { data: staff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Staff <-> Service assignments. Empty rows for a staff_id means "can do all services".
  const { data: staffServices } = useQuery({
    queryKey: ["staff-services-newbooking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_services")
        .select("staff_id, service_id");
      if (error) throw error;
      return data as { staff_id: string; service_id: string }[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services-list-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, fixed_price").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds-list-full"],
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
    // If no service links, available for all; otherwise check match
    return links.length === 0 || links.some(l => l.service_id === form.service_id);
  });

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
      setForm(prev => ({ ...prev, total_price: totalPrice, deposit_paid: 0 }));
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
    setNewCustomerError("");
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

  const handleClearCustomer = () => {
    setCustomerSelected(false);
    setIsNewCustomer(false);
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

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const createBooking = useMutation({
    mutationFn: async () => {
      if (mode === "block") {
        if (!form.notes.trim()) throw new Error("A reason is required when blocking time.");

        const { error } = await supabase.from("staff_schedule_overrides").insert({
          staff_id: form.staff_id,
          override_date: form.booking_date,
          start_time: form.booking_time,
          end_time: form.end_time,
          is_working: false,
          note: form.notes.trim(),
        });
        if (error) throw error;

        const staffName = staff?.find(s => s.id === form.staff_id)?.name || "Unknown";
        const formattedDate = format(new Date(form.booking_date), "dd MMM yyyy");

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const hrNote = `⛔ TIME BLOCKED — ${formattedDate} from ${form.booking_time.slice(0, 5)} to ${form.end_time.slice(0, 5)} — Reason: ${form.notes.trim()}`;
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
          action: "TIME_BLOCKED",
          details: `Blocked ${formattedDate} ${form.booking_time.slice(0, 5)}-${form.end_time.slice(0, 5)} for ${staffName}. Reason: ${form.notes.trim()}`,
        });
      } else {
        // Validate new customer fields
        if (isNewCustomer) {
          if (!form.customer_name.trim() || (!form.customer_email.trim() && !form.customer_phone.trim())) {
            throw new Error("Please enter a name and email or phone number");
          }

          // Create or link migrated_customers record
          const emailLower = form.customer_email.trim().toLowerCase();
          const phoneTrimmed = form.customer_phone.trim();

          // Check if customer already exists
          let existingCustomer = null;
          if (emailLower) {
            const { data } = await supabase.from("migrated_customers")
              .select("id")
              .ilike("email", emailLower)
              .limit(1);
            if (data && data.length > 0) existingCustomer = data[0];
          }
          if (!existingCustomer && phoneTrimmed) {
            const { data } = await supabase.from("migrated_customers")
              .select("id")
              .eq("phone", phoneTrimmed)
              .limit(1);
            if (data && data.length > 0) existingCustomer = data[0];
          }

          if (!existingCustomer) {
            await supabase.from("migrated_customers").insert({
              full_name: form.customer_name.trim(),
              email: emailLower || null,
              phone: phoneTrimmed || null,
              status: "pending",
            });
          }
        }

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
          deposit_paid: 0,
          notes: notesWithAddOns || null,
          status: "Pending",
          booking_source: "staff",
          created_by_staff: staffName,
        } as any).select("id").single();
        if (error) throw error;

        logAudit({
          staffId: form.staff_id || undefined,
          action: "BOOKING_CREATED",
          details: `Booking for ${form.customer_name} (${form.dog_name}) on ${form.booking_date} at ${form.booking_time.slice(0, 5)} with ${staffName}`,
        });

        if (insertedBooking?.id) {
          supabase.from("booking_audit_log" as any).insert({
            booking_id: insertedBooking.id,
            event_type: "created_by_staff",
            performed_by: staffName,
            note: "Booking created manually by staff",
          } as any).then(() => {});

          // Activity log for groomer
          if (form.staff_id) {
            const serviceName = services?.find(s => s.id === form.service_id)?.name || "";
            logGroomerActivity({
              staffId: form.staff_id,
              actionType: "booking_created",
              actionSummary: `Booked ${form.customer_name} (${form.dog_name}) for ${serviceName || "appointment"} on ${form.booking_date} at ${form.booking_time.slice(0, 5)}`,
              bookingId: insertedBooking.id,
              customerName: form.customer_name,
              dogName: form.dog_name,
              bookingDate: form.booking_date,
              bookingTime: form.booking_time,
              serviceName,
            });
          }
        }

        if (form.customer_email && insertedBooking?.id) {
          supabase.functions.invoke("send-booking-email", {
            body: { booking_id: insertedBooking.id, email_type: "confirmation" },
          }).catch(() => {});
        }
      }
    },
    onSuccess: () => {
      toast.success(mode === "block" ? "Time blocked" : "Booking created");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notes"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["customer-search-list"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e.message === "Please enter a name and email or phone number") {
        setNewCustomerError(e.message);
      } else {
        toast.error(e.message);
      }
    },
  });

  const blockDisabled = mode === "block" && !form.notes.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "block" ? "Block Time" : bookAgainData ? `Book Again — ${bookAgainData.customer_name}` : "New Appointment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "block" ? (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-medium">
                  {defaultDate ? format(defaultDate, "EEEE, dd MMM yyyy") : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Starting at {form.booking_time.slice(0, 5)}
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setForm({ ...form, booking_time: "08:00", end_time: "23:59" })}
              >
                Block All Day
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
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

              <div className="space-y-1">
                <Label>Reason / Notes <span className="text-destructive">*</span></Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Why is this time being blocked? (required)"
                  rows={3}
                />
                {blockDisabled && form.notes === "" && (
                  <p className="text-xs text-destructive">A reason must be provided to block time.</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                This block will be logged to the audit trail for record keeping.
              </p>
            </>
          ) : (
            <>
              {/* Book Again: locked customer display */}
              {bookAgainData && customerSelected && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
                  <p className="text-sm font-medium">{form.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[form.customer_email, form.customer_phone].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">🐕 {form.dog_name}</p>
                </div>
              )}

              {/* Customer Search / Selected display */}
              {!bookAgainData && !isNewCustomer && (
                <>
                  <CustomerSearchInput
                    onSelect={handleCustomerSelect}
                    onAddNew={handleAddNew}
                    initialSelectedName={customerSelected ? form.customer_name : null}
                  />
                  {!customerSelected && (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
                      setIsNewCustomer(true);
                      setCustomerSelected(false);
                      setNewCustomerError("");
                      setSelectedDogs([]);
                      setForm(prev => ({ ...prev, customer_name: "", customer_email: "", customer_phone: "", dog_name: "", breed_id: "" }));
                    }}>
                      + Add New Customer
                    </Button>
                  )}
                </>
              )}

              {/* New customer manual entry */}
              {isNewCustomer && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">New Customer</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setIsNewCustomer(false); setCustomerSelected(false); setNewCustomerError(""); }}>
                      ← Back to search
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Customer Name</Label>
                      <Input value={form.customer_name} onChange={(e) => { setForm({ ...form, customer_name: e.target.value }); setNewCustomerError(""); }} />
                    </div>
                    <div className="space-y-1">
                      <Label>Dog Name</Label>
                      <Input value={form.dog_name} onChange={(e) => setForm({ ...form, dog_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={form.customer_email} onChange={(e) => { setForm({ ...form, customer_email: e.target.value }); setNewCustomerError(""); }} />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={form.customer_phone} onChange={(e) => { setForm({ ...form, customer_phone: e.target.value }); setNewCustomerError(""); }} />
                    </div>
                  </div>
                  {newCustomerError && (
                    <p className="text-sm text-destructive">{newCustomerError}</p>
                  )}
                </div>
              )}

              {/* Dog selector when customer is selected and has multiple dogs */}
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

              {/* Rest of form - always visible once customer is chosen */}
              {(customerSelected || isNewCustomer) && (
                <>
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
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              console.log("[CreateBooking] clicked", { isNewCustomer, customerSelected, mode, form, isPending: createBooking.isPending, blockDisabled });
              createBooking.mutate();
            }}
            disabled={createBooking.isPending || blockDisabled || (mode === "appointment" && !customerSelected && !isNewCustomer)}
          >
            {mode === "block" ? "Block Time" : "Create Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
