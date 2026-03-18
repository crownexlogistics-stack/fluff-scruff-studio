import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollHintWrapper } from "@/components/ui/scroll-hint-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CheckCircle2, RotateCcw, Send, Sparkles, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { useQuery } from "@tanstack/react-query";
import type { BookingData } from "./BookingEvent";

interface ViewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
  userRole?: string | null;
  onRefundComplete?: () => void;
}

function Row({ label, value, bold, highlight }: { label: string; value: string | null | undefined; bold?: boolean; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-1.5 border-b last:border-b-0">
      <span className={`text-sm ${highlight ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm text-right max-w-[60%] ${bold ? "font-bold" : "font-medium"} ${highlight ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

export function ViewOrderDialog({ open, onOpenChange, booking, userRole, onRefundComplete }: ViewOrderDialogProps) {
  const [processingRefund, setProcessingRefund] = useState(false);
  const [requestingDeposit, setRequestingDeposit] = useState(false);

  // Fetch coupon usage for this booking
  const { data: couponUsage } = useQuery({
    queryKey: ["booking-coupon", booking?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("*, coupons(code, discount_type, discount_value)")
        .eq("booking_id", booking!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!booking,
  });

  // Fetch add-ons for this booking
  const { data: bookingAddons } = useQuery({
    queryKey: ["booking-addons-dialog", booking?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_addons")
        .select("*, add_ons(name, price)")
        .eq("booking_id", booking!.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!booking,
  });

  // Fallback breed pricing for legacy bookings
  const { data: breedPricing } = useQuery({
    queryKey: ["booking-breed-pricing-dialog", booking?.breed_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breeds")
        .select("price_full_groom, price_bath_brush")
        .eq("id", booking!.breed_id as string)
        .maybeSingle();
      if (error) return null;
      return data as { price_full_groom: number; price_bath_brush: number } | null;
    },
    enabled: !!booking && !!booking.breed_id,
  });

  // Known add-ons for reverse-matching legacy bookings
  const { data: allAddOns } = useQuery({
    queryKey: ["all-add-ons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("add_ons")
        .select("id, name, price")
        .eq("is_active", true)
        .order("price", { ascending: false });
      if (error) return [];
      return (data || []) as { id: string; name: string; price: number }[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!booking,
  });

  if (!booking) return null;

  const total = Number(booking.total_price);
  const deposit = Number(booking.deposit_paid);
  const balanceDue = Math.max(0, total - deposit);
  const isFullyPaid = deposit >= total && total > 0;
  const isDepositPaid = deposit > 0 && deposit < total;
  const isDirector = userRole === "director";

  // Calculate itemized breakdown
  const addonsTotal = (bookingAddons || []).reduce((sum: number, ba: any) => sum + Number(ba.add_ons?.price || 0), 0);
  const hasCoupon = !!couponUsage?.coupons;
  const discountType = couponUsage?.coupons?.discount_type;
  const discountVal = Number(couponUsage?.coupons?.discount_value || 0);

  // Work backwards: if coupon applied, calculate pre-discount subtotal
  const subtotalBeforeDiscount = hasCoupon
    ? (discountType === "percentage" ? total / (1 - discountVal / 100) : total + discountVal)
    : total;

  // Infer legacy add-on amount from breed pricing
  const normalizedServiceName = (booking.service_name || "").toLowerCase();
  const inferredBaseServicePrice = !breedPricing
    ? null
    : normalizedServiceName.includes("full groom")
      ? Number(breedPricing.price_full_groom || 0)
      : normalizedServiceName.includes("bath")
        ? Number(breedPricing.price_bath_brush || 0)
        : null;

  const inferredPackageAmount =
    addonsTotal === 0 &&
    inferredBaseServicePrice !== null &&
    inferredBaseServicePrice > 0 &&
    subtotalBeforeDiscount > inferredBaseServicePrice + 0.01
      ? subtotalBeforeDiscount - inferredBaseServicePrice
      : 0;

  // Try to match inferred amount to known add-ons using pence math (avoids float drift)
  const toCents = (value: number) => Math.round(Number(value || 0) * 100);
  const inferredAddOns: { name: string; price: number }[] = [];
  if (inferredPackageAmount > 0 && allAddOns && allAddOns.length > 0) {
    const inferredCents = toCents(inferredPackageAmount);
    const sortedAddOns = [...allAddOns]
      .map((a) => ({ ...a, cents: toCents(Number(a.price)) }))
      .filter((a) => a.cents > 0)
      .sort((a, b) => b.cents - a.cents);

    const nearestSingle = [...sortedAddOns].sort(
      (a, b) => Math.abs(a.cents - inferredCents) - Math.abs(b.cents - inferredCents)
    )[0];

    // Accept near-single match within 50p tolerance for legacy rounding differences
    if (nearestSingle && Math.abs(nearestSingle.cents - inferredCents) <= 50) {
      inferredAddOns.push({ name: nearestSingle.name, price: nearestSingle.cents / 100 });
    } else {
      let remainderCents = inferredCents;
      for (const addon of sortedAddOns) {
        if (addon.cents <= remainderCents + 1) {
          inferredAddOns.push({ name: addon.name, price: addon.cents / 100 });
          remainderCents -= addon.cents;
          if (remainderCents <= 50) break;
        }
      }

      if (remainderCents > 50) inferredAddOns.length = 0;
    }
  }

  const servicePrice = Math.max(0, subtotalBeforeDiscount - addonsTotal - inferredPackageAmount);
  const discountAmount = hasCoupon ? subtotalBeforeDiscount - total : 0;

  const getPaymentBadge = () => {
    if (booking.status === "Refunded") return <Badge variant="outline">Refunded</Badge>;
    if (isFullyPaid) return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Paid in Full</Badge>;
    if (isDepositPaid) return <Badge variant="secondary">Deposit Paid</Badge>;
    if (booking.stripe_payment_id && deposit === 0) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Deposit Requested</Badge>;
    return <Badge variant="destructive">No Deposit</Badge>;
  };

  const handleRefund = async () => {
    if (!confirm(`Refund £${deposit.toFixed(2)} to ${booking.customer_name}? This will process through Stripe.`)) return;
    setProcessingRefund(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-refund", {
        body: { booking_id: booking.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Refund of £${data.amount?.toFixed(2)} processed`);
      logAudit({ staffId: booking.staff_id, action: "REFUND_INITIATED", details: `Refund of £${data.amount?.toFixed(2)} for ${booking.customer_name}. Stripe Refund: ${data.refund_id}` });
      onRefundComplete?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Refund failed: " + e.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleRequestDeposit = async () => {
    setRequestingDeposit(true);
    try {
      const { error } = await supabase.functions.invoke("send-deposit-request", {
        body: { booking_id: booking.id },
      });
      if (error) throw error;
      toast.success("Deposit request sent to " + booking.customer_email);
      logAudit({ staffId: booking.staff_id, action: "DEPOSIT_REQUEST_SENT", details: `Deposit request sent to ${booking.customer_email} for ${booking.customer_name}. Total: £${total.toFixed(2)}.` });
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setRequestingDeposit(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
        </div>

        <ScrollHintWrapper className="max-h-[75dvh] px-6 pb-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={booking.status === "Confirmed" ? "default" : booking.status === "Cancelled" || booking.status === "No Show" || booking.status === "Refunded" ? "destructive" : "secondary"}>
              {booking.status}
            </Badge>
            {getPaymentBadge()}
            {booking.is_groomers_own_customer && (
              <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">Own Customer • 50%</Badge>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <Row label="Customer" value={booking.customer_name} />
            <Row label="Email" value={booking.customer_email} />
            <Row label="Phone" value={booking.customer_phone} />
            <Row label="Dog" value={booking.dog_name} />
            <Row label="Breed" value={booking.breed_name} />
            <Row label="Service" value={booking.service_name} />
            <Row label="Date" value={format(new Date(booking.booking_date), "EEEE, dd MMM yyyy")} />
            <Row label="Time" value={booking.booking_time.slice(0, 5)} />
            <Row label="Groomer" value={booking.staff_name} />
          </div>

          {/* Itemized Price Breakdown */}
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price Breakdown</p>

            {/* Service base price */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{booking.service_name || "Service"}</span>
              <span className="font-medium">£{servicePrice.toFixed(2)}</span>
            </div>

            {/* Explicit add-ons */}
            {(bookingAddons || []).map((ba: any) => (
              <div key={ba.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  {ba.add_ons?.name || "Add-on"}
                </span>
                <span className="font-medium">£{Number(ba.add_ons?.price || 0).toFixed(2)}</span>
              </div>
            ))}

            {/* Inferred add-ons for legacy bookings */}
            {inferredPackageAmount > 0 && inferredAddOns.length > 0 && inferredAddOns.map((addon, i) => (
              <div key={`inferred-${i}`} className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  {addon.name}
                </span>
                <span className="font-medium">£{addon.price.toFixed(2)}</span>
              </div>
            ))}

            {inferredPackageAmount > 0 && inferredAddOns.length === 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Additional add-ons
                </span>
                <span className="font-medium">£{inferredPackageAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Subtotal (only if there are add-ons or coupon) */}
            {(addonsTotal > 0 || hasCoupon || inferredPackageAmount > 0) && (
              <div className="flex justify-between text-sm border-t pt-1.5 mt-1.5">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">£{subtotalBeforeDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Coupon discount */}
            {hasCoupon && (
              <div className="flex justify-between text-sm text-purple-700">
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  <code className="font-mono bg-purple-100 px-1 rounded text-xs">{couponUsage.coupons.code}</code>
                  <span className="text-xs">
                    ({discountType === "percentage" ? `${discountVal}%` : `£${discountVal.toFixed(2)}`})
                  </span>
                </span>
                <span className="font-medium">−£{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {hasCoupon && couponUsage.applied_by_staff_name && (
              <p className="text-xs text-purple-600 pl-5">Applied by {couponUsage.applied_by_staff_name}</p>
            )}

            {/* Total */}
            <div className="flex justify-between text-sm border-t pt-1.5 mt-1.5">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary">£{total.toFixed(2)}</span>
            </div>

            {/* Deposit & Balance */}
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Deposit Paid</span>
              <span className={`font-medium ${deposit > 0 ? "text-emerald-600" : "text-destructive"}`}>
                £{deposit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Balance Due</span>
              <span className="font-semibold">£{balanceDue.toFixed(2)}</span>
            </div>

            {isFullyPaid && booking.status !== "Refunded" && (
              <p className="text-xs text-emerald-600 mt-1">✓ Nothing to charge on the day</p>
            )}
            {balanceDue > 0 && booking.status !== "Refunded" && booking.status !== "Cancelled" && (
              <p className="text-xs text-muted-foreground mt-1">Due at the salon after the appointment</p>
            )}
          </div>

          {booking.stripe_payment_id && (
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              Stripe: {booking.stripe_payment_id}
            </div>
          )}

          {booking.notes && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{booking.notes}</p>
            </div>
          )}

          {/* Request Deposit */}
          {deposit === 0 && booking.customer_email && booking.status !== "Cancelled" && booking.status !== "No Show" && booking.status !== "Refunded" && (
            <Button variant="outline" size="sm" className="w-full" disabled={requestingDeposit} onClick={handleRequestDeposit}>
              <Send className="h-4 w-4 mr-1" />
              {requestingDeposit ? "Sending…" : "Request Deposit Payment"}
            </Button>
          )}

          {/* Director-only Refund button */}
          {isDirector && deposit > 0 && booking.status !== "Refunded" && (
            <Button variant="destructive" size="sm" className="w-full" disabled={processingRefund} onClick={handleRefund}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {processingRefund ? "Processing…" : `Refund Deposit (£${deposit.toFixed(2)})`}
            </Button>
          )}
        </div>
        </ScrollHintWrapper>
      </DialogContent>
    </Dialog>
  );
}
