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
        JSON.stringify({ found: true, status: "pending", name: migrated.full_name, migrated_id: migrated.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: "activate" — create auth account and link to migrated customer
    if (action === "activate") {
      if (!password || password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Re-check migrated customer
      const { data: migrated, error: mErr } = await supabase
        .from("migrated_customers")
        .select("id, full_name, status, supabase_user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (mErr) throw mErr;

      if (!migrated) {
        return new Response(
          JSON.stringify({ error: "No migrated customer found with this email" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (migrated.supabase_user_id && (migrated.status === "activated" || migrated.status === "self_registered")) {
        return new Response(
          JSON.stringify({ error: "already_active", message: "This account is already active. Please sign in instead." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if auth user already exists with this email (e.g. from invite)
      const { data: existingUser } = await supabase.rpc("get_user_id_by_email", {
        _email: normalizedEmail,
      });

      let userId: string;

      if (existingUser) {
        // Auth user exists but migrated_customers not linked — update password and link
        const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser, {
          password,
          email_confirm: true,
        });
        if (updateErr) throw updateErr;
        userId = existingUser;
      } else {
        // Create new auth user
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || migrated.full_name || "" },
        });
        if (createErr) throw createErr;
        userId = newUser.user.id;
      }

      // Update migrated_customers record
      const { error: linkErr } = await supabase
        .from("migrated_customers")
        .update({
          supabase_user_id: userId,
          status: "self_registered",
          activated_at: new Date().toISOString(),
          profile_id: userId,
        })
        .eq("id", migrated.id);

      if (linkErr) throw linkErr;

      return new Response(
        JSON.stringify({ success: true, user_id: userId, name: migrated.full_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
