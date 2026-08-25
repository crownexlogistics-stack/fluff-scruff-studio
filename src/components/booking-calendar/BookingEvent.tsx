import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { getStaffColor } from "./staffColors";
import { Pencil, Trash2, MoreHorizontal, Eye, PenLine, XCircle, Send, CheckCircle2, Clock, MessageSquare, CreditCard, Sparkles, Ticket, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SendPaymentLinkDialog } from "./SendPaymentLinkDialog";
import { DogBriefButton } from "./DogBriefButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PackageBadge } from "@/components/packages/PackageBadge";
import { useCustomerProfileLink } from "@/hooks/useCustomerProfileLink";
import { usePermissions } from "@/config/rolePermissions";
import { useCanCheckout } from "@/hooks/useCanCheckout";

export interface BookingData {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  total_price: number;
  deposit_paid: number;
  status: string;
  notes: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff_name?: string;
  staff_id?: string;
  breed_name?: string;
  service_name?: string;
  is_block?: boolean;
  is_overtime?: boolean;
  end_time?: string;
  service_id?: string;
  breed_id?: string;
  final_charge?: number | null;
  stripe_payment_id?: string | null;
  is_groomers_own_customer?: boolean;
  sms_24h_sent?: boolean;
  sms_2h_sent?: boolean;
  duration_minutes?: number | null;
  is_migrated?: boolean;
  migrated_payment_status?: string | null;
  migrated_amount_due?: number | null;
  booking_source?: string | null;
  created_by_staff?: string | null;
}

interface BookingEventProps {
  booking: BookingData;
  staffIndex: number;
  startHour: number;
  durationHours?: number;
  overlapColumn?: number;
  overlapTotalColumns?: number;
  slotHeight?: string;
  privacyMasked?: boolean;
  onEditBlock?: (booking: BookingData) => void;
  onCancelBlock?: (booking: BookingData) => void;
  onEditOvertime?: (booking: BookingData) => void;
  onCancelOvertime?: (booking: BookingData) => void;
  onViewOrder?: (booking: BookingData) => void;
  onEditAppointment?: (booking: BookingData) => void;
  onCancelBooking?: (booking: BookingData) => void;
  onBookAgain?: (booking: BookingData) => void;
  onCheckout?: (booking: BookingData) => void;
}

