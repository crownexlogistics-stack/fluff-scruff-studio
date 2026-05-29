import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Stripe webhook — confirms or cancels bookings server-side so an abandoned
// checkout cannot leave a Pending booking blocking the calendar.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !whSecret) {
    return new Response(JSON.stringify({ error: "Stripe keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, whSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      if (!bookingId) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_booking_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      const amountPaid = (session.amount_total ?? 0) / 100;

      const { data: booking } = await supabase
        .from("bookings")
        .select("id, status, stripe_payment_id, customer_name")
        .eq("id", bookingId)
        .maybeSingle();

      if (!booking) {
        return new Response(JSON.stringify({ ok: true, skipped: "booking_not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Idempotency — already recorded for this PI
      if (
        booking.status === "Confirmed" &&
        booking.stripe_payment_id &&
        (!paymentIntentId || booking.stripe_payment_id === paymentIntentId)
      ) {
        return new Response(JSON.stringify({ ok: true, already_recorded: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("bookings")
        .update({
          status: "Confirmed",
          deposit_paid: amountPaid,
          stripe_payment_id: paymentIntentId,
        })
        .eq("id", bookingId);

      await supabase.from("audit_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        action: "PAYMENT_CONFIRMED_WEBHOOK",
        details: `Payment confirmed via Stripe webhook for ${booking.customer_name}. £${amountPaid.toFixed(2)} received. Payment Intent: ${paymentIntentId ?? "unknown"}. Booking ${bookingId}.`,
      } as any);

      return new Response(JSON.stringify({ ok: true, confirmed: bookingId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      if (!bookingId) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_booking_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: booking } = await supabase
        .from("bookings")
        .select("id, status, stripe_payment_id, customer_name")
        .eq("id", bookingId)
        .maybeSingle();

      // Only cancel if still pending and unpaid — never overwrite a confirmed booking
      if (booking && booking.status === "Pending" && !booking.stripe_payment_id) {
        await supabase
          .from("bookings")
          .update({ status: "Cancelled" })
          .eq("id", bookingId);

        await supabase.from("audit_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          action: "BOOKING_CANCELLED_CHECKOUT_EXPIRED",
          details: `Booking ${bookingId} (${booking.customer_name}) cancelled — Stripe checkout expired without payment.`,
        } as any);
      }

      return new Response(JSON.stringify({ ok: true, expired: bookingId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unhandled events — acknowledge so Stripe doesn't retry
    return new Response(JSON.stringify({ ok: true, ignored: event.type }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});