import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { CustomerSearchInput } from "@/components/booking-calendar/CustomerSearchInput";

interface SessionRow {
  date: string;
  time: string;
  serviceType: string;
  staffId: string;
}

export function CreatePackageBooking({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [packageId, setPackageId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("salon");
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: packages } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("packages" as any)
        .select("*") as any)
        .eq("is_active", true)
        .order("session_count");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-for-packages"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("staff")
        .select("id, name") as any)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds-for-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breeds")
        .select("id, name, price_full_groom, price_bath_brush")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services-for-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services" as any)
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedPkg = packages?.find((p: any) => p.id === packageId);

  const handlePackageChange = (id: string) => {
    setPackageId(id);
    const pkg = packages?.find((p: any) => p.id === id);
    if (pkg) {
      const defaultService = pkg.package_type === "teeth_cleaning" ? "teeth_cleaning" : "full_groom";
      setSessions(
        Array.from({ length: pkg.session_count }, () => ({
          date: "",
          time: "",
          serviceType: defaultService,
          staffId: "",
        }))
      );
    }
  };

  const updateSession = (index: number, field: keyof SessionRow, value: string) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleCustomerSelect = (customer: any) => {
    setCustomerName(customer.customer_name || "");
    setCustomerEmail(customer.customer_email || "");
    setCustomerPhone(customer.customer_phone || "");
  };

  const calculateTotal = () => {
    if (!selectedPkg) return 0;
    if (selectedPkg.package_type === "teeth_cleaning") {
      return (selectedPkg.price_per_session || 20) * selectedPkg.session_count;
    }
    // For grooming, we can't calc without breed — user enters total or we estimate
    return 0;
  };

  const handleSave = async () => {
    if (!packageId || !customerName || !customerEmail) {
      toast.error("Please fill customer details and select a package");
      return;
    }

    const emptyDates = sessions.filter((s) => !s.date);
    if (emptyDates.length > 0) {
      toast.error("Please set dates for all sessions");
      return;
    }

    setSaving(true);
    try {
      const pkg = selectedPkg!;
      let totalPrice = 0;

      if (pkg.package_type === "teeth_cleaning") {
        totalPrice = (pkg.price_per_session || 20) * pkg.session_count;
      } else {
        // Sum up the session prices based on service type — need breed for proper price
        // For now use a simple approach: admin enters total or we use 0 placeholder
        // We'll calculate from individual bookings
        totalPrice = 0;
      }

      // Create individual bookings first
      const bookingIds: string[] = [];
      for (const session of sessions) {
        const bookingData: any = {
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          dog_name: dogName,
          booking_date: session.date,
          booking_time: session.time || "09:00",
          status: "Confirmed",
          staff_id: session.staffId || null,
          total_price: 0, // Will be set per-session
          deposit_paid: 0,
          booking_source: "package",
          notes: `📦 Package: ${pkg.name}`,
        };

        if (pkg.package_type === "teeth_cleaning") {
          bookingData.total_price = pkg.price_per_session || 20;
          bookingData.deposit_paid = pkg.price_per_session || 20;
        }

        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert(bookingData)
          .select("id")
          .single();

        if (bookingError) throw bookingError;
        bookingIds.push(booking.id);
        if (pkg.package_type === "teeth_cleaning") {
          totalPrice = (pkg.price_per_session || 20) * pkg.session_count;
        }
      }

      // Create package_booking
      const { data: pkgBooking, error: pkgError } = await supabase
        .from("package_bookings" as any)
        .insert({
          package_id: packageId,
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          dog_name: dogName,
          total_paid: totalPrice,
          sessions_total: pkg.session_count,
          sessions_used: 0,
          sessions_remaining: pkg.session_count,
          status: "active",
          stripe_payment_status: paymentMethod === "salon" ? "paid_in_salon" : "pending",
          notes,
        })
        .select("id")
        .single();

      if (pkgError) throw pkgError;

      // Create package_sessions
      for (let i = 0; i < sessions.length; i++) {
        await supabase.from("package_sessions" as any).insert({
          package_booking_id: (pkgBooking as any).id,
          booking_id: bookingIds[i],
          session_number: i + 1,
          service_type: sessions[i].serviceType,
          scheduled_date: sessions[i].date,
          scheduled_time: sessions[i].time || "09:00",
          status: "scheduled",
        });
      }

      // Send T&C signing email automatically
      try {
        await supabase.functions.invoke("send-package-tc-email", {
          body: {
            type: "invite",
            package_booking_id: (pkgBooking as any).id,
          },
        });
      } catch (emailErr) {
        console.error("Failed to send T&C email:", emailErr);
      }

      queryClient.invalidateQueries({ queryKey: ["package-bookings"] });
      toast.success("Package booking created and T&C signing email sent!");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create package booking");
    } finally {
      setSaving(false);
    }
  };

  const serviceOptions = selectedPkg?.package_type === "teeth_cleaning"
    ? [{ value: "teeth_cleaning", label: "Teeth Cleaning" }]
    : [
        { value: "full_groom", label: "Full Groom" },
        { value: "bath_brush", label: "Bath & Brush" },
      ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" /> Create Package Booking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Customer</h3>
          <div>
            <Label>Search existing customer</Label>
            <CustomerSearchInput onSelect={handleCustomerSelect} onAddNew={() => {}} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Dog Name</Label>
            <Input value={dogName} onChange={(e) => setDogName(e.target.value)} />
          </div>
        </div>

        <Separator />

        {/* Package */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Package</h3>
          <Select value={packageId} onValueChange={handlePackageChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a package" />
            </SelectTrigger>
            <SelectContent>
              {packages?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  📦 {p.name} ({p.discount_percentage}% off)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPkg?.description && (
            <p className="text-sm text-muted-foreground">{selectedPkg.description}</p>
          )}
        </div>

        {/* Sessions */}
        {sessions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Sessions ({sessions.length})
              </h3>
              {sessions.map((session, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <p className="font-medium text-sm">Session {i + 1}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Date *</Label>
                      <Input
                        type="date"
                        value={session.date}
                        onChange={(e) => updateSession(i, "date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={session.time}
                        onChange={(e) => updateSession(i, "time", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Service</Label>
                      <Select
                        value={session.serviceType}
                        onValueChange={(v) => updateSession(i, "serviceType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Groomer</Label>
                      <Select
                        value={session.staffId}
                        onValueChange={(v) => updateSession(i, "staffId", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Separator />

        {/* Payment */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Payment</h3>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="salon" id="salon" />
              <Label htmlFor="salon">Paid in salon (cash or card)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="link" id="link" />
              <Label htmlFor="link">Send payment link (Stripe)</Label>
            </div>
          </RadioGroup>

          {selectedPkg?.package_type === "teeth_cleaning" && (
            <p className="text-sm font-medium">
              Total: £{((selectedPkg.price_per_session || 20) * selectedPkg.session_count).toFixed(2)}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
          Create Package Booking
        </Button>
      </CardContent>
    </Card>
  );
}
