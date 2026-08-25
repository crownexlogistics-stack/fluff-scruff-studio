import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendlyError";
import { logAudit } from "@/lib/auditLog";
import { logGroomerActivity } from "@/lib/logGroomerActivity";
import { Mail, Sparkles } from "lucide-react";
import type { BookingData } from "./BookingEvent";
import { CouponApplySection } from "./CouponApplySection";
import { CouponRefundFlow } from "./CouponRefundFlow";

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
    duration_minutes: 60,
    service_id: "",
    breed_id: "",
    staff_id: "",
    total_price: 0,
    deposit_paid: 0,
    notes: "",
  });

  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [initialAddonIds, setInitialAddonIds] = useState<string[]>([]);
  const [couponApplied, setCouponApplied] = useState(false);
  const [refundFlowOpen, setRefundFlowOpen] = useState(false);
  const [pendingCouponData, setPendingCouponData] = useState<{ newTotal: number; code: string; label: string } | null>(null);

  // Fetch existing booking add-ons when dialog opens
  const { data: existingAddons } = useQuery({
    queryKey: ["booking-addons", booking?.id],
    queryFn: async () => {
      if (!booking) return [];
      const { data, error } = await supabase
        .from("booking_addons" as any)
        .select("addon_id")
        .eq("booking_id", booking.id);
      if (error) throw error;
      return (data as any[])?.map((r: any) => r.addon_id as string) || [];
    },
    enabled: open && !!booking,
  });

  // Fetch existing coupon usage for this booking (supports both regular and migrated)
  const { data: existingCoupon } = useQuery({
    queryKey: ["booking-coupon-edit", booking?.id],
    queryFn: async () => {
      if (!booking) return null;
      const column = booking.is_migrated ? "migrated_booking_id" : "booking_id";
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("*, coupons(code, discount_type, discount_value)")
        .eq(column, booking.id)
        .maybeSingle();
      if (error) throw error;
      return data?.coupons ? { code: data.coupons.code, discount_type: data.coupons.discount_type, discount_value: data.coupons.discount_value } : null;
    },
    enabled: open && !!booking,
  });

  useEffect(() => {
    if (open && booking) {
      setForm({
        booking_date: booking.booking_date,
        booking_time: booking.booking_time.slice(0, 5),
        duration_minutes: (booking as any).duration_minutes ?? 60,
        service_id: (booking as any).service_id || "",
        breed_id: (booking as any).breed_id || "",
        staff_id: booking.staff_id || "",
        total_price: Number(booking.total_price),
        deposit_paid: Number(booking.deposit_paid),
        notes: booking.notes || "",
      });
    }
  }, [open, booking]);

  useEffect(() => {
    if (existingAddons) {
      setSelectedAddonIds(existingAddons);
      setInitialAddonIds(existingAddons);
    }
  }, [existingAddons]);

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

  const { data: addOns } = useQuery({
    queryKey: ["add-ons-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("add_ons").select("id, name, price").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Calculate add-on price difference for total
  const addOnTotal = addOns?.filter(a => selectedAddonIds.includes(a.id)).reduce((sum, a) => sum + Number(a.price), 0) || 0;
  const prevAddOnTotal = addOns?.filter(a => initialAddonIds.includes(a.id)).reduce((sum, a) => sum + Number(a.price), 0) || 0;

  const toggleAddon = (addonId: string) => {
    const addon = addOns?.find(a => a.id === addonId);
    if (!addon) return;
    const price = Number(addon.price);

    if (selectedAddonIds.includes(addonId)) {
      setSelectedAddonIds(prev => prev.filter(id => id !== addonId));
      setForm(prev => ({ ...prev, total_price: prev.total_price - price }));
    } else {
      setSelectedAddonIds(prev => [...prev, addonId]);
      setForm(prev => ({ ...prev, total_price: prev.total_price + price }));
    }
  };

  const updateBooking = useMutation({
    mutationFn: async () => {
      if (!booking) return;

      const dateChanged = form.booking_date !== booking.booking_date;
      const timeChanged = form.booking_time !== booking.booking_time.slice(0, 5);

      if (booking.is_migrated) {
        // Update migrated_bookings table
        const { error } = await supabase.from("migrated_bookings").update({
          booking_date: form.booking_date,
          booking_time: form.booking_time,
          duration_minutes: form.duration_minutes,
          total_price: form.total_price,
          deposit_paid: form.deposit_paid,
          notes: form.notes || null,
          staff_name: staff?.find(s => s.id === form.staff_id)?.name || null,
        }).eq("id", booking.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookings").update({
          booking_date: form.booking_date,
          booking_time: form.booking_time,
          duration_minutes: form.duration_minutes,
          service_id: form.service_id || null,
          breed_id: form.breed_id || null,
          staff_id: form.staff_id || null,
          total_price: form.total_price,
          deposit_paid: form.deposit_paid,
          notes: form.notes || null,
        } as any).eq("id", booking.id);
        if (error) throw error;

        // Sync booking_addons: delete removed, insert added
        const toRemove = initialAddonIds.filter(id => !selectedAddonIds.includes(id));
        const toAdd = selectedAddonIds.filter(id => !initialAddonIds.includes(id));

        if (toRemove.length > 0) {
          await supabase
            .from("booking_addons" as any)
            .delete()
            .eq("booking_id", booking.id)
            .in("addon_id", toRemove);
        }
        if (toAdd.length > 0) {
          await supabase
            .from("booking_addons" as any)
            .insert(toAdd.map(addon_id => ({
              booking_id: booking.id,
              addon_id,
              added_by_staff: true,
            })));
        }

        if (form.staff_id) {
          supabase.functions.invoke("notify-groomer", {
            body: { booking_id: booking.id, notification_type: "booking_edited" },
          }).catch(() => {});
        }
      }

      const performedBy = staff?.find(s => s.id === form.staff_id)?.name || "Staff";

      // Audit trail for reschedule
      if ((dateChanged || timeChanged) && !booking.is_migrated) {
        supabase.from("booking_audit_log" as any).insert({
          booking_id: booking.id,
          event_type: "rescheduled",
          performed_by: performedBy,
          old_date: booking.booking_date,
          old_time: booking.booking_time.slice(0, 5),
          new_date: form.booking_date,
          new_time: form.booking_time,
          note: `Rescheduled from ${booking.booking_date} ${booking.booking_time.slice(0, 5)} to ${form.booking_date} ${form.booking_time}`,
        } as any).then(() => {});

        // Activity log for groomer
        if (form.staff_id) {
          logGroomerActivity({
            staffId: form.staff_id,
            actionType: "reschedule",
            actionSummary: `Rescheduled ${booking.customer_name} from ${booking.booking_date} ${booking.booking_time.slice(0, 5)} to ${form.booking_date} ${form.booking_time}`,
            bookingId: booking.id,
            customerName: booking.customer_name,
            dogName: booking.dog_name,
            bookingDate: form.booking_date,
            bookingTime: form.booking_time,
          });
        }
      }

      logAudit({
        staffId: form.staff_id || undefined,
        action: "BOOKING_EDITED",
        details: `Edited ${booking.is_migrated ? "migrated " : ""}booking for ${booking.customer_name} on ${form.booking_date} at ${form.booking_time}`,
      });
    },
    onSuccess: () => {
      toast.success("Appointment updated");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["groomer-migrated-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["booking-addons"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(friendlyError(e)),
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
    <>
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
            <Label>Appointment Duration</Label>
            <Select value={String(form.duration_minutes)} onValueChange={(v) => setForm({ ...form, duration_minutes: Number(v) })}>
              <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1 hour 30 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="150">2 hours 30 minutes</SelectItem>
                <SelectItem value="180">3 hours</SelectItem>
                <SelectItem value="210">3 hours 30 minutes</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Add-ons Sold in Salon */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Add-ons Sold in Salon
            </Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {addOns && addOns.length > 0 ? addOns.map(addon => (
                <label key={addon.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors">
                  <Checkbox
                    checked={selectedAddonIds.includes(addon.id)}
                    onCheckedChange={() => toggleAddon(addon.id)}
                  />
                  <span className="flex-1 text-sm">{addon.name}</span>
                  <span className="text-sm font-medium text-muted-foreground">£{Number(addon.price).toFixed(2)}</span>
                </label>
              )) : (
                <p className="text-sm text-muted-foreground">No add-ons available</p>
              )}
            </div>
            {selectedAddonIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Add-ons total: £{addOnTotal.toFixed(2)}
              </p>
            )}
          </div>

          {/* Coupon / Discount Section — staff only, works for both regular and migrated bookings */}
          <CouponApplySection
            bookingId={booking.id}
            isMigrated={!!booking.is_migrated}
            currentTotal={form.total_price}
            depositPaid={form.deposit_paid}
            existingCoupon={couponApplied ? undefined : (existingCoupon as any)}
            staffName={staff?.find(s => s.id === form.staff_id)?.name || "Staff"}
            customerEmail={booking.customer_email}
            onCouponApplied={(newTotal, code, label) => {
              const deposit = form.deposit_paid;
              // If customer already paid more than new total, need refund (only for non-migrated with Stripe)
              if (!booking.is_migrated && deposit > newTotal && deposit > 0 && (booking as any).stripe_payment_id) {
                setPendingCouponData({ newTotal, code, label });
                setRefundFlowOpen(true);
              }
              setForm(prev => ({ ...prev, total_price: newTotal }));
              setCouponApplied(true);
              queryClient.invalidateQueries({ queryKey: ["booking-coupon-edit", booking.id] });
              queryClient.invalidateQueries({ queryKey: ["booking-coupon", booking.id] });
            }}
          />

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

    {/* Coupon refund flow */}
    {pendingCouponData && (
      <CouponRefundFlow
        open={refundFlowOpen}
        onOpenChange={setRefundFlowOpen}
        bookingId={booking.id}
        customerName={booking.customer_name}
        amountAlreadyPaid={form.deposit_paid}
        newTotalAfterDiscount={pendingCouponData.newTotal}
        staffName={staff?.find(s => s.id === form.staff_id)?.name || "Staff"}
        couponCode={pendingCouponData.code}
        onComplete={() => {
          setPendingCouponData(null);
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
        }}
      />
    )}
  </>
  );
}
