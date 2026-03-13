import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pay_link_id } = await req.json();
    if (!pay_link_id) throw new Error("pay_link_id required");

    // Get the record
    const { data: record, error: rErr } = await supabase
      .from("customer_pay_links")
      .select("*")
      .eq("id", pay_link_id)
      .single();
    if (rErr || !record) throw new Error("Pay link not found");

    // Already paid
    if (record.status === "paid") {
      return new Response(JSON.stringify({ status: "paid", paid_at: record.paid_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!record.stripe_payment_link_id) {
      return new Response(JSON.stringify({ status: record.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for completed checkout sessions using this payment link
    const sessions = await stripe.checkout.sessions.list({
      payment_link: record.stripe_payment_link_id,
      limit: 10,
    });

    const completedSession = sessions.data.find(
      (s) => s.payment_status === "paid" && s.status === "complete"
    );

    if (completedSession) {
      const paidAt = new Date().toISOString();
      await supabase
        .from("customer_pay_links")
        .update({ status: "paid", paid_at: paidAt })
        .eq("id", pay_link_id);

      return new Response(JSON.stringify({ status: "paid", paid_at: paidAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
