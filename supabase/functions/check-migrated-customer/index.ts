import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, action, password, full_name } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const normalizedEmail = email.trim().toLowerCase();

    // Action: "check" — just check if email exists in migrated_customers
    if (!action || action === "check") {
      const { data: migrated, error: mErr } = await supabase
        .from("migrated_customers")
        .select("id, full_name, status, supabase_user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (mErr) throw mErr;

      if (!migrated) {
        return new Response(
          JSON.stringify({ found: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if they already have an active auth account
      if (migrated.supabase_user_id && (migrated.status === "activated" || migrated.status === "self_registered")) {
        return new Response(
          JSON.stringify({ found: true, status: "already_active", name: migrated.full_name }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ found: true, status: "pending", name: migrated.full_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // "activate" was removed: it let anyone set a password on an account by email.
    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-migrated-customer error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
