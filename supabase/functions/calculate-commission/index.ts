import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { total_price, is_groomers_own_customer } = await req.json();

    if (typeof total_price !== "number" || total_price < 0) {
      return new Response(
        JSON.stringify({ error: "total_price must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Commission logic:
    // Groomer's own customer: 50% of total
    // Studio customer: 40% of total
    const commission_rate = is_groomers_own_customer ? 0.5 : 0.4;
    const groomer_pay = Math.round(total_price * commission_rate * 100) / 100;
    const studio_share = Math.round((total_price - groomer_pay) * 100) / 100;
    const deposit = Math.round(total_price * 0.6 * 100) / 100;

    return new Response(
      JSON.stringify({
        total_price,
        is_groomers_own_customer,
        commission_rate: `${commission_rate * 100}%`,
        groomer_pay,
        studio_share,
        deposit_amount: deposit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
