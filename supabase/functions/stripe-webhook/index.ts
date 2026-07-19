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

      // Post-creation Stripe balance top-up for an existing package_booking
      if (session.metadata?.type === "package_topup") {
        const pbId = session.metadata.package_booking_id;
        const amountPaid = (session.amount_total ?? 0) / 100;
        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

        if (!pbId) {
          return new Response(JSON.stringify({ ok: true, skipped: "no_package_booking_id" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: pkgRow } = await supabase
          .from("package_bookings")
          .select("id, amount_received, stripe_payment_intent_id")
          .eq("id", pbId)
          .maybeSingle();

        // Idempotency: same PI already recorded → no-op
        if (pkgRow && pkgRow.stripe_payment_intent_id === pi) {
          return new Response(JSON.stringify({ ok: true, already_recorded: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const newReceived = Number(pkgRow?.amount_received || 0) + amountPaid;
        await supabase
          .from("package_bookings")
          .update({
            amount_received: newReceived,
            payment_method: "stripe",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: pi ?? pkgRow?.stripe_payment_intent_id ?? null,
            stripe_payment_status: "paid",
          })
          .eq("id", pbId);

        await supabase.from("package_payment_audit").insert({
          package_booking_id: pbId,
          event_type: "payment_matched",
          amount: amountPaid,
          performed_by: "Stripe webhook",
          note: `Stripe balance payment received. PI: ${pi ?? "unknown"}. New amount_received: £${newReceived.toFixed(2)}.`,
        } as any);

        return new Response(JSON.stringify({ ok: true, topup_recorded: pbId }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        .select("id, status, stripe_payment_id, extra_stripe_payment_ids, deposit_paid, customer_name")
        .eq("id", bookingId)
        .maybeSingle();

      if (!booking) {
        return new Response(JSON.stringify({ ok: true, skipped: "booking_not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingExtras: string[] = (booking as any).extra_stripe_payment_ids || [];
      const alreadyRecordedPi =
        !!paymentIntentId &&
        (booking.stripe_payment_id === paymentIntentId ||
          existingExtras.includes(paymentIntentId));

      // Idempotency — this exact PI is already recorded on the booking
      if (alreadyRecordedPi) {
        return new Response(JSON.stringify({ ok: true, already_recorded: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isFirstPayment = !booking.stripe_payment_id;
      const newDeposit = Number(booking.deposit_paid || 0) + amountPaid;

      const update: Record<string, unknown> = {
        status: "Confirmed",
        deposit_paid: isFirstPayment ? amountPaid : newDeposit,
      };
      if (isFirstPayment) {
        update.stripe_payment_id = paymentIntentId;
      } else if (paymentIntentId) {
        update.extra_stripe_payment_ids = [...existingExtras, paymentIntentId];
      }

      await supabase.from("bookings").update(update).eq("id", bookingId);

      await supabase.from("booking_audit_log").insert({
        booking_id: bookingId,
        event_type: "payment_confirmed",
        performed_by: "Stripe webhook",
        note: isFirstPayment
          ? `Payment confirmed via Stripe webhook. £${amountPaid.toFixed(2)} received. Payment Intent: ${paymentIntentId ?? "unknown"}.`
          : `Additional payment confirmed via Stripe webhook. £${amountPaid.toFixed(2)} received. Payment Intent: ${paymentIntentId ?? "unknown"}. New deposit_paid: £${newDeposit.toFixed(2)}.`,
      } as any);

      // Send customer confirmation email (idempotent — skip if already sent)
      try {
        const { data: existingEmail } = await supabase
          .from("booking_emails")
          .select("id")
          .eq("booking_id", bookingId)
          .eq("email_type", "confirmation")
          .maybeSingle();

        if (!existingEmail) {
          await supabase.functions.invoke("send-booking-email", {
            body: { booking_id: bookingId, email_type: "confirmation" },
          });
        } else {
          console.log("stripe-webhook: confirmation email already sent, skipping", bookingId);
        }
      } catch (emailErr) {
        console.error("stripe-webhook: failed to send confirmation email", emailErr);
      }

      // Notify assigned groomer of the new confirmed booking
      try {
        const { data: bookingForNotify } = await supabase
          .from("bookings")
          .select("staff_id")
          .eq("id", bookingId)
          .maybeSingle();
        if (bookingForNotify?.staff_id) {
          await supabase.functions.invoke("notify-groomer", {
            body: { booking_id: bookingId, notification_type: "new_booking" },
          });
        }
      } catch (notifyErr) {
        console.error("stripe-webhook: failed to notify groomer", notifyErr);
      }

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