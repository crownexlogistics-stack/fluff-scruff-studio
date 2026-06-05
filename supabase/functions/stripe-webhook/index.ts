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

      // Package payments: route to process-package-payment (idempotent)
      if (session.metadata?.type === "package_booking") {
        try {
          await supabase.functions.invoke("process-package-payment", {
            body: { session_id: session.id },
          });
          return new Response(JSON.stringify({ ok: true, package_processed: session.id }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("stripe-webhook: failed to invoke process-package-payment", err);
          return new Response(JSON.stringify({ error: "package_processing_failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

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

      await supabase.from("booking_audit_log").insert({
        booking_id: bookingId,
        event_type: "payment_confirmed",
        performed_by: "Stripe webhook",
        note: `Payment confirmed via Stripe webhook. £${amountPaid.toFixed(2)} received. Payment Intent: ${paymentIntentId ?? "unknown"}.`,
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
        .select("id, status, stripe_payment_id, customer_name, booking_source, created_at")
        .eq("id", bookingId)
        .maybeSingle();

      // Guards: only cancel a Pending unpaid booking, AND only when it was an
      // online customer booking created in the last 4 hours. Staff bookings and
      // older bookings must never be auto-cancelled by a stale expired-session event.
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      const createdAtMs = booking?.created_at ? new Date(booking.created_at).getTime() : 0;
      const isOnline = booking?.booking_source === "online";
      const isRecent = createdAtMs >= fourHoursAgo;

      if (
        booking &&
        booking.status === "Pending" &&
        !booking.stripe_payment_id &&
        isOnline &&
        isRecent
      ) {
        await supabase
          .from("bookings")
          .update({ status: "Cancelled" })
          .eq("id", bookingId);

        await supabase.from("booking_audit_log").insert({
          booking_id: bookingId,
          event_type: "cancelled",
          performed_by: "Stripe webhook",
          note: "Booking cancelled — online Stripe checkout expired without payment (recent booking, guards passed).",
        } as any);
      } else if (booking) {
        console.log("stripe-webhook expired: skipped", {
          bookingId,
          status: booking.status,
          source: booking.booking_source,
          isRecent,
          hasPayment: !!booking.stripe_payment_id,
        });
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