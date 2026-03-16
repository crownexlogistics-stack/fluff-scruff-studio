import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ticket, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CouponApplySectionProps {
  bookingId: string;
  isMigrated?: boolean;
  currentTotal: number;
  depositPaid: number;
  onCouponApplied: (newTotal: number, couponCode: string, discountLabel: string) => void;
  existingCoupon?: {
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
  staffName: string;
  customerEmail?: string;
}

export function CouponApplySection({
  bookingId,
  isMigrated = false,
  currentTotal,
  depositPaid,
  onCouponApplied,
  existingCoupon,
  staffName,
  customerEmail,
}: CouponApplySectionProps) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    coupon?: any;
    newTotal?: number;
    discountAmount?: number;
  } | null>(null);

  const validateCoupon = async () => {
    if (!code.trim()) return;
    setValidating(true);
    setValidationResult(null);

    try {
      const upperCode = code.trim().toUpperCase();

      // Fetch coupon
      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", upperCode)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!coupon) {
        setValidationResult({ valid: false, message: "Invalid or expired code" });
        return;
      }

      // Check dates
      const now = new Date().toISOString().slice(0, 10);
      if (coupon.start_date && now < coupon.start_date) {
        setValidationResult({ valid: false, message: "This coupon is not yet active" });
        return;
      }
      if (coupon.end_date && now > coupon.end_date) {
        setValidationResult({ valid: false, message: "This coupon has expired" });
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
        setValidationResult({ valid: false, message: "This coupon has reached its usage limit" });
        return;
      }

      // Check per-customer usage
      if (coupon.max_uses_per_customer && customerEmail) {
        const { count } = await supabase
          .from("coupon_usages")
          .select("id", { count: "exact", head: true })
          .eq("coupon_id", coupon.id)
          .eq("customer_email", customerEmail.toLowerCase());
        if ((count || 0) >= coupon.max_uses_per_customer) {
          setValidationResult({ valid: false, message: "Customer has already used this coupon" });
          return;
        }
      }

      // Check min order
      if (coupon.min_order_amount && currentTotal < Number(coupon.min_order_amount)) {
        setValidationResult({ valid: false, message: `Minimum order £${Number(coupon.min_order_amount).toFixed(2)} required` });
        return;
      }

      // Calculate discount
      let discountAmount: number;
      if (coupon.discount_type === "percentage") {
        discountAmount = currentTotal * (Number(coupon.discount_value) / 100);
      } else {
        discountAmount = Math.min(Number(coupon.discount_value), currentTotal);
      }
      const newTotal = Math.max(0, currentTotal - discountAmount);

      setValidationResult({
        valid: true,
        message: `${upperCode} — ${coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `£${Number(coupon.discount_value).toFixed(2)} off`} applied`,
        coupon,
        newTotal,
        discountAmount,
      });
    } catch (e: any) {
      setValidationResult({ valid: false, message: "Error validating coupon" });
    } finally {
      setValidating(false);
    }
  };

  const applyCoupon = async () => {
    if (!validationResult?.valid || !validationResult.coupon) return;

    const coupon = validationResult.coupon;
    const newTotal = validationResult.newTotal!;
    const discountAmount = validationResult.discountAmount!;
    const upperCode = code.trim().toUpperCase();

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Record coupon usage
      await (supabase.from("coupon_usages") as any).insert({
        coupon_id: coupon.id,
        booking_id: bookingId,
        customer_email: customerEmail?.toLowerCase() || "unknown",
        applied_by_staff_id: user?.id || null,
        applied_by_staff_name: staffName,
      });

      // Increment times_used
      await supabase
        .from("coupons")
        .update({ times_used: (coupon.times_used || 0) + 1 })
        .eq("id", coupon.id);

      // Log audit
      await (supabase.from("booking_audit_log") as any).insert({
        booking_id: bookingId,
        event_type: "coupon_applied",
        performed_by: staffName,
        note: `Coupon ${upperCode} applied — ${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `£${Number(coupon.discount_value).toFixed(2)}`} discount, new total £${newTotal.toFixed(2)}, balance due £${Math.max(0, newTotal - depositPaid).toFixed(2)}`,
      });

      const discountLabel = coupon.discount_type === "percentage"
        ? `${coupon.discount_value}% off`
        : `£${Number(coupon.discount_value).toFixed(2)} off`;

      onCouponApplied(newTotal, upperCode, discountLabel);
      toast.success(`Coupon applied — saved £${discountAmount.toFixed(2)}`);
    } catch (e: any) {
      toast.error("Failed to apply coupon: " + e.message);
    }
  };

  if (existingCoupon) {
    const discountLabel = existingCoupon.discount_type === "percentage"
      ? `${existingCoupon.discount_value}% off`
      : `£${Number(existingCoupon.discount_value).toFixed(2)} off`;

    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Ticket className="h-4 w-4" />
          Discount Applied
        </Label>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
              <Check className="h-3 w-3 mr-1" />
              {discountLabel}
            </Badge>
            <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 rounded">{existingCoupon.code}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Ticket className="h-4 w-4" />
        Apply Discount
      </Label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setValidationResult(null);
          }}
          placeholder="Enter coupon code"
          className="font-mono uppercase"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={validateCoupon}
          disabled={validating || !code.trim()}
          className="shrink-0"
        >
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
        </Button>
      </div>

      {validationResult && (
        <div className={`rounded-md px-3 py-2 text-sm flex items-start gap-2 ${
          validationResult.valid
            ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
            : "bg-destructive/5 border border-destructive/20 text-destructive"
        }`}>
          {validationResult.valid ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> : <X className="h-4 w-4 mt-0.5 shrink-0" />}
          <div className="flex-1">
            <p className="font-medium">{validationResult.message}</p>
            {validationResult.valid && validationResult.newTotal != null && (
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Service price</span>
                  <span className="font-medium">£{currentTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-medium">-£{validationResult.discountAmount!.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-300 dark:border-emerald-700 pt-1 font-semibold">
                  <span>New total</span>
                  <span>£{validationResult.newTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Already paid</span>
                  <span>-£{depositPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance due</span>
                  <span>£{Math.max(0, validationResult.newTotal - depositPaid).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {validationResult?.valid && (
        <Button onClick={applyCoupon} size="sm" className="w-full">
          <Ticket className="h-4 w-4 mr-1" />
          Apply Coupon
        </Button>
      )}
    </div>
  );
}
