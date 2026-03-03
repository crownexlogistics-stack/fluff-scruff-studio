import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let rawFrom = "";
    let body = "";
    let sid = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio sends form-encoded data
      const formData = await req.formData();
      rawFrom = (formData.get("From") as string) || "";
      body = (formData.get("Body") as string) || "";
      sid = (formData.get("MessageSid") as string) || "";
    } else {
      const json = await req.json();
      rawFrom = json.From || json.from || "";
      body = json.Body || json.body || "";
      sid = json.MessageSid || json.sid || "";
    }

    // Normalize E.164 UK numbers (+44...) to local format (0...) to match bookings
    let from = rawFrom;
    if (from.startsWith("+44")) {
      from = "0" + from.slice(3);
    }

    if (!from || !body) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Find most recent booking for this phone number to link the message
    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("customer_phone", from)
      .order("booking_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("sms_messages").insert({
      phone_number: from,
      body,
      direction: "inbound",
      status: "received",
      twilio_sid: sid || null,
      booking_id: booking?.id || null,
    });

    console.log(`Inbound SMS from ${from}: ${body.slice(0, 50)}...`);

    // Return empty TwiML response (Twilio expects XML)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("Error processing inbound SMS:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
