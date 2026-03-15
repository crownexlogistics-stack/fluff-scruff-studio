import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPT_OUT_KEYWORDS = ["stop", "stop all", "unsubscribe", "cancel", "end", "quit"];

function normalizePhone(raw: string): string {
  let phone = raw.trim().replace(/\s+/g, "").replace(/-/g, "");
  if (phone.startsWith("+440")) phone = "+44" + phone.slice(4);
  if (phone.startsWith("07")) phone = "+44" + phone.slice(1);
  else if (phone.startsWith("7") && phone.length === 10) phone = "+44" + phone;
  else if (phone.startsWith("447") && !phone.startsWith("+")) phone = "+" + phone;
  return phone;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.text();
    const params = new URLSearchParams(formData);

    const from = params.get("From") || "";
    const body = (params.get("Body") || "").trim().toLowerCase();
    const messageSid = params.get("MessageSid") || "";

    console.log(`Incoming SMS: from=${from}, body="${body}", sid=${messageSid}`);

    // Check if it's an opt-out keyword
    if (OPT_OUT_KEYWORDS.includes(body)) {
      const normalized = normalizePhone(from);
      const last10 = normalized.replace("+44", "").slice(-10);

      // Find and update migrated_customers by phone
      const { data: matches } = await supabase
        .from("migrated_customers")
        .select("id, phone, email")
        .or(`phone.ilike.%${last10}`);

      let updated = 0;
      for (const mc of (matches || [])) {
        await supabase
          .from("migrated_customers")
          .update({ sms_opt_out: true, sms_opt_out_at: new Date().toISOString() })
          .eq("id", mc.id);
        updated++;

        // Also opt out of email marketing if they have an email
        if (mc.email) {
          await supabase
            .from("email_unsubscribes")
            .upsert({ email: mc.email.toLowerCase().trim() }, { onConflict: "email" });
        }
      }

      console.log(`Opt-out processed for ${from}: ${updated} customer(s) updated`);
    }

    // Twilio expects TwiML response
    return new Response("<Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response("<Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
