import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();
    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("total_price, deposit_paid, final_charge")
      .eq("id", booking_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const depositPaid = Number(booking.deposit_paid) || 0;
    const totalPrice = Number(booking.total_price) || 0;
    const balanceDue = totalPrice - depositPaid;
    const reported = Number(booking.final_charge) || 0;
    const diff = reported - balanceDue;
    const diffPercent = balanceDue > 0 ? Math.abs(diff / balanceDue) * 100 : 0;

    let anomalyType: string | null = null;

    if (balanceDue > 0 && reported === 0) {
      anomalyType = "zero_when_balance_due";
    } else if (diff < -2) {
      anomalyType = "undercharged";
    } else if (diff > 2) {
      anomalyType = "overcharged";
    }

    if (diffPercent > 20 && Math.abs(diff) > 5) {
      anomalyType = "large_discrepancy";
    }

    const isAnomaly = anomalyType !== null;

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        payment_anomaly: isAnomaly,
        anomaly_type: anomalyType,
      })
      .eq("id", booking_id);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        anomaly: isAnomaly,
        type: anomalyType,
        diff,
        balanceDue,
        reported,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
