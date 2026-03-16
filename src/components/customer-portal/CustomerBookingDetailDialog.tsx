import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Booking {
  id: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  notes?: string | null;
  services?: { name: string } | null;
  service_id?: string | null;
  breed_id?: string | null;
  staff?: { name: string } | null;
}

interface Props {
  booking: Booking | null;
  onClose: () => void;
  getStatusBadge: (booking: Booking) => React.ReactNode;
}

export function CustomerBookingDetailDialog({ booking, onClose, getStatusBadge }: Props) {
  // Fetch coupon usage (discount info only, never show code)
  const { data: couponInfo } = useQuery({
    queryKey: ["customer-booking-discount", booking?.id],
    queryFn: async () => {
      if (!booking) return null;
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("*, coupons(discount_type, discount_value)")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.coupons) return null;
      return {
        discount_type: data.coupons.discount_type as string,
        discount_value: Number(data.coupons.discount_value),
      };
    },
    enabled: !!booking,
  });

  // Fetch audit log for customer-facing timeline
  const { data: auditLog } = useQuery({
    queryKey: ["customer-booking-audit", booking?.id],
    queryFn: async () => {
      if (!booking) return [];
      const { data, error } = await supabase
        .from("booking_audit_log" as any)
        .select("event_type, performed_at, note")
        .eq("booking_id", booking.id)
        .in("event_type", ["coupon_applied", "coupon_refund", "coupon_removed"])
        .order("performed_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!booking,
  });

  if (!booking) return null;

  const total = Number(booking.total_price);
  const deposit = Number(booking.deposit_paid);
  const balance = Math.max(0, total - deposit);

  // Calculate original price from discount
  let originalPrice: number | null = null;
  let discountAmount: number | null = null;
  let discountLabel: string | null = null;

  if (couponInfo) {
    if (couponInfo.discount_type === "percentage") {
      originalPrice = total / (1 - couponInfo.discount_value / 100);
      discountAmount = originalPrice - total;
      discountLabel = `${couponInfo.discount_value}% off`;
    } else {
      originalPrice = total + couponInfo.discount_value;
      discountAmount = couponInfo.discount_value;
      discountLabel = `£${couponInfo.discount_value.toFixed(2)} off`;
    }
  }

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {(booking.services as any)?.name || "Grooming"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Dog</span><span>{booking.dog_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{format(new Date(booking.booking_date), "EEE d MMM yyyy")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{booking.booking_time?.slice(0, 5)}</span></div>
            {(booking.staff as any)?.name && (
              <div className="flex justify-between"><span className="text-muted-foreground">Groomer</span><span>{(booking.staff as any).name}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{getStatusBadge(booking)}</div>
          </div>

          <Separator />

          {/* Price breakdown with discount */}
          <div className="space-y-2 text-sm">
            {couponInfo && originalPrice != null && discountAmount != null ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service price</span>
                  <span className="font-medium">£{originalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Tag className="h-3 w-3" />
                    Discount ({discountLabel})
                  </span>
                  <span className="font-medium text-emerald-600">-£{discountAmount.toFixed(2)}</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">
                  ✓ Discount applied
                </Badge>
                <div className="flex justify-between border-t pt-1.5 mt-1">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">£{total.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Price</span>
                <span className="font-semibold">£{total.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Paid</span>
              <span className="text-green-600 font-medium">£{deposit.toFixed(2)}</span>
            </div>
            {balance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance Due</span>
                <span className="text-accent font-semibold">£{balance.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Simplified customer audit trail for coupon actions */}
          {auditLog && auditLog.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                {auditLog.map((entry: any, i: number) => {
                  let text = "";
                  if (entry.event_type === "coupon_applied") {
                    text = `Discount applied — ${discountLabel || "discount"}`;
                  } else if (entry.event_type === "coupon_refund") {
                    // Extract refund amount from note
                    const match = entry.note?.match(/£([\d.]+)/);
                    text = match ? `Refund of £${match[1]} issued` : "Refund issued";
                  } else if (entry.event_type === "coupon_removed") {
                    text = "Discount removed";
                  }
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-emerald-500">✓</span>
                      <span>{text}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
