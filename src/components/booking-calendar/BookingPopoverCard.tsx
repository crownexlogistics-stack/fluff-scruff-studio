import { useState } from "react";
import { ScrollHintWrapper } from "@/components/ui/scroll-hint-wrapper";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getStaffColor } from "./staffColors";
import { Pencil, Trash2, MoreHorizontal, Eye, PenLine, XCircle, Send, CheckCircle2, RotateCcw, MessageSquare, Ticket, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { useQuery } from "@tanstack/react-query";
import type { BookingData } from "./BookingEvent";
import { DogBriefButton } from "./DogBriefButton";
import { PackageBadge } from "@/components/packages/PackageBadge";
import { useCustomerProfileLink } from "@/hooks/useCustomerProfileLink";
import { useCanCheckout } from "@/hooks/useCanCheckout";

interface BookingPopoverCardProps {
  booking: BookingData;
  staffIndex?: number;
  userRole?: string | null;
  onEditBlock?: (booking: BookingData) => void;
  onCancelBlock?: (booking: BookingData) => void;
  onViewOrder?: (booking: BookingData) => void;
  onEditAppointment?: (booking: BookingData) => void;
  onCancelBooking?: (booking: BookingData) => void;
  onBookAgain?: (booking: BookingData) => void;
  onCheckout?: (booking: BookingData) => void;
  onRefundComplete?: () => void;
}

export function BookingPopoverCard({
  booking,
  staffIndex = 0,
  userRole,
  onEditBlock,
  onCancelBlock,
  onViewOrder,
  onEditAppointment,
  onCancelBooking,
  onBookAgain,
  onCheckout,
  onRefundComplete,
}: BookingPopoverCardProps) {
  const navigate = useNavigate();
  const canCheckout = useCanCheckout(booking.staff_id);
  const [requestingDeposit, setRequestingDeposit] = useState(false);
  const [processingRefund, setProcessingRefund] = useState(false);
  const isGhost = booking.status === "Cancelled" || booking.status === "No Show" || booking.status === "Refunded";
  const color = isGhost ? { bg: "bg-muted", text: "text-muted-foreground" } : getStaffColor(staffIndex);

  const deposit = Number(booking.deposit_paid);
  const total = Number(booking.total_price);
  const isPackageSession = (booking as any).booking_source === "package";

  // For package sessions, payment state lives on the parent package_bookings row,
  // not the individual booking. The session booking's deposit_paid is only a
  // per-session share and cannot be trusted on its own.
  const { data: packagePayment } = useQuery({
    queryKey: ["package-payment-for-session", booking.id],
    enabled: isPackageSession && !booking.is_block,
    queryFn: async () => {
      const { data: sess } = await supabase
        .from("package_sessions" as any)
        .select("package_booking_id")
        .eq("booking_id", booking.id)
        .maybeSingle();
      const pbId = (sess as any)?.package_booking_id;
      if (!pbId) return null;
      const { data: pb } = await supabase
        .from("package_bookings" as any)
        .select("total_paid, amount_received, payment_method, stripe_payment_status")
        .eq("id", pbId)
        .maybeSingle();
      return pb as any;
    },
  });

  const pkgTotal = Number(packagePayment?.total_paid || 0);
  const pkgReceived = Number(packagePayment?.amount_received || 0);
  const pkgFullyPaid = isPackageSession && pkgTotal > 0 && pkgReceived >= pkgTotal;
  const pkgPartPaid = isPackageSession && pkgReceived > 0 && pkgReceived < pkgTotal;
  const pkgUnpaid = isPackageSession && pkgReceived === 0;

  const isFullyPaid = isPackageSession
    ? pkgFullyPaid
    : deposit >= total && total > 0;
  const isDepositPaid = isPackageSession
    ? pkgPartPaid
    : deposit > 0 && deposit < total;
  const remaining = total - deposit;
  const isDirector = userRole === "director";

  const { profileEmail, canNavigate: canOpenProfile } = useCustomerProfileLink({
    email: booking.customer_email,
    phone: booking.customer_phone,
    bookingSource: (booking as any).booking_source,
  });

  // Fetch audit log for this booking
  const { data: auditLog } = useQuery({
    queryKey: ["booking-audit-log", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_audit_log" as any)
        .select("event_type, performed_by, performed_at, old_date, old_time, new_date, new_time, note")
        .eq("booking_id", booking.id)
        .order("performed_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !booking.is_block,
  });

  // Fetch add-ons for this booking
  const { data: popoverAddons } = useQuery({
    queryKey: ["booking-addons-popover", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_addons" as any)
        .select("addon_id, add_ons(name, price)")
        .eq("booking_id", booking.id);
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !booking.is_block,
  });

  // Fetch coupon usage for this booking
  const { data: couponUsage } = useQuery({
    queryKey: ["booking-coupon", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("*, coupons(code, discount_type, discount_value)")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !booking.is_block,
  });

  // Fallback breed pricing helps explain older bookings with missing booking_addons rows
  const { data: breedPricing } = useQuery({
    queryKey: ["booking-breed-pricing-popover", booking.breed_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breeds")
        .select("price_full_groom, price_bath_brush")
        .eq("id", booking.breed_id as string)
        .maybeSingle();
      if (error) return null;
      return data as { price_full_groom: number; price_bath_brush: number } | null;
    },
    enabled: !booking.is_block && !!booking.breed_id,
  });

  // Fetch all known add-ons to reverse-match legacy bookings
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
    enabled: !booking.is_block,
  });

  const addonsTotal = (popoverAddons || []).reduce((sum: number, ba: any) => sum + Number(ba.add_ons?.price || 0), 0);
  const hasCoupon = !!couponUsage?.coupons;
  const discountType = couponUsage?.coupons?.discount_type as string | undefined;
  const discountVal = Number(couponUsage?.coupons?.discount_value || 0);

  const subtotalBeforeDiscount = hasCoupon
    ? discountType === "percentage" && discountVal < 100
      ? total / (1 - discountVal / 100)
      : total + discountVal
    : total;

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

      // If we couldn't explain the full inferred amount, fall back to generic line
      if (remainderCents > 50) {
        inferredAddOns.length = 0;
      }
    }
  }

  const servicePrice = Math.max(0, subtotalBeforeDiscount - addonsTotal - inferredPackageAmount);
  const discountAmount = hasCoupon ? subtotalBeforeDiscount - total : 0;

  const handleRefund = async () => {
    if (!confirm(`Are you sure you want to refund this booking for ${booking.customer_name}? This will process a refund through Stripe.`)) return;
    setProcessingRefund(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-refund", {
        body: { booking_id: booking.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Refund of £${data.amount?.toFixed(2)} processed successfully`);
      logAudit({ staffId: booking.staff_id, action: "REFUND_INITIATED", details: `Refund of £${data.amount?.toFixed(2)} processed for ${booking.customer_name} (${booking.dog_name}). Booking date: ${format(new Date(booking.booking_date), "dd MMM yyyy")}. Original deposit: £${Number(booking.deposit_paid).toFixed(2)}. Stripe Refund ID: ${data.refund_id || "N/A"}.` });
      onRefundComplete?.();
    } catch (e: any) {
      toast.error("Refund failed: " + e.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  if (booking.is_block) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Blocked Time</p>
            <p className="text-xs text-muted-foreground">{booking.staff_name}</p>
          </div>
          <Badge variant="destructive">Blocked</Badge>
        </div>
        <div className="text-sm space-y-1">
          <p>{format(new Date(booking.booking_date), "EEEE, dd MMM yyyy")}</p>
          <p className="text-muted-foreground">
            {booking.booking_time.slice(0, 5)} — {booking.end_time?.slice(0, 5) || "Unknown"}
          </p>
        </div>
        {booking.notes && (
          <div className="border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
            <p className="text-sm">{booking.notes}</p>
          </div>
        )}
        <div className="border-t pt-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onEditBlock?.(booking)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onCancelBlock?.(booking)}>
            <Trash2 className="h-3 w-3 mr-1" /> Cancel Block
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ScrollHintWrapper className="max-h-[85dvh]">
    <div className="p-4 space-y-3">
      {/* Top: Customer info */}
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold", color.bg, color.text)}>
          {booking.customer_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold",
              canOpenProfile && "cursor-pointer hover:underline",
            )}
            onClick={() =>
              canOpenProfile &&
              profileEmail &&
              navigate(`/admin/customers/${encodeURIComponent(profileEmail)}`)
            }
          >
            {booking.customer_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {booking.customer_email || ""}
            {booking.customer_phone ? ` • ${booking.customer_phone}` : ""}
          </p>
        </div>
      </div>

      {/* Status + Payment + Source badges */}
      <div className="flex flex-wrap gap-2">
        {booking.is_migrated && (
          <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px]">W — Wix Booking</Badge>
        )}
        {(booking as any).booking_source === "online" && (
          <Badge className="text-[10px]" style={{ backgroundColor: "#FFB800", color: "#2D1B0E" }}>🌐 Booked Online</Badge>
        )}
        {(booking as any).booking_source === "staff" && (
          <Badge className="text-[10px]" style={{ backgroundColor: "#f0f0f0", color: "#2D1B0E" }}>
            👤 Booked by Staff{(booking as any).created_by_staff ? ` — ${(booking as any).created_by_staff}` : ""}
          </Badge>
        )}
        {(booking as any).booking_source === "phone_ai" && (
          <Badge className="text-[10px]" style={{ backgroundColor: "#7C3AED", color: "#FFFFFF" }}>
            📱 AI Booked
          </Badge>
        )}
        <Badge variant={
          booking.status === "Confirmed" ? "default" :
          booking.status === "Completed" ? "secondary" :
          booking.status === "No Show" || booking.status === "Cancelled" || booking.status === "Refunded" ? "destructive" : "secondary"
        }>
          {booking.status}
        </Badge>
        {(() => {
          if (booking.status === "Refunded") {
            return <Badge variant="outline">Refunded</Badge>;
          }
          if (isPackageSession) {
            if (pkgFullyPaid) {
              const method = packagePayment?.payment_method;
              const label =
                method === "stripe" ? "Package Paid — Stripe"
                : method === "cash" || method === "card" || method === "mixed" ? "Package Paid — Salon"
                : "Package Paid";
              return (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {label}
                </Badge>
              );
            }
            if (pkgPartPaid) {
              return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Package Part-Paid — £{(pkgTotal - pkgReceived).toFixed(2)} due</Badge>;
            }
            return <Badge variant="destructive">Package Unpaid — send link</Badge>;
          }
          if (isFullyPaid) {
            return (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> All Paid Online
              </Badge>
            );
          }
          if (isDepositPaid) {
            return (
              <Badge variant="secondary">Deposit Paid</Badge>
            );
          }
          // Has stripe_payment_id + deposit 0 = payment recorded but amount not synced (legacy)
          if ((booking as any).stripe_payment_id && deposit === 0) {
            return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Payment Received</Badge>;
          }
          return <Badge variant="destructive">NOT PAID</Badge>;
        })()}
      </div>

      {/* Paid in full callout */}
      {isFullyPaid && booking.status !== "Refunded" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Customer paid in full online — nothing to charge on the day.</span>
        </div>
      )}

      {/* Deposit paid — financial breakdown */}
      {isDepositPaid && booking.status !== "Refunded" && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800 space-y-1">
          <div className="flex justify-between">
            <span>Total Cost</span>
            <span className="font-semibold">£{total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Deposit Paid</span>
            <span className="font-semibold">£{deposit.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-amber-300 pt-1 mt-1">
            <span className="font-medium">Remaining Balance</span>
            <span className="font-bold">£{remaining.toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-amber-600 mt-1">Due at the salon on the day of appointment.</p>
        </div>
      )}

      {/* Stripe Transaction ID */}
      {(booking as any).stripe_payment_id && (
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          Stripe: {(booking as any).stripe_payment_id}
        </div>
      )}

      {/* SMS Reminder Status */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <MessageSquare className={cn("h-3 w-3", (booking as any).sms_24h_sent ? "text-emerald-500" : "text-muted-foreground/40")} />
          <span className={cn((booking as any).sms_24h_sent ? "text-emerald-600 font-medium" : "text-muted-foreground/50")}>24h SMS</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className={cn("h-3 w-3", (booking as any).sms_2h_sent ? "text-emerald-500" : "text-muted-foreground/40")} />
          <span className={cn((booking as any).sms_2h_sent ? "text-emerald-600 font-medium" : "text-muted-foreground/50")}>2h SMS</span>
        </div>
      </div>
      <div className="text-sm space-y-1">
        <p>{format(new Date(booking.booking_date), "EEE, MMM d")} • {booking.booking_time.slice(0, 5)}{(() => {
          if (!booking.duration_minutes) return "";
          const [h, m] = booking.booking_time.split(":").map(Number);
          const endMin = h * 60 + m + (booking.duration_minutes || 60);
          return ` – ${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
        })()}</p>
      </div>

      {/* Package Badge */}
      {!booking.is_block && <PackageBadge bookingId={booking.id} />}

      <div className="border-t pt-3">
        <p className="font-medium">
          {booking.service_name || "Grooming"} — {booking.dog_name}
          {booking.breed_name ? ` (${booking.breed_name})` : ""}
        </p>
        <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
        {(booking as any).is_groomers_own_customer && (
          <Badge className="mt-1 text-xs bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400">Own Customer • 50%</Badge>
        )}
      </div>

      {/* Full Price Breakdown */}
      <div className="bg-muted/40 border rounded-md px-3 py-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{booking.service_name || "Grooming"}</span>
          <span className="font-medium">£{servicePrice.toFixed(2)}</span>
        </div>

        {(popoverAddons || []).map((ba: any) => (
          <div key={ba.addon_id} className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> {ba.add_ons?.name}
            </span>
            <span className="font-medium">£{Number(ba.add_ons?.price || 0).toFixed(2)}</span>
          </div>
        ))}

        {inferredPackageAmount > 0 && inferredAddOns.length > 0 && inferredAddOns.map((addon, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> {addon.name}
            </span>
            <span className="font-medium">£{addon.price.toFixed(2)}</span>
          </div>
        ))}

        {inferredPackageAmount > 0 && inferredAddOns.length === 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Additional add-ons
              </span>
              <span className="font-medium">£{inferredPackageAmount.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground pl-4">Item details were not saved on this older booking, amount inferred from pricing.</p>
          </>
        )}

        {(addonsTotal > 0 || hasCoupon || inferredPackageAmount > 0) && (
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">£{subtotalBeforeDiscount.toFixed(2)}</span>
          </div>
        )}

        {hasCoupon && (
          <div className="flex justify-between text-purple-700">
            <span className="flex items-center gap-1">
              <Ticket className="h-3 w-3" />
              <code className="font-mono bg-purple-100 px-1 rounded text-[10px]">{couponUsage?.coupons?.code}</code>
              <span>{discountType === "percentage" ? `(${discountVal}%)` : `(£${discountVal.toFixed(2)})`}</span>
            </span>
            <span className="font-semibold">−£{discountAmount.toFixed(2)}</span>
          </div>
        )}

        {hasCoupon && couponUsage?.applied_by_staff_name && (
          <p className="text-[10px] text-purple-600">Applied by {couponUsage.applied_by_staff_name}</p>
        )}

        <div className="flex justify-between border-t pt-1 mt-1 font-bold">
          <span>Total</span>
          <span>£{total.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Deposit Paid</span>
          <span className={cn("font-medium", deposit > 0 ? "text-emerald-600" : "text-destructive")}>
            £{deposit.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Balance Due</span>
          <span className="font-semibold">£{remaining.toFixed(2)}</span>
        </div>
      </div>

      {/* Migrated booking payment info */}
      {booking.is_migrated && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800 space-y-1">
          <p className="font-medium">Imported from Wix</p>
          {booking.migrated_payment_status && (
            <div className="flex justify-between">
              <span>Payment Status</span>
              <span className="font-semibold">{booking.migrated_payment_status}</span>
            </div>
          )}
          {booking.migrated_amount_due != null && booking.migrated_amount_due > 0 && (
            <div className="flex justify-between">
              <span>Amount Due</span>
              <span className="font-bold">£{booking.migrated_amount_due.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* No Show Deposit Split */}
      {booking.status === "No Show" && Number(booking.deposit_paid) > 0 && (
        <div className="border-t pt-3">
          <p className="text-sm font-semibold mb-2" style={{ color: "#92400e" }}>No Show — Deposit Split</p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-amber-800">Total Deposit Paid</span>
              <span className="font-semibold text-amber-900">£{Number(booking.deposit_paid).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-800">Salon (50%)</span>
              <span className="font-semibold text-amber-900">£{(Number(booking.deposit_paid) * 0.5).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-800">Groomer (50%)</span>
              <span className="font-semibold text-amber-900">£{(Number(booking.deposit_paid) * 0.5).toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-amber-600 pt-1">Deposit has been split. Groomer's share will appear in their weekly payout.</p>
          </div>
        </div>
      )}

      {booking.notes && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground">{booking.notes}</p>
        </div>
      )}

      {/* Request Deposit */}
      {deposit === 0 && booking.customer_email && booking.status !== "Cancelled" && booking.status !== "No Show" && booking.status !== "Refunded" && (
        <div className="border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={requestingDeposit}
            onClick={async () => {
              setRequestingDeposit(true);
              try {
                const { data, error } = await supabase.functions.invoke("send-deposit-request", {
                  body: { booking_id: booking.id },
                });
                if (error) throw error;
                toast.success("Deposit request email sent to " + booking.customer_email);
                logAudit({ staffId: booking.staff_id, action: "DEPOSIT_REQUEST_SENT", details: `Deposit request email sent to ${booking.customer_email} for ${booking.customer_name} (${booking.dog_name}). Total: £${Number(booking.total_price).toFixed(2)}.` });
              } catch (e: any) {
                toast.error("Failed to send: " + e.message);
              } finally {
                setRequestingDeposit(false);
              }
            }}
          >
            <Send className="h-4 w-4 mr-1" />
            {requestingDeposit ? "Sending…" : "Request Deposit Payment"}
          </Button>
        </div>
      )}

      {/* Director-only Refund */}
      {isDirector && deposit > 0 && booking.status !== "Refunded" && (
        <div className="border-t pt-3">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={processingRefund}
            onClick={handleRefund}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {processingRefund ? "Processing Refund…" : "Process Refund"}
          </Button>
        </div>
      )}

      {/* AI Dog Brief */}
      {booking.status !== "Cancelled" && booking.status !== "Refunded" && (
        <div className="border-t pt-3">
          <DogBriefButton booking={booking} />
        </div>
      )}

      {/* 📋 Booking History */}
      <div className="border-t pt-3">
        <p className="font-bold text-[13px] mb-2" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif" }}>📋 Booking History</p>
        {(!auditLog || auditLog.length === 0) ? (
          <div className="space-y-1.5">
            {booking.is_migrated ? (
              <div className="flex items-start gap-2">
                <div className="mt-1 shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FF9800" }} />
                <p className="text-xs" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif", fontSize: "12px" }}>
                  Wix Migrated Appointment
                </p>
              </div>
            ) : (booking as any).booking_source === "online" ? (
              <div className="flex items-start gap-2">
                <div className="mt-1 shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FFB800" }} />
                <p className="text-xs" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif", fontSize: "12px" }}>
                  Booked online by customer
                </p>
              </div>
            ) : (booking as any).booking_source === "staff" ? (
              <div className="flex items-start gap-2">
                <div className="mt-1 shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FF6B35" }} />
                <p className="text-xs" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif", fontSize: "12px" }}>
                  Created by {(booking as any).created_by_staff || "staff"}
                </p>
              </div>
            ) : (booking as any).booking_source === "phone_ai" ? (
              <div className="flex items-start gap-2">
                <div className="mt-1 shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#7C3AED" }} />
                <p className="text-xs" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif", fontSize: "12px" }}>
                  Booked by AI Receptionist (phone)
                </p>
              </div>
            ) : (booking as any).stripe_payment_id || Number(booking.deposit_paid) > 0 ? (
              <div className="flex items-start gap-2">
                <div className="mt-1 shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FFB800" }} />
                <p className="text-xs" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif", fontSize: "12px" }}>
                  Booked online by customer
                </p>
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: "#999", fontFamily: "Nunito, sans-serif" }}>
                No history recorded — audit trail starts from today
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {auditLog.map((entry: any, i: number) => {
              const dotColors: Record<string, string> = {
                created_online: "#FFB800",
                created_by_staff: "#FF6B35",
                rescheduled: "#2D1B0E",
                cancelled: "#e53935",
                status_changed: "#9e9e9e",
                checked_in: "#43a047",
                coupon_applied: "#7c3aed",
                coupon_refund: "#e53935",
                coupon_removed: "#f97316",
              };
              const dotColor = dotColors[entry.event_type] || "#9e9e9e";

              let text = entry.note || entry.event_type;
              if (entry.event_type === "created_online") text = "Booked online by customer";
              else if (entry.event_type === "created_by_staff") text = `Created by ${entry.performed_by || "staff"}`;
              else if (entry.event_type === "rescheduled") text = `Rescheduled by ${entry.performed_by || "staff"}: ${entry.old_date} ${entry.old_time?.slice(0, 5) || ""} → ${entry.new_date} ${entry.new_time?.slice(0, 5) || ""}`;
              else if (entry.event_type === "cancelled") text = `Cancelled by ${entry.performed_by || "staff"}`;
              else if (entry.event_type === "checked_in") text = `Checked in by ${entry.performed_by || "staff"}`;
              else if (entry.event_type === "status_changed") text = entry.note || "Status changed";
              else if (entry.event_type === "coupon_applied") text = entry.note || `Coupon applied by ${entry.performed_by || "staff"}`;
              else if (entry.event_type === "coupon_refund") text = entry.note || `Coupon refund processed by ${entry.performed_by || "staff"}`;
              else if (entry.event_type === "coupon_removed") text = entry.note || `Coupon removed by ${entry.performed_by || "staff"}`;

              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-1 shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                  <p className="flex-1 text-xs" style={{ color: "#2D1B0E", fontFamily: "Nunito, sans-serif", fontSize: "12px" }}>
                    {text}
                  </p>
                  {entry.performed_at && (
                    <span className="shrink-0 text-[11px]" style={{ color: "#999", fontFamily: "Nunito, sans-serif" }}>
                      {format(new Date(entry.performed_at), "dd MMM yyyy, HH:mm")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="border-t pt-3 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onViewOrder?.(booking)}>
              <Eye className="h-4 w-4 mr-2" /> View Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditAppointment?.(booking)}>
              <PenLine className="h-4 w-4 mr-2" /> Edit Appointment
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onCancelBooking?.(booking)}>
              <XCircle className="h-4 w-4 mr-2" /> Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => onBookAgain?.(booking)}>
          Book Again
        </Button>
        {booking.status !== "Completed" && booking.status !== "No Show" && booking.status !== "Cancelled" && booking.status !== "Refunded" && (
          canCheckout ? (
            <Button size="sm" onClick={() => onCheckout?.(booking)}>
              Check Out
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Only {booking.staff_name || "the assigned groomer"} or an admin can check this out
            </span>
          )
        )}
      </div>
    </div>
    </ScrollHintWrapper>
  );
}
