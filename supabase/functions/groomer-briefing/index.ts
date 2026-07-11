import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { groomerName, todayDate, appointmentCount, dogNames, noShowCount, cancelledCount, weekAppointments, careerTotal } = await req.json();

    const userPrompt = `Generate a morning briefing for this groomer:
- Groomer name: ${groomerName}
- Today's date: ${todayDate}
- Appointments today: ${appointmentCount}
- Dogs today: ${dogNames?.length ? dogNames.join(", ") : "none scheduled"}
- No-shows today: ${noShowCount || 0}
- Cancellations today: ${cancelledCount || 0}
- Upcoming appointments this week: ${weekAppointments || 0}
- Career total dogs groomed: ${careerTotal || 0}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a warm, encouraging assistant for a dog grooming salon called Fluff & Scruff Studio. Write a short personal morning briefing for the groomer. Maximum 4 sentences. Be warm, specific, and uplifting. Use the groomer's first name. Mention dog names if provided. Never invent information. If it's a busy day, give a heads up. If it's quiet, be encouraging. Include a dog emoji 🐾 once.\n\nIMPORTANT: Do NOT use 'welcome to your first day', 'welcome to the team', 'first day', or any new-starter language UNLESS the career total is exactly 0 AND there are appointments scheduled today (a genuine first shift). If career total is 0 with no appointments, just give a normal warm morning greeting — they may simply have no completed jobs logged yet. Default to treating the groomer as an experienced team member.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content || "Good morning! Have a great day at the salon. 🐾";

    return new Response(JSON.stringify({ briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("groomer-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
