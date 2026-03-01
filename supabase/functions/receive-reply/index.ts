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

    const payload = await req.json();

    // Resend webhook payload for inbound emails
    const fromEmail = payload.from || payload.sender || "";
    const fromName = payload.from_name || payload.sender_name || fromEmail;
    const subject = payload.subject || "(no subject)";
    const body = payload.text || payload.html || payload.body || "";

    // Try to match to a booking by sender email
    let bookingId: string | null = null;
    if (fromEmail) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("id")
        .eq("customer_email", fromEmail)
        .order("booking_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (booking) bookingId = booking.id;
    }

    const { error } = await supabase.from("customer_messages").insert({
      booking_id: bookingId,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      body,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
