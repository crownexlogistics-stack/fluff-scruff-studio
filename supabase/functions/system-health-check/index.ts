import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  console.log("health-check started");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, any> = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Check secrets exist
    try {
      results.secrets = {
        RESEND_API_KEY: !!Deno.env.get("RESEND_API_KEY"),
        STRIPE_SECRET_KEY: !!Deno.env.get("STRIPE_SECRET_KEY"),
        TWILIO_ACCOUNT_SID: !!Deno.env.get("TWILIO_ACCOUNT_SID"),
        TWILIO_AUTH_TOKEN: !!Deno.env.get("TWILIO_AUTH_TOKEN"),
        TWILIO_PHONE_NUMBER: !!Deno.env.get("TWILIO_PHONE_NUMBER"),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      };
    } catch (e) {
      results.secrets = { error: e.message };
    }

    // 2. Test Stripe connection
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        results.stripe = { status: "fail", error: "STRIPE_SECRET_KEY not configured" };
      } else {
        const start = Date.now();
        const res = await withTimeout(
          fetch("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${stripeKey}` },
          }),
          5000
        );
        const elapsed = Date.now() - start;
        const body = await res.json();
        results.stripe = {
          status: res.ok ? "pass" : "fail",
          responseTime: elapsed,
          error: res.ok ? null : body.error?.message,
        };
      }
    } catch (e) {
      results.stripe = { status: "fail", error: e.message };
    }

    // 3. Test Twilio
    try {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (!twilioSid || !twilioAuth) {
        results.twilio = { status: "fail", error: "Twilio credentials not configured" };
      } else {
        const start = Date.now();
        const res = await withTimeout(
          fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
            headers: {
              Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
            },
          }),
          5000
        );
        const elapsed = Date.now() - start;
        const body = await res.json();
        results.twilio = {
          status: res.ok ? "pass" : "fail",
          responseTime: elapsed,
          error: res.ok ? null : (body.message || "Auth failed"),
        };
      }
    } catch (e) {
      results.twilio = { status: "fail", error: e.message };
    }

    // 4. Test Resend (email provider)
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        results.resend = { status: "fail", error: "RESEND_API_KEY not configured" };
      } else {
        const start = Date.now();
        const res = await withTimeout(
          fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${resendKey}` },
          }),
          5000
        );
        const elapsed = Date.now() - start;
        await res.text(); // consume body
        results.resend = {
          status: res.ok ? "pass" : "fail",
          responseTime: elapsed,
          error: res.ok ? null : "API key validation failed",
        };
      }
    } catch (e) {
      results.resend = { status: "fail", error: e.message };
    }

    // 5. Check storage buckets
    try {
      const { data: buckets, error: bucketErr } = await withTimeout(
        supabase.storage.listBuckets(),
        5000
      );
      results.storage = {
        status: bucketErr ? "fail" : "pass",
        buckets: buckets?.map((b: any) => b.name) || [],
        error: bucketErr?.message || null,
      };
    } catch (e) {
      results.storage = { status: "fail", buckets: [], error: e.message };
    }

    // 6. Table row counts — each independent
    const tables = [
      "bookings", "profiles", "customer_pets", "services", "staff",
      "sms_messages", "coupons", "breeds", "add_ons", "error_reports",
    ];
    const tableCounts: Record<string, any> = {};
    await Promise.all(
      tables.map(async (table) => {
        try {
          const { count, error } = await withTimeout(
            supabase.from(table).select("id", { count: "exact", head: true }),
            5000
          );
          tableCounts[table] = {
            status: error ? "fail" : "pass",
            count: count ?? 0,
            error: error?.message || null,
          };
        } catch (e) {
          tableCounts[table] = { status: "fail", count: 0, error: e.message };
        }
      })
    );
    results.tables = tableCounts;

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Absolute last resort — should never reach here now
    console.error("Health check fatal error:", error);
    return new Response(JSON.stringify({ error: error.message, ...results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
