import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const { forecastData } = await req.json();

    if (!forecastData) {
      throw new Error("No forecast data provided");
    }

    const financeContext = {
      month: forecastData.month,
      total_appointments: forecastData.total_appointments,
      earned_so_far: `£${forecastData.earned_so_far.toLocaleString()}`,
      confirmed_upcoming: `£${forecastData.confirmed_upcoming.toLocaleString()}`,
      total_projected_income: `£${forecastData.total_projected_income.toLocaleString()}`,
      groomer_pay_paid: `£${forecastData.groomer_pay_paid.toLocaleString()}`,
      groomer_pay_upcoming: `£${forecastData.groomer_pay_upcoming.toLocaleString()}`,
      bills_paid: `£${forecastData.bills_paid.toLocaleString()}`,
      bills_still_to_pay: `£${forecastData.bills_still_to_pay.toLocaleString()}`,
      total_projected_costs: `£${forecastData.total_projected_costs.toLocaleString()}`,
      projected_result: forecastData.projected_result >= 0
        ? `£${forecastData.projected_result.toLocaleString()} profit`
        : `-£${Math.abs(forecastData.projected_result).toLocaleString()} loss`,
      breakeven_gap: forecastData.breakeven_gap > 0
        ? `£${forecastData.breakeven_gap.toLocaleString()} needed to break even`
        : "Break even reached",
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a calm, reassuring financial advisor for a small dog grooming salon.

IMPORTANT CONTEXT YOU MUST UNDERSTAND:
This salon is mid-month. The 'earned so far' figure only reflects the first part of the month. The 'confirmed upcoming' figure shows real booked appointments still to come. Always explain the numbers in this context.

Do not compare earned-so-far against total costs — that is like comparing half a month's income against a full month's costs and will always look terrible and misleading.

ALWAYS explain:
- Total projected income for the month
- Total projected costs for the month
- Whether the FULL MONTH projection is profitable or not
- What the gap is if making a loss
- One practical suggestion

Be honest but calm. Never use dramatic language like 'concerning' or 'not sustainable' unless the numbers are genuinely catastrophic. A small projected loss on decent revenue mid-month with bookings still to come is not a crisis — explain it proportionately.

Maximum 4-5 sentences.
No bullet points.
End with ONE specific actionable tip.`,
        messages: [
          {
            role: "user",
            content: `Please explain this month's finances for my salon:\n${JSON.stringify(financeContext, null, 2)}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      throw new Error("AI unavailable");
    }

    const anthropicData = await anthropicRes.json();
    const explanation = anthropicData.content?.[0]?.text || "Unable to generate explanation.";

    return new Response(
      JSON.stringify({ text: explanation, generatedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("finance-explainer error:", error);
    return new Response(
      JSON.stringify({ error: "AI briefing unavailable right now — please try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
