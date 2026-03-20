import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "director") {
      return new Response(JSON.stringify({ error: "Director access only" }), { status: 403, headers: corsHeaders });
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    // Parse optional filters
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 100);
    const startingAfter = url.searchParams.get("starting_after") || undefined;
    const createdGte = url.searchParams.get("created_gte") ? parseInt(url.searchParams.get("created_gte")!) : undefined;
    const createdLte = url.searchParams.get("created_lte") ? parseInt(url.searchParams.get("created_lte")!) : undefined;

    const created: any = {};
    if (createdGte) created.gte = createdGte;
    if (createdLte) created.lte = createdLte;

    // Fetch payment intents and payouts in parallel
    const [paymentIntents, payouts, bookingsWithStripe] = await Promise.all([
      stripe.paymentIntents.list({
        limit,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        ...(Object.keys(created).length > 0 ? { created } : {}),
        expand: ["data.latest_charge"],
      }),
      stripe.payouts.list({ limit: 20 }),
      supabaseAdmin
        .from("bookings")
        .select("stripe_payment_id")
        .not("stripe_payment_id", "is", null),
    ]);

    const matchedIds = new Set(
      (bookingsWithStripe.data || []).map((b: any) => b.stripe_payment_id).filter(Boolean)
    );

    const transactions = paymentIntents.data.map((pi: any) => {
      const charge = pi.latest_charge;
      const paymentMethod = charge?.payment_method_details;
      let methodLabel = "Unknown";
      if (paymentMethod?.type === "card") {
        methodLabel = `Card •••• ${paymentMethod.card?.last4 || "????"}`;
      } else if (paymentMethod?.type === "link") {
        methodLabel = "Link";
      } else if (paymentMethod?.type) {
        methodLabel = paymentMethod.type;
      }

      let status = pi.status;
      if (status === "succeeded" && charge?.refunded) status = "refunded";
      else if (status === "succeeded" && (charge?.amount_refunded || 0) > 0) status = "partially_refunded";

      return {
        id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency,
        status,
        created: pi.created,
        customer_email: charge?.billing_details?.email || pi.receipt_email || pi.metadata?.customer_email || null,
        payment_method: methodLabel,
        description: pi.description,
        metadata: pi.metadata,
        matched: matchedIds.has(pi.id),
      };
    });

    const payoutsList = payouts.data.map((p: any) => ({
      id: p.id,
      amount: p.amount / 100,
      currency: p.currency,
      status: p.status,
      arrival_date: p.arrival_date,
      created: p.created,
      method: p.method,
      destination: p.destination,
    }));

    return new Response(
      JSON.stringify({ transactions, payouts: payoutsList, has_more: paymentIntents.has_more }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get-stripe-transactions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