export function BookingEvent({ booking, staffIndex, startHour, durationHours = 1, overlapColumn = 0, overlapTotalColumns = 1, slotHeight, privacyMasked, onEditBlock, onCancelBlock, onEditOvertime, onCancelOvertime, onViewOrder, onEditAppointment, onCancelBooking, onBookAgain, onCheckout }: BookingEventProps) {
  const navigate = useNavigate();
  const [requestingDeposit, setRequestingDeposit] = useState(false);
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [resettingCheckout, setResettingCheckout] = useState(false);
  const queryClient = useQueryClient();
  const { isManagement } = usePermissions();
  const canCheckout = useCanCheckout(booking.staff_id);

  const handleResetCheckout = async () => {
    if (resettingCheckout) return;
    const ok = window.confirm(
      `Reset checkout for ${booking.customer_name} (${booking.dog_name})?\n\nThis will:\n• Revert the appointment back to Confirmed\n• Clear cash/card/payment method\n• Remove the commission record\n\nThe groomer will then be able to check it out again on the correct profile.`
    );
    if (!ok) return;
    setResettingCheckout(true);
    try {
      const prevStatus = booking.status;
      const prevFinal = Number(booking.final_charge || 0);
      const { error: updErr } = await (supabase.from("bookings") as any)
        .update({
          status: "Confirmed",
          final_charge: null,
          cash_collected: null,
          card_collected: null,
          payment_method: null,
        })
        .eq("id", booking.id);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase
        .from("commission_records")
        .delete()
        .eq("booking_id", booking.id);
      if (delErr) throw delErr;

      await supabase.from("booking_audit_log" as any).insert({
        booking_id: booking.id,
        event_type: "status_changed",
        performed_by: "Admin",
        note: `Checkout reset (was ${prevStatus}, final charge £${prevFinal.toFixed(2)}). Commission record removed so the appointment can be checked out again.`,
      });

      logAudit({
        staffId: booking.staff_id,
        action: "BOOKING_CHECKOUT_RESET",
        details: `Reset checkout for ${booking.customer_name} (${booking.dog_name}) on ${format(new Date(booking.booking_date), "dd MMM yyyy")} at ${booking.booking_time.slice(0, 5)}. Was ${prevStatus}, final charge £${prevFinal.toFixed(2)}. Commission record deleted.`,
      });

      toast.success("Checkout reset — groomer can check out again");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["commission-records"] });
      queryClient.invalidateQueries({ queryKey: ["booking-audit-log", booking.id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    } catch (e: any) {
      toast.error("Reset failed: " + (e?.message || "unknown error"));
    } finally {
      setResettingCheckout(false);
    }
  };

  const { profileEmail: resolvedProfileEmail, canNavigate: canOpenProfile } =
    useCustomerProfileLink({
      email: booking.customer_email,
      phone: booking.customer_phone,
      bookingSource: (booking as any).booking_source,
    });

  // Fetch add-ons for this booking
  const { data: bookingAddons } = useQuery({
    queryKey: ["booking-addons-display", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_addons" as any)
        .select("addon_id, add_ons(name, price)")
        .eq("booking_id", booking.id);
      if (error) return [];
      return (data as any[]) || [];
    },
  });

  // Fetch coupon usage for full price breakdown
  const { data: eventCouponUsage } = useQuery({
    queryKey: ["booking-coupon-event", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("applied_by_staff_name, coupons(code, discount_type, discount_value)")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: !booking.is_block && !booking.is_overtime,
  });

  // Fallback breed pricing helps explain older bookings with missing booking_addons rows
  const { data: breedPricing } = useQuery({
    queryKey: ["booking-breed-pricing", booking.breed_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breeds")
        .select("price_full_groom, price_bath_brush")
        .eq("id", booking.breed_id as string)
        .maybeSingle();
      if (error) return null;
      return data as { price_full_groom: number; price_bath_brush: number } | null;
    },
    enabled: !booking.is_block && !booking.is_overtime && !!booking.breed_id,
  });

  // Known add-ons catalogue for reverse-matching legacy bookings
  const { data: allAddOns } = useQuery({
    queryKey: ["all-add-ons-event"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("add_ons")
        .select("id, name, price")
        .order("price", { ascending: false });
      if (error) return [];
      return (data || []) as { id: string; name: string; price: number }[];
    },
    enabled: !booking.is_block && !booking.is_overtime,
  });

  const hasCoupon = !!eventCouponUsage?.coupons;

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
    enabled: !booking.is_block && !booking.is_overtime,
  });

  const total = Number(booking.total_price || 0);
  const deposit = Number(booking.deposit_paid || 0);
  const balanceDue = Math.max(0, total - deposit);
  const addonsTotal = (bookingAddons || []).reduce((sum: number, addon: any) => sum + Number(addon.add_ons?.price || 0), 0);
  const discountType = eventCouponUsage?.coupons?.discount_type as string | undefined;
  const discountValue = Number(eventCouponUsage?.coupons?.discount_value || 0);

  const subtotalBeforeDiscount = hasCoupon
    ? discountType === "percentage" && discountValue < 100
      ? total / (1 - discountValue / 100)
      : total + discountValue
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

  // Try to match inferred amount to known add-ons using pence math
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

  const isCancelled = booking.status === "Cancelled";
  const isNoShow = booking.status === "No Show";
  const isRefunded = booking.status === "Refunded";
  const isGhost = isNoShow || isCancelled || isRefunded;
  const color = isGhost ? { bg: "bg-muted", text: "text-muted-foreground" } : getStaffColor(staffIndex);
  const timeParts = booking.booking_time.split(":");
  const hour = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1] || "0");
  // Use CSS calc with slotHeight for responsive positioning
  const sh = slotHeight || "64px";
  const timeOffset = hour - startHour + minutes / 60;
  const topOffset = `calc(${sh} * ${timeOffset})`;

  let calculatedDuration = durationHours;
  if (booking.end_time) {
    const endParts = booking.end_time.split(":");
    const endHour = parseInt(endParts[0]);
    const endMin = parseInt(endParts[1] || "0");
    calculatedDuration = (endHour + endMin / 60) - (hour + minutes / 60);
    if (calculatedDuration <= 0) calculatedDuration = 1;
  } else if (booking.duration_minutes) {
    calculatedDuration = booking.duration_minutes / 60;
  }

  // No Show: shrink to thin strip; minimum 30px for real bookings
  const heightCalc = isGhost ? "16px" : `max(calc(${sh} * ${calculatedDuration}), 30px)`;
  // Approximate numeric height for visibility logic (assume ~46px per slot as fallback)
  const numericSlotH = 46;
  const height = isGhost ? 16 : Math.max(calculatedDuration * numericSlotH, 30);

  // Shorter appointments get higher z-index so they're never hidden behind longer ones
  const zIndex = Math.max(10, 50 - Math.floor(calculatedDuration * 5));

  // Overlap layout: side-by-side columns
  const colWidthPercent = 100 / overlapTotalColumns;
  const leftPercent = overlapColumn * colWidthPercent;
  const overlapStyle: React.CSSProperties = {
    top: topOffset,
    left: `calc(${leftPercent}% + 2px)`,
    width: `calc(${colWidthPercent}% - 4px)`,
    zIndex,
  };

  if (booking.is_block) {
    const isFullDayOff = booking.notes === "Not working today" || (!booking.end_time && !booking.booking_time);
    const blockHeightCalc = `max(calc(${sh} * ${calculatedDuration}), 30px)`;
    const blockHeight = Math.max(calculatedDuration * numericSlotH, 30);
    const blockTimeLabel = isFullDayOff
      ? `${booking.staff_name} — Not working today`
      : `${booking.booking_time.slice(0, 5)} — ${booking.end_time?.slice(0, 5) || "Unknown"}`;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className={cn("absolute rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity overflow-hidden border-2 border-background shadow-sm", color.bg, color.text)}
            style={{ ...overlapStyle, height: blockHeightCalc, minHeight: "28px" }}
          >
            {blockHeight >= 80 ? (
              <>
                <p className="font-bold">⛔ {isFullDayOff ? "Not Working" : "Unavailable"}</p>
                <p className="opacity-80">{booking.staff_name}</p>
                {!isFullDayOff && <p className="opacity-70 text-[10px]">{blockTimeLabel}</p>}
                {isFullDayOff && <p className="opacity-70 text-[10px]">Not working today</p>}
                {booking.notes && !isFullDayOff && <p className="opacity-70 truncate text-[10px]">{booking.notes}</p>}
              </>
            ) : blockHeight >= 50 ? (
              <>
                <p className="font-bold">⛔ {isFullDayOff ? "Not Working" : "Unavailable"}</p>
                <p className="opacity-80 text-[10px]">{isFullDayOff ? booking.staff_name : blockTimeLabel}</p>
              </>
            ) : (
              <p className="font-bold truncate">⛔ {isFullDayOff ? `${booking.staff_name} — Off` : blockTimeLabel}</p>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-1rem)] sm:w-[22rem] md:w-[24rem] max-w-[24rem] p-0 overflow-y-auto overscroll-contain"
          side="bottom"
          align="center"
          sideOffset={6}
          avoidCollisions
          collisionPadding={{ top: 16, bottom: 16, left: 8, right: 8 }}
          sticky="always"
          style={{ maxHeight: "min(85dvh, var(--radix-popover-content-available-height))" }}
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{booking.staff_name} — Unavailable</p>
              </div>
              <Badge variant="destructive">Blocked</Badge>
            </div>
            <div className="text-sm space-y-1">
              <p>{format(new Date(booking.booking_date), "EEEE, dd MMM yyyy")}</p>
              <p className="text-muted-foreground">{blockTimeLabel}</p>
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
        </PopoverContent>
      </Popover>
    );
  }

  if (booking.is_overtime) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className="absolute rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity bg-emerald-100 text-emerald-900 border-2 border-background shadow-sm overflow-hidden"
            style={{ ...overlapStyle, height: `max(calc(${sh} * ${calculatedDuration}), 28px)`, minHeight: "28px" }}
          >
            <p className="font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> Overtime</p>
            <p className="opacity-80">{booking.staff_name}</p>
            {booking.notes && <p className="opacity-70 truncate text-[10px]">{booking.notes}</p>}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-1rem)] sm:w-[22rem] md:w-[24rem] max-w-[24rem] p-0 overflow-y-auto overscroll-contain"
          side="bottom"
          align="center"
          sideOffset={6}
          avoidCollisions
          collisionPadding={{ top: 16, bottom: 16, left: 8, right: 8 }}
          sticky="always"
          style={{ maxHeight: "min(85dvh, var(--radix-popover-content-available-height))" }}
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Overtime / Extra Shift</p>
                <p className="text-xs text-muted-foreground">{booking.staff_name}</p>
              </div>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <Clock className="h-3 w-3 mr-1" /> Overtime
              </Badge>
            </div>
            <div className="text-sm space-y-1">
              <p>{format(new Date(booking.booking_date), "EEEE, dd MMM yyyy")}</p>
              <p className="text-muted-foreground">
                {booking.booking_time.slice(0, 5)} — {booking.end_time?.slice(0, 5) || "Unknown"}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800">
              These hours are visible to customers as available booking slots.
            </div>
            {booking.notes && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{booking.notes}</p>
              </div>
            )}
            <div className="border-t pt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onEditOvertime?.(booking)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onCancelOvertime?.(booking)}>
                <Trash2 className="h-3 w-3 mr-1" /> Remove Overtime
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Privacy-masked mode: show coloured block with "Booked" only, tooltip instead of popover
  if (privacyMasked && !booking.is_block && !booking.is_overtime) {
    const endTimeStr = booking.end_time?.slice(0, 5) || (() => {
      const dur = booking.duration_minutes || calculatedDuration * 60;
      const endM = hour * 60 + minutes + dur;
      return `${Math.floor(endM / 60).toString().padStart(2, '0')}:${(endM % 60).toString().padStart(2, '0')}`;
    })();
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "absolute rounded-md px-2 py-1 text-xs overflow-hidden opacity-70 border-2 border-background shadow-sm",
                color.bg, color.text,
                isGhost && "line-through opacity-30"
              )}
              style={{ ...overlapStyle, height: heightCalc, minHeight: isGhost ? "16px" : "48px" }}
            >
              {isGhost ? (
                <p className="font-medium truncate text-[10px]">
                  {isRefunded ? "Refunded" : isCancelled ? "Cancelled" : "No Show"}
                </p>
              ) : height < 50 ? (
                <p className="text-[10px] font-bold truncate">{booking.booking_time.slice(0, 5)}</p>
              ) : height < 80 ? (
                <>
                  <p className="text-[10px] opacity-70">{booking.booking_time.slice(0, 5)}</p>
                  <p className="font-bold truncate">Booked</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] opacity-70">{booking.booking_time.slice(0, 5)}</p>
                  <p className="font-bold truncate">Booked</p>
                  <p className="opacity-80 truncate text-[10px]">With: {booking.staff_name}</p>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs font-medium">Booked {booking.booking_time.slice(0, 5)}–{endTimeStr}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const tooltipSummary = `${booking.service_name || "Grooming"} · ${booking.customer_name} · ${booking.dog_name}${booking.breed_name ? ` (${booking.breed_name})` : ""} · ${booking.booking_time.slice(0, 5)} · ${booking.staff_name || ""}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          title={tooltipSummary}
          className={cn(
            "absolute rounded-md px-2 py-1 text-xs cursor-pointer overflow-hidden transition-opacity hover:opacity-90 border-2 border-background shadow-sm",
            color.bg, color.text,
            isGhost && "line-through opacity-50"
          )}
          style={{ ...overlapStyle, height: heightCalc, minHeight: isGhost ? "16px" : "48px" }}
        >
          {isGhost ? (
            <p className="font-medium truncate text-[10px]">
              {booking.customer_name} — {isRefunded ? "Refunded" : isCancelled ? "Cancelled" : "No Show"}
            </p>
          ) : (
            <>
              {booking.is_migrated && (
                <span className="absolute top-0.5 right-0.5 bg-amber-500 text-white text-[8px] font-bold rounded px-0.5 leading-tight z-20">W</span>
              )}
              {hasCoupon && !booking.is_migrated && (
                <span className="absolute top-0.5 right-0.5 bg-purple-600 text-white text-[8px] font-bold rounded px-0.5 leading-tight z-20">🏷</span>
              )}
              {hasCoupon && booking.is_migrated && (
                <span className="absolute top-0.5 right-4 bg-purple-600 text-white text-[8px] font-bold rounded px-0.5 leading-tight z-20">🏷</span>
              )}
              {height < 50 ? (
                <p className="text-[10px] font-bold truncate">{booking.booking_time.slice(0, 5)}</p>
              ) : height < 80 ? (
                <>
                  <p className="text-[10px] opacity-70">{booking.booking_time.slice(0, 5)}</p>
                  <p className="font-bold truncate">{booking.customer_name}</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] opacity-70">{booking.booking_time.slice(0, 5)}</p>
                  <p className="font-bold truncate">{booking.service_name || "Grooming"}</p>
                  <p className="truncate">{booking.dog_name}{booking.breed_name ? ` (${booking.breed_name})` : ""}</p>
                  <p className="truncate">{booking.customer_name}</p>
                  <p className="opacity-80 truncate text-[10px]">With: {booking.staff_name}</p>
                </>
              )}
            </>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-1rem)] sm:w-[22rem] md:w-[24rem] max-w-[24rem] p-0 overflow-y-auto overscroll-contain"
        side="bottom"
        sideOffset={6}
        align="center"
        avoidCollisions
        collisionPadding={{ top: 16, bottom: 16, left: 8, right: 8 }}
        sticky="always"
        style={{ maxHeight: "min(85dvh, var(--radix-popover-content-available-height))" }}
      >
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
                  resolvedProfileEmail &&
                  navigate(`/admin/customers/${encodeURIComponent(resolvedProfileEmail)}`)
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

      {/* Status + Payment badges */}
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
          const deposit = Number(booking.deposit_paid);
          const total = Number(booking.total_price);
          if (booking.status === "Refunded") {
            return <Badge variant="outline">Refunded</Badge>;
          }
          if (deposit >= total && total > 0) {
            return (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> All Paid Online
              </Badge>
            );
          }
          if (deposit > 0) {
            return <Badge variant="secondary">Deposit Paid</Badge>;
          }
          return <Badge variant="destructive">NOT PAID</Badge>;
        })()}
      </div>

      {/* Paid in full callout */}
      {Number(booking.deposit_paid) >= Number(booking.total_price) && Number(booking.total_price) > 0 && booking.status !== "Refunded" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Customer paid in full online — nothing to charge on the day.</span>
        </div>
      )}


      {/* Stripe Transaction ID */}
      {booking.stripe_payment_id && (
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          Stripe: {booking.stripe_payment_id}
        </div>
      )}

      {/* SMS Reminder Status */}
      {!booking.is_block && !booking.is_overtime && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <MessageSquare className={cn("h-3 w-3", booking.sms_24h_sent ? "text-emerald-500" : "text-muted-foreground/40")} />
            <span className={cn(booking.sms_24h_sent ? "text-emerald-600 font-medium" : "text-muted-foreground/50")}>24h SMS</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className={cn("h-3 w-3", booking.sms_2h_sent ? "text-emerald-500" : "text-muted-foreground/40")} />
            <span className={cn(booking.sms_2h_sent ? "text-emerald-600 font-medium" : "text-muted-foreground/50")}>2h SMS</span>
          </div>
        </div>
      )}

          {/* Details */}
          <div className="text-sm space-y-1">
            <p>{format(new Date(booking.booking_date), "EEE, MMM d")} • {booking.booking_time.slice(0, 5)}{(() => {
              if (!booking.duration_minutes) return "";
              const [h, m] = booking.booking_time.split(":").map(Number);
              const endMin = h * 60 + m + (booking.duration_minutes || 60);
              return ` – ${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
            })()}</p>
          </div>

          {/* Package Badge */}
          <PackageBadge bookingId={booking.id} />

          <div className="border-t pt-3">
            <p className="font-medium">
              {booking.service_name || "Grooming"} — {booking.dog_name}
              {booking.breed_name ? ` (${booking.breed_name})` : ""}
            </p>
            <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
            {booking.is_groomers_own_customer && (
              <Badge className="mt-1 text-xs bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400">Own Customer • 50%</Badge>
            )}
          </div>

          <div className="bg-muted/40 border rounded-md px-3 py-2 text-xs space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Price Breakdown</p>

            <div className="flex justify-between">
              <span className="text-muted-foreground">{booking.service_name || "Service"}</span>
              <span className="font-medium">£{servicePrice.toFixed(2)}</span>
            </div>

            {(bookingAddons || []).map((ba: any) => (
              <div key={ba.addon_id} className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  {ba.add_ons?.name || "Add-on"}
                </span>
                <span className="font-medium">£{Number(ba.add_ons?.price || 0).toFixed(2)}</span>
              </div>
            ))}

            {inferredPackageAmount > 0 && inferredAddOns.length > 0 && inferredAddOns.map((addon, i) => (
              <div key={`inferred-${i}`} className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  {addon.name}
                </span>
                <span className="font-medium">£{addon.price.toFixed(2)}</span>
              </div>
            ))}

            {inferredPackageAmount > 0 && inferredAddOns.length === 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    Additional add-ons
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
                  <code className="font-mono bg-purple-100 px-1 rounded text-[10px]">{eventCouponUsage?.coupons?.code}</code>
                  <span>{discountType === "percentage" ? `(${discountValue}%)` : `(£${discountValue.toFixed(2)})`}</span>
                </span>
                <span className="font-semibold">−£{discountAmount.toFixed(2)}</span>
              </div>
            )}

            {hasCoupon && eventCouponUsage?.applied_by_staff_name && (
              <p className="text-[10px] text-purple-600 pl-4">Applied by {eventCouponUsage.applied_by_staff_name}</p>
            )}

            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary">£{total.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Paid</span>
              <span className={cn("font-medium", deposit > 0 ? "text-emerald-600" : "text-destructive")}>
                £{deposit.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance Due</span>
              <span className="font-semibold">£{balanceDue.toFixed(2)}</span>
            </div>

            {balanceDue > 0 && booking.status !== "Refunded" && booking.status !== "Cancelled" && booking.status !== "No Show" && (
              <p className="text-[10px] text-muted-foreground">Due at the salon after the appointment.</p>
            )}
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

          {booking.notes && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">{booking.notes}</p>
            </div>
          )}

          {/* Request Deposit for internally booked, unpaid appointments */}
          {Number(booking.deposit_paid) === 0 && booking.customer_email && booking.status !== "Cancelled" && booking.status !== "No Show" && booking.status !== "Refunded" && (
            <div className="border-t pt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={requestingDeposit}
                onClick={async () => {
                  setRequestingDeposit(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("send-deposit-request", {
                      body: {
                        booking_id: booking.id,
                      },
                    });
                    if (error) throw error;
                    toast.success("Deposit request email sent to " + booking.customer_email);
                    logAudit({ staffId: booking.staff_id, action: "DEPOSIT_REQUEST_SENT", details: `Deposit request sent to ${booking.customer_email} for ${booking.customer_name} (${booking.dog_name}). Total: £${Number(booking.total_price).toFixed(2)}.` });
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

          {/* Send Payment Link — when there's an amount due */}
          {Number(booking.total_price) - Number(booking.deposit_paid) > 0 && booking.status !== "Cancelled" && booking.status !== "No Show" && booking.status !== "Refunded" && (
            <div className={Number(booking.deposit_paid) === 0 ? "" : "border-t pt-3"}>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setPaymentLinkOpen(true)}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                💳 Send Payment Link
              </Button>
            </div>
          )}
          <SendPaymentLinkDialog open={paymentLinkOpen} onOpenChange={setPaymentLinkOpen} booking={booking} />

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
                ) : booking.stripe_payment_id || Number(booking.deposit_paid) > 0 ? (
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
                  };
                  const dotColor = dotColors[entry.event_type] || "#9e9e9e";

                  let text = entry.note || entry.event_type;
                  if (entry.event_type === "created_online") text = "Booked online by customer";
                  else if (entry.event_type === "created_by_staff") text = `Created by ${entry.performed_by || "staff"}`;
                  else if (entry.event_type === "rescheduled") text = `Rescheduled by ${entry.performed_by || "staff"}: ${entry.old_date} ${entry.old_time?.slice(0, 5) || ""} → ${entry.new_date} ${entry.new_time?.slice(0, 5) || ""}`;
                  else if (entry.event_type === "cancelled") text = `Cancelled by ${entry.performed_by || "staff"}`;
                  else if (entry.event_type === "checked_in") text = `Checked in by ${entry.performed_by || "staff"}`;
                  else if (entry.event_type === "status_changed") text = entry.note || "Status changed";

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
            {/* 3-dot menu */}
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
                {isManagement && (booking.status === "Completed" || booking.status === "No Show") && !booking.is_migrated && (
                  <DropdownMenuItem onClick={handleResetCheckout} disabled={resettingCheckout}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {resettingCheckout ? "Resetting…" : "Reset Checkout (Admin)"}
                  </DropdownMenuItem>
                )}
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
              <Button size="sm" onClick={() => onCheckout?.(booking)}>
                Check Out
              </Button>
            )}
          </div>
        </div>
        
      </PopoverContent>
    </Popover>
  );
}
