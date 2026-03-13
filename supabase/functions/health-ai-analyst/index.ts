import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleData || !["director", "manager"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Unauthorized — admin access required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { healthResults } = await req.json();
    if (!healthResults) {
      return new Response(JSON.stringify({ error: "Missing healthResults" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a technical analyst for Fluff & Scruff Studio, a dog grooming salon. You have full visibility of the system health check results. Write for a non-technical business owner. For every issue provide an exact Lovable prompt to fix it. Always start fix prompts with: IMPORTANT: Do not change any working features, payment logic, Stripe functions, record-payment edge function, cancel-booking-with-refund edge function, or visual design. Fix only:

You must respond with ONLY valid JSON in this exact format, no markdown or code blocks:
{
  "summary": "A 2-3 sentence plain English summary of overall system health for a non-technical business owner.",
  "issues": [
    {
      "name": "Name of the failing check",
      "plain_english": "What is broken in plain English",
      "business_impact": "Why it matters to the business - what stops working for customers or staff",
      "lovable_prompt": "The exact Lovable prompt to fix this issue, starting with the IMPORTANT prefix above",
      "priority": 1
    }
  ]
}

Priority is a number where 1 is most urgent. Rank by business impact, not technical severity. If everything is passing, return an empty issues array and a positive summary. Only include genuinely failing checks in the issues array — do not include passing checks as issues.`;

    const userPrompt = `Here are the full system health check results for Fluff & Scruff Studio. Analyse them and provide your assessment:\n\n${JSON.stringify(healthResults, null, 2)}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: `AI analysis failed (${anthropicRes.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || "";

    // Parse the JSON from Claude's response
    let analysis;
    try {
      // Try to extract JSON if wrapped in code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      analysis = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis", raw: rawText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sort issues by priority
    if (analysis.issues) {
      analysis.issues.sort((a: any, b: any) => (a.priority || 99) - (b.priority || 99));
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("health-ai-analyst error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
