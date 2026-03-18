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
  const [requestingDeposit, setRequestingDeposit] = useState(false);
  const [processingRefund, setProcessingRefund] = useState(false);
  const isGhost = booking.status === "Cancelled" || booking.status === "No Show" || booking.status === "Refunded";
  const color = isGhost ? { bg: "bg-muted", text: "text-muted-foreground" } : getStaffColor(staffIndex);

  const deposit = Number(booking.deposit_paid);
  const total = Number(booking.total_price);
  const isFullyPaid = deposit >= total && total > 0;
  const isDepositPaid = deposit > 0 && deposit < total;
  const remaining = total - deposit;
  const isDirector = userRole === "director";

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
            className="font-semibold cursor-pointer hover:underline"
            onClick={() => booking.customer_email && navigate(`/admin/customers/${encodeURIComponent(booking.customer_email)}`)}
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

      <div className="border-t pt-3">
        <p className="font-medium">
          {booking.service_name || "Grooming"} — {booking.dog_name}
          {booking.breed_name ? ` (${booking.breed_name})` : ""}
        </p>
        <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
        {/* Add-ons */}
        {popoverAddons && popoverAddons.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {popoverAddons.map((ba: any) => (
              <Badge key={ba.addon_id} variant="secondary" className="text-[10px] gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                {ba.add_ons?.name} · £{Number(ba.add_ons?.price || 0).toFixed(2)}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-sm font-medium mt-1">£{total.toFixed(2)}</p>
        {(booking as any).is_groomers_own_customer && (
          <Badge className="mt-1 text-xs bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400">Own Customer • 50%</Badge>
        )}
      </div>

      {/* Coupon Used Indicator */}
      {couponUsage?.coupons && (
        <div className="bg-purple-50 border border-purple-200 rounded-md px-3 py-2 text-xs text-purple-800 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Ticket className="h-3.5 w-3.5" />
            <span>Coupon Applied: <code className="font-mono bg-purple-100 px-1 rounded">{couponUsage.coupons.code}</code></span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span className="font-semibold">
              {couponUsage.coupons.discount_type === "percentage"
                ? `${couponUsage.coupons.discount_value}% off`
                : `£${Number(couponUsage.coupons.discount_value).toFixed(2)} off`}
            </span>
          </div>
          {(() => {
            const discountVal = Number(couponUsage.coupons.discount_value);
            const originalPrice = couponUsage.coupons.discount_type === "percentage"
              ? total / (1 - discountVal / 100)
              : total + discountVal;
            return (
              <div className="flex justify-between border-t border-purple-300 pt-1 mt-1">
                <span>Price before coupon</span>
                <span className="font-semibold line-through">£{originalPrice.toFixed(2)}</span>
              </div>
            );
          })()}
          <div className="flex justify-between">
            <span>Price after coupon</span>
            <span className="font-bold">£{total.toFixed(2)}</span>
          </div>
          {couponUsage.applied_by_staff_name && (
            <p className="text-[10px] text-purple-600">Applied by {couponUsage.applied_by_staff_name}</p>
          )}
        </div>
      )}

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
          <Button size="sm" onClick={() => onCheckout?.(booking)}>
            Check Out
          </Button>
        )}
      </div>
    </div>
    </ScrollHintWrapper>
  );
}
