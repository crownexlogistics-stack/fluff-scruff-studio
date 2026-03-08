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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Step 1: Get all migrated customers
    const { data: migrated, error: mErr } = await supabase
      .from("migrated_customers")
      .select("id, email, full_name, phone, supabase_user_id, profile_id")
      .not("email", "is", null);

    if (mErr) throw mErr;

    let linked = 0;
    let alreadyLinked = 0;
    const errors: string[] = [];

    for (const mc of migrated || []) {
      if (!mc.email) continue;

      // Already linked
      if (mc.profile_id) {
        alreadyLinked++;
        continue;
      }

      // Try to find a matching profile via auth user email
      if (mc.supabase_user_id) {
        // They have an auth account — profile should exist with that id
        const { error: linkErr } = await supabase
          .from("migrated_customers")
          .update({ profile_id: mc.supabase_user_id })
          .eq("id", mc.id);

        if (linkErr) {
          errors.push(`Failed to link ${mc.email}: ${linkErr.message}`);
        } else {
          linked++;
        }
        continue;
      }

      // No auth account — check if there's a profile by looking up auth user by email
      const { data: userId } = await supabase.rpc("get_user_id_by_email", {
        _email: mc.email,
      });

      if (userId) {
        const { error: linkErr } = await supabase
          .from("migrated_customers")
          .update({ profile_id: userId, supabase_user_id: userId })
          .eq("id", mc.id);

        if (linkErr) {
          errors.push(`Failed to link ${mc.email}: ${linkErr.message}`);
        } else {
          linked++;
        }
      }
      // If no auth user exists, we can't create a profile (profiles.id must match auth.users.id)
      // The customer will still be found via email-based search
    }

    return new Response(
      JSON.stringify({
        total: (migrated || []).length,
        linked,
        alreadyLinked,
        unlinked: (migrated || []).length - linked - alreadyLinked,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
