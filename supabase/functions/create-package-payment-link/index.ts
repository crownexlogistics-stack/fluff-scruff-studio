import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Creates a Stripe Checkout Session to collect the outstanding balance on an
// EXISTING package_bookings row. The stripe-webhook processes the resulting
// checkout.session.completed and writes amount_received / paid_at back onto
// the package_bookings row (metadata.type = "package_topup").
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { package_booking_id, amount } = await req.json();
    if (!package_booking_id) throw new Error("Missing package_booking_id");

    const { data: pb, error: pbErr } = await supabase
      .from("package_bookings")
      .select("id, customer_email, customer_name, dog_name, total_paid, amount_received, packages(name)")
      .eq("id", package_booking_id)
      .single();

    if (pbErr || !pb) throw new Error("Package booking not found");

    const balanceDue = Number(pb.total_paid) - Number(pb.amount_received || 0);
    const requested = amount != null ? Number(amount) : balanceDue;
    if (!(requested > 0)) throw new Error("Nothing to charge — package is already paid.");

    const amountInPence = Math.round(requested * 100);
    if (amountInPence < 30) throw new Error("Amount too small");

    // Reuse existing Stripe customer if we have one
    let customerId: string | undefined;
    if (pb.customer_email) {
      const list = await stripe.customers.list({ email: pb.customer_email, limit: 1 });
      if (list.data.length > 0) customerId = list.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://fluffandscruff.co.uk";
    const packageName = (pb as any).packages?.name || "Package";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : pb.customer_email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${packageName} — Balance`,
              description: pb.dog_name ? `For ${pb.dog_name}` : undefined,
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/package-booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        type: "package_topup",
        package_booking_id: pb.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("create-package-payment-link error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});