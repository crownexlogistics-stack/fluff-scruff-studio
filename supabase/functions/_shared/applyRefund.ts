// Records a Stripe refund on the matching booking. Idempotent: stores the
// absolute refunded total from Stripe (never adds), so replays are safe.
// Does NOT touch deposit_paid (process-refund already manages that).
// deno-lint-ignore no-explicit-any
export async function applyRefundToBooking(supabase: any, stripe: any, paymentIntentId: string) {
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, refunded_amount, deposit_paid")
    .eq("stripe_payment_id", paymentIntentId)
    .maybeSingle();
  if (!booking) return { matched: false };

  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  const ok = refunds.data.filter((r: any) => r.status === "succeeded" || r.status === "pending");
  const totalPence = ok.reduce((s: number, r: any) => s + r.amount, 0);
  if (totalPence <= 0) return { matched: true, changed: false };
  const total = totalPence / 100;
  const latest = Math.max(...ok.map((r: any) => r.created)) * 1000;

  if (Number(booking.refunded_amount || 0) === total) return { matched: true, changed: false };

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const fullyRefunded = totalPence >= (pi.amount_received || 0);
  const update: Record<string, unknown> = {
    refunded_amount: total,
    refunded_at: new Date(latest).toISOString(),
  };
  const st = (booking.status || "").toLowerCase();
  if (fullyRefunded && st !== "completed") update.status = "Refunded";

  await supabase.from("bookings").update(update).eq("id", booking.id);
  await supabase.from("booking_audit_log").insert({
    booking_id: booking.id,
    event_type: "refunded",
    performed_by: "Stripe",
    note: `Stripe refund recorded: £${total.toFixed(2)} refunded in total${fullyRefunded ? " (full refund)" : " (partial)"} on ${new Date(latest).toLocaleString("en-GB", { timeZone: "Europe/London" })}.`,
  });
  return { matched: true, changed: true, total };
}
