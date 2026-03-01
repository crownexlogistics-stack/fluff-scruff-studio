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

    const now = new Date();
    const results: string[] = [];

    // Find bookings needing 24h reminder (between 23-25 hours from now)
    const h24From = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const h24To = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Find bookings needing 2h reminder (between 1.5-2.5 hours from now)
    const h2From = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const h2To = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    // Get all confirmed bookings with email
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, booking_date, booking_time, customer_email, status")
      .not("customer_email", "is", null)
      .in("status", ["Confirmed", "Pending"]);

    if (error) throw error;

    for (const b of bookings || []) {
      const bookingDateTime = new Date(`${b.booking_date}T${b.booking_time}`);

      let emailType: string | null = null;
      if (bookingDateTime >= h24From && bookingDateTime <= h24To) {
        emailType = "reminder_24h";
      } else if (bookingDateTime >= h2From && bookingDateTime <= h2To) {
        emailType = "reminder_2h";
      }

      if (!emailType) continue;

      // Check if already sent
      const { data: existing } = await supabase
        .from("booking_emails")
        .select("id")
        .eq("booking_id", b.id)
        .eq("email_type", emailType)
        .maybeSingle();

      if (existing) continue;

      // Call send-booking-email
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-booking-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ booking_id: b.id, email_type: emailType }),
      });

      const sendData = await sendRes.json();
      results.push(`${b.id}: ${emailType} -> ${sendData.success ? "sent" : sendData.error || "failed"}`);
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, details: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
