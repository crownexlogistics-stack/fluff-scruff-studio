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
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const {
      package_id,
      customer_name,
      customer_email,
      customer_phone,
      dog_name,
      breed_id,
      sessions,
      total_price,
    } = await req.json();

    if (!package_id || !customer_email || !total_price || !sessions?.length) {
      throw new Error("Missing required fields");
    }

    const amountInPence = Math.round(Number(total_price) * 100);
    if (amountInPence < 30) throw new Error("Amount too small");

    // Check for existing Stripe customer
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://fluffandscruff.co.uk";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customer_email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Package Deal — ${dog_name || "Your Pup"}`,
              description: `${sessions.length} sessions prepaid`,
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/package-booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book-package`,
      metadata: {
        type: "package_booking",
        package_id,
        customer_name: customer_name || "",
        customer_email,
        customer_phone: customer_phone || "",
        dog_name: dog_name || "",
        breed_id: breed_id || "",
        sessions_json: JSON.stringify(sessions),
        total_price: String(total_price),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("create-package-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
