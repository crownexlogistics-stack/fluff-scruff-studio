import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { applyRefundToBooking } from "../_shared/applyRefund.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Backfill: pulls recent Stripe refunds and records them on bookings. Staff only.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { data: c } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getClaims(token);
    const uid = c?.claims?.sub as string | undefined;
    if (!uid) throw new Error("Not authenticated");
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    if (!roles?.some((r: any) => ["director", "manager"].includes(r.role))) throw new Error("Not allowed");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const pis = new Set<string>();
    for await (const r of stripe.refunds.list({ limit: 100 })) {
      if (r.payment_intent) pis.add(typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent.id);
      if (pis.size > 300) break;
    }
    const results = [];
    for (const pi of pis) results.push({ pi, ...(await applyRefundToBooking(admin, stripe, pi)) });
    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
