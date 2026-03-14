import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

    const {
      customer_name,
      customer_email,
      dog_name,
      service_name,
      total_price,
      booking_id,
      payment_type, // "deposit" or "full"
    } = await req.json();

    if (!total_price || !booking_id) {
      throw new Error("Missing required fields: total_price and booking_id");
    }

    const isFullPayment = payment_type === "full";
    const paymentAmount = isFullPayment
      ? Math.round(total_price * 100)
      : Math.round(total_price * 0.6 * 100);

    if (paymentAmount < 30) {
      throw new Error("Payment amount too small for Stripe (minimum 30p)");
    }

    // Check if customer already exists in Stripe
    let customerId: string | undefined;
    if (customer_email) {
      const customers = await stripe.customers.list({
        email: customer_email,
        limit: 1,
      });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "https://fluffandscruff.co.uk";

    const label = isFullPayment
      ? `Full Payment — ${service_name || "Dog Grooming"}`
      : `Deposit — ${service_name || "Dog Grooming"}`;

    const description = isFullPayment
      ? `Full payment for ${dog_name || "your pup"}'s appointment`
      : `60% deposit for ${dog_name || "your pup"}'s appointment`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customer_email || undefined,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: label,
              description,
            },
            unit_amount: paymentAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/booking-success?booking_id=${booking_id}&payment_type=${payment_type || "deposit"}`,
      cancel_url: `${origin}/book?deposit_cancelled=true&booking_id=${booking_id}`,
      metadata: {
        booking_id,
        customer_name: customer_name || "",
        dog_name: dog_name || "",
        total_price: String(total_price),
        payment_type: payment_type || "deposit",
        payment_amount: String(paymentAmount / 100),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating checkout:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
