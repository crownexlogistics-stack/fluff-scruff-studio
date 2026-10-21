import { supabase } from "@/integrations/supabase/client";

export const STAFF_DISCOUNT_OPTIONS = [0, 5, 10, 15, 20] as const;
export type StaffDiscountPct = (typeof STAFF_DISCOUNT_OPTIONS)[number];

/** Price after a percentage discount, rounded to pennies. */
export function applyStaffDiscount(subtotal: number, pct: number): { discount: number; total: number } {
  const discount = Math.round(subtotal * pct) / 100;
  return { discount, total: Math.max(0, Math.round((subtotal - discount) * 100) / 100) };
}

/**
 * Records a staff-given discount against a booking. Uses the internal (always
 * inactive) STAFFxx coupon rows so every existing card, receipt and email shows
 * the discount automatically, while customers can never type these codes online.
 */
export async function recordStaffDiscount(opts: {
  bookingId: string;
  pct: number;
  subtotal: number;
  customerEmail?: string | null;
  staffId?: string | null;
  staffName: string;
}) {
  if (!opts.pct) return;
  const code = `STAFF${opts.pct}`;
  const { data: coupon } = await supabase.from("coupons").select("id").eq("code", code).maybeSingle();
  const { discount, total } = applyStaffDiscount(opts.subtotal, opts.pct);
  if (coupon?.id) {
    await supabase.from("coupon_usages").insert({
      coupon_id: coupon.id,
      booking_id: opts.bookingId,
      customer_email: opts.customerEmail?.toLowerCase() || "unknown",
      applied_by_staff_id: opts.staffId || null,
      applied_by_staff_name: opts.staffName,
    } as any);
  }
  await (supabase.from("booking_audit_log") as any).insert({
    booking_id: opts.bookingId,
    event_type: "coupon_applied",
    performed_by: opts.staffName,
    note: `Staff discount ${opts.pct}% given by ${opts.staffName} — £${opts.subtotal.toFixed(2)} − £${discount.toFixed(2)} = £${total.toFixed(2)}`,
  });
}
