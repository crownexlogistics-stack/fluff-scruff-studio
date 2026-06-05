import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reconciles successful Stripe payments back to bookings using the
// `booking_id` metadata that payment links carry, regardless of which
// email/phone the link was sent to. Increments deposit_paid and keeps
// a record of every matched payment intent on the booking.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Look at the last ~7 days of successful checkout sessions tied to
    // payment links (these inherit metadata from the payment link).
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: since },
    });

    let matched = 0;
    const matchedDetails: Array<{ booking_id: string; amount: number; pi: string }> = [];

    for (const s of sessions.data) {
      if (s.payment_status !== "paid" || s.status !== "complete") continue;

      // Package payments — back-fill via process-package-payment if no
      // package_bookings row exists yet for this PI.
      if (s.metadata?.type === "package_booking" && s.metadata?.pending_id) {
        const piIdPkg =
          typeof s.payment_intent === "string"
            ? s.payment_intent
            : s.payment_intent?.id;
        if (!piIdPkg) continue;
        const { data: existingPkg } = await supabase
          .from("package_bookings")
          .select("id")
          .eq("stripe_payment_intent_id", piIdPkg)
          .maybeSingle();
        if (existingPkg) continue;
        try {
          await supabase.functions.invoke("process-package-payment", {
            body: { session_id: s.id },
          });
          matched++;
          matchedDetails.push({ booking_id: `pkg:${s.metadata.pending_id}`, amount: (s.amount_total ?? 0) / 100, pi: piIdPkg });
        } catch (e) {
          console.error("reconcile: package back-fill failed", s.id, e);
        }
        continue;
      }

      const bookingId = s.metadata?.booking_id;
      if (!bookingId) continue;
      const pi =
        typeof s.payment_intent === "string"
          ? s.payment_intent
          : s.payment_intent?.id;
      if (!pi) continue;

      // Fetch the booking
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, total_price, deposit_paid, stripe_payment_id, extra_stripe_payment_ids, customer_name")
        .eq("id", bookingId)
        .maybeSingle();
      if (!booking) continue;

      const extras: string[] = booking.extra_stripe_payment_ids || [];
      // Already recorded against this booking?
      if (booking.stripe_payment_id === pi || extras.includes(pi)) continue;

      // Pull the payment intent to know the exact amount received
      const intent = await stripe.paymentIntents.retrieve(pi);
      const amountPaid = (intent.amount_received || 0) / 100;
      if (amountPaid <= 0) continue;

      const newDeposit = Number(booking.deposit_paid || 0) + amountPaid;
      const newExtras = [...extras, pi];

      const update: Record<string, unknown> = {
        deposit_paid: newDeposit,
        extra_stripe_payment_ids: newExtras,
      };
      // If the booking has no primary stripe id yet, set this as the primary
      if (!booking.stripe_payment_id) update.stripe_payment_id = pi;

      await supabase.from("bookings").update(update).eq("id", bookingId);

      await supabase.from("audit_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        action: "PAYMENT_LINK_AUTO_MATCHED",
        details: `Auto-matched £${amountPaid.toFixed(2)} payment to booking for ${booking.customer_name}. Stripe Payment Intent: ${pi}. New deposit_paid: £${newDeposit.toFixed(2)}.`,
      });

      matched++;
      matchedDetails.push({ booking_id: bookingId, amount: amountPaid, pi });
    }

    return new Response(
      JSON.stringify({ success: true, matched, matchedDetails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("reconcile-booking-payment-links error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});