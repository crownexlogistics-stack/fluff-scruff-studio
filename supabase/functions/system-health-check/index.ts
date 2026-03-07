import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Not authenticated");

    // Check role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (!roleData || !["director", "manager"].includes(roleData.role)) {
      throw new Error("Unauthorized — admin access required");
    }

    const results: Record<string, any> = {};

    // 1. Check secrets exist
    const secretChecks = {
      SENDGRID_API_KEY: !!Deno.env.get("SENDGRID_API_KEY"),
      STRIPE_SECRET_KEY: !!Deno.env.get("STRIPE_SECRET_KEY"),
      TWILIO_ACCOUNT_SID: !!Deno.env.get("TWILIO_ACCOUNT_SID"),
      TWILIO_AUTH_TOKEN: !!Deno.env.get("TWILIO_AUTH_TOKEN"),
      TWILIO_PHONE_NUMBER: !!Deno.env.get("TWILIO_PHONE_NUMBER"),
      SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    };
    results.secrets = secretChecks;

    // 2. Test Stripe connection
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        const start = Date.now();
        const res = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const elapsed = Date.now() - start;
        const body = await res.json();
        results.stripe = {
          status: res.ok ? "pass" : "fail",
          responseTime: elapsed,
          error: res.ok ? null : body.error?.message,
        };
      } catch (e) {
        results.stripe = { status: "fail", error: e.message };
      }
    } else {
      results.stripe = { status: "fail", error: "STRIPE_SECRET_KEY not configured" };
    }

    // 3. Test Twilio (just verify credentials, don't send SMS)
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioSid && twilioAuth) {
      try {
        const start = Date.now();
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
          headers: {
            Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
          },
        });
        const elapsed = Date.now() - start;
        const body = await res.json();
        results.twilio = {
          status: res.ok ? "pass" : "fail",
          responseTime: elapsed,
          error: res.ok ? null : (body.message || "Auth failed"),
        };
      } catch (e) {
        results.twilio = { status: "fail", error: e.message };
      }
    } else {
      results.twilio = { status: "fail", error: "Twilio credentials not configured" };
    }

    // 4. Test SendGrid (verify API key)
    const sgKey = Deno.env.get("SENDGRID_API_KEY");
    if (sgKey) {
      try {
        const start = Date.now();
        const res = await fetch("https://api.sendgrid.com/v3/user/credits", {
          headers: { Authorization: `Bearer ${sgKey}` },
        });
        const elapsed = Date.now() - start;
        results.sendgrid = {
          status: res.ok ? "pass" : "fail",
          responseTime: elapsed,
          error: res.ok ? null : "API key validation failed",
        };
        await res.text(); // consume body
      } catch (e) {
        results.sendgrid = { status: "fail", error: e.message };
      }
    } else {
      results.sendgrid = { status: "fail", error: "SENDGRID_API_KEY not configured" };
    }

    // 5. Check storage buckets
    const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
    results.storage = {
      status: bucketErr ? "fail" : "pass",
      buckets: buckets?.map((b: any) => b.name) || [],
      error: bucketErr?.message || null,
    };

    // 6. Table row counts
    const tables = [
      "bookings", "profiles", "customer_pets", "services", "staff",
      "sms_messages", "coupons", "breeds", "add_ons", "error_reports",
    ];
    const tableCounts: Record<string, any> = {};
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        tableCounts[table] = {
          status: error ? "fail" : "pass",
          count: count ?? 0,
          error: error?.message || null,
        };
      } catch (e) {
        tableCounts[table] = { status: "fail", count: 0, error: e.message };
      }
    }
    results.tables = tableCounts;

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message.includes("authenticated") || error.message.includes("Unauthorized") ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
