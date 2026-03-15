import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Twilio sends form-encoded POST
    const formData = await req.text();
    const params = new URLSearchParams(formData);

    const messageSid = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus");
    const to = params.get("To");
    const errorCode = params.get("ErrorCode");

    console.log(`Twilio status callback: SID=${messageSid}, status=${messageStatus}, to=${to}, errorCode=${errorCode}`);

    if (!messageSid || !messageStatus) {
      return new Response("Missing required fields", { status: 400, headers: corsHeaders });
    }

    // Map Twilio statuses
    const statusMap: Record<string, string> = {
      queued: "queued",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
    };
    const deliveryStatus = statusMap[messageStatus] || messageStatus;

    // Update by twilio_message_sid
    const { error } = await supabase
      .from("bulk_sms_log")
      .update({
        delivery_status: deliveryStatus,
        delivery_updated_at: new Date().toISOString(),
        error_code: errorCode || null,
      })
      .eq("twilio_message_sid", messageSid);

    if (error) {
      console.error("Failed to update bulk_sms_log:", error);
    }

    // If failed/undelivered, check if this phone has 3+ failures across campaigns
    if (deliveryStatus === "failed" || deliveryStatus === "undelivered") {
      const phone = to || "";
      if (phone) {
        const { count } = await supabase
          .from("bulk_sms_log")
          .select("id", { count: "exact", head: true })
          .eq("phone", phone)
          .in("delivery_status", ["failed", "undelivered"]);

        if (count && count >= 3) {
          // Flag as unreachable in migrated_customers
          await supabase
            .from("migrated_customers")
            .update({ sms_unreachable: true })
            .ilike("phone", `%${phone.replace("+44", "").slice(-10)}`);

          console.log(`Flagged ${phone} as sms_unreachable (${count} failures)`);
        }
      }
    }

    // Twilio expects a 200 or 204
    return new Response("<Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
