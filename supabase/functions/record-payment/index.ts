import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("Missing booking_id");

    // Find the Stripe checkout session by booking_id in metadata
    const sessions = await stripe.checkout.sessions.list({
      limit: 5,
    });

    let paymentIntentId: string | null = null;

    for (const session of sessions.data) {
      if (session.metadata?.booking_id === booking_id && session.payment_intent) {
        paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent.id;
        break;
      }
    }

    if (!paymentIntentId) {
      // Try searching more sessions
      const allSessions = await stripe.checkout.sessions.list({ limit: 50 });
      for (const session of allSessions.data) {
        if (session.metadata?.booking_id === booking_id && session.payment_intent) {
          paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id;
          break;
        }
      }
    }

    if (paymentIntentId) {
      // Retrieve the actual amount paid from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const amountPaid = paymentIntent.amount_received / 100; // Convert pence to pounds

      // Get current booking to check total
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("customer_name, total_price, status")
        .eq("id", booking_id)
        .single();

      const total = booking ? Number(booking.total_price) : 0;
      const newStatus = amountPaid >= total && total > 0 ? "Confirmed" : "Confirmed";

      // Save the payment intent ID AND the actual deposit amount
      await supabaseAdmin
        .from("bookings")
        .update({
          stripe_payment_id: paymentIntentId,
          deposit_paid: amountPaid,
          status: newStatus,
        })
        .eq("id", booking_id);

      if (booking) {
        await supabaseAdmin.from("audit_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          action: "PAYMENT_RECORDED",
          details: `Payment of £${amountPaid.toFixed(2)} recorded for ${booking.customer_name}. Total: £${total.toFixed(2)}. Stripe Payment Intent: ${paymentIntentId}`,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, payment_intent_id: paymentIntentId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error recording payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
