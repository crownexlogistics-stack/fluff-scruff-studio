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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");

    const userId = claimsData.claims.sub as string;

    // Check director role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "director")
      .maybeSingle();

    if (!roleData) throw new Error("Only directors can process refunds");

    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("Missing booking_id");

    // Get the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, stripe_payment_id, deposit_paid, total_price, customer_name, status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");
    if (!booking.stripe_payment_id) throw new Error("No Stripe payment found for this booking");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Process refund via Stripe
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_id,
    });

    // Update booking status
    await supabaseAdmin
      .from("bookings")
      .update({ status: "Refunded" })
      .eq("id", booking_id);

    // Log audit trail
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: "REFUND_PROCESSED",
        details: `Refunded £${(refund.amount / 100).toFixed(2)} for ${booking.customer_name}. Stripe Refund ID: ${refund.id}. Original Payment: ${booking.stripe_payment_id}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        amount: refund.amount / 100,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Refund error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
