import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyDirector(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
  const userId = claimsData.claims.sub;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleData?.role !== "director") throw new Error("Director access only");

  return supabaseAdmin;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = await verifyDirector(req);

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Detail fetch for a single payment intent
    if (action === "detail") {
      const piId = url.searchParams.get("payment_intent_id");
      if (!piId) throw new Error("payment_intent_id required");

      const [pi, charges] = await Promise.all([
        stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] }),
        stripe.charges.list({ payment_intent: piId, limit: 10 }),
      ]);

      const charge = charges.data[0];
      const pm = charge?.payment_method_details;

      // Check if matched to booking
      const { data: matchedBooking } = await supabaseAdmin
        .from("bookings")
        .select("id, customer_name, dog_name, booking_date, booking_time, status, total_price, deposit_paid, staff_id")
        .eq("stripe_payment_id", piId)
        .maybeSingle();

      let groomerName = null;
      if (matchedBooking?.staff_id) {
        const { data: staffData } = await supabaseAdmin
          .from("staff")
          .select("name")
          .eq("id", matchedBooking.staff_id)
          .maybeSingle();
        groomerName = staffData?.name;
      }

      const detail = {
        id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency,
        status: pi.status,
        created: pi.created,
        description: pi.description,
        metadata: pi.metadata,
        customer_email: charge?.billing_details?.email || pi.receipt_email || pi.metadata?.customer_email || null,
        customer_name: charge?.billing_details?.name || null,
        charge_id: charge?.id || null,
        payment_method: pm ? {
          type: pm.type,
          card: pm.type === "card" ? {
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            exp_month: pm.card?.exp_month,
            exp_year: pm.card?.exp_year,
            funding: pm.card?.funding,
            issuer: (pm.card as any)?.issuer,
            three_d_secure: (pm.card as any)?.three_d_secure?.result || null,
            cvc_check: pm.card?.checks?.cvc_check || null,
          } : null,
        } : null,
        fee: charge?.balance_transaction ? null : null, // Would need balance_transaction expand
        refunded: charge?.refunded || false,
        amount_refunded: (charge?.amount_refunded || 0) / 100,
        matched_booking: matchedBooking ? {
          ...matchedBooking,
          groomer_name: groomerName,
        } : null,
      };

      // Try to get fee from balance transaction
      if (charge?.balance_transaction && typeof charge.balance_transaction === "string") {
        try {
          const bt = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
          (detail as any).stripe_fee = bt.fee / 100;
          (detail as any).net_amount = bt.net / 100;
        } catch { /* ignore */ }
      }

      return new Response(JSON.stringify({ detail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: list transactions
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 100);
    const createdGte = url.searchParams.get("created_gte") ? parseInt(url.searchParams.get("created_gte")!) : undefined;
    const createdLte = url.searchParams.get("created_lte") ? parseInt(url.searchParams.get("created_lte")!) : undefined;

    const created: any = {};
    if (createdGte) created.gte = createdGte;
    if (createdLte) created.lte = createdLte;

    const [paymentIntents, payouts, bookingsWithStripe, packageBookingsWithStripe] = await Promise.all([
      stripe.paymentIntents.list({
        limit,
        ...(Object.keys(created).length > 0 ? { created } : {}),
        expand: ["data.latest_charge"],
      }),
      stripe.payouts.list({ limit: 20 }),
      supabaseAdmin
        .from("bookings")
        .select("stripe_payment_id")
        .not("stripe_payment_id", "is", null),
      supabaseAdmin
        .from("package_bookings")
        .select("stripe_payment_intent_id, customer_name, total_paid, sessions_total, packages(name)")
        .not("stripe_payment_intent_id", "is", null),
    ]);

    const matchedIds = new Set(
      (bookingsWithStripe.data || []).map((b: any) => b.stripe_payment_id).filter(Boolean)
    );
    const packageById = new Map<string, any>();
    for (const p of (packageBookingsWithStripe.data || []) as any[]) {
      if (p?.stripe_payment_intent_id) packageById.set(p.stripe_payment_intent_id, p);
    }

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

      const pkg = packageById.get(pi.id);
      const matched = matchedIds.has(pi.id) || !!pkg;

      return {
        id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency,
        status,
        created: pi.created,
        customer_email: charge?.billing_details?.email || pi.receipt_email || pi.metadata?.customer_email || null,
        customer_name: charge?.billing_details?.name || null,
        payment_method: methodLabel,
        description: pi.description,
        metadata: pi.metadata,
        matched,
        matched_package: pkg ? {
          customer_name: pkg.customer_name,
          total_paid: Number(pkg.total_paid || 0),
          sessions_total: pkg.sessions_total,
          package_name: pkg.packages?.name || "Package",
        } : null,
      };
    });

    const payoutsList = payouts.data.map((p: any) => ({
      id: p.id,
      amount: p.amount / 100,
      currency: p.currency,
      status: p.status,
      arrival_date: p.arrival_date,
      created: p.created,
    }));

    return new Response(
      JSON.stringify({ transactions, payouts: payoutsList, has_more: paymentIntents.has_more }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const status = (error as Error).message === "Unauthorized" || (error as Error).message === "Director access only" ? 403 : 500;
    console.error("get-stripe-transactions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
