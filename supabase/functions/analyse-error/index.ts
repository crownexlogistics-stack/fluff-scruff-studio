import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { error_id } = await req.json();
    if (!error_id) throw new Error("error_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: report, error: fetchErr } = await supabase
      .from("error_reports")
      .select("*")
      .eq("id", error_id)
      .single();

    if (fetchErr || !report) throw new Error("Error report not found");

    const userPrompt = `Explain this website error to a non-technical dog grooming salon owner:

Error: ${report.error_description}
Steps: ${report.steps_to_reproduce}
Page: ${report.page_url}
Browser: ${report.browser_info || "Unknown"}
Device: ${report.device_info || "Unknown"}

Keep plainEnglish under 2 sentences.
Keep fixInstruction simple and actionable.
lovablePrompt should be a ready-to-use prompt they can paste into Lovable to fix this specific error. Always include "Do not modify record-payment or cancel-booking-with-refund." at the end of the lovablePrompt.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for a dog grooming salon owner who is not technical. Explain website errors in simple plain English. Always respond using the suggest_analysis tool.`,
          },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_analysis",
              description: "Return the error analysis in structured format",
              parameters: {
                type: "object",
                properties: {
                  plainEnglish: { type: "string", description: "Simple 1-2 sentence explanation of what happened" },
                  impact: { type: "string", description: "Who was affected and how" },
                  severity: { type: "string", enum: ["low", "medium", "high"], description: "Error severity" },
                  fixInstruction: { type: "string", description: "Simple actionable fix instruction" },
                  lovablePrompt: { type: "string", description: "Ready-to-paste prompt for Lovable AI editor to fix the error" },
                },
                required: ["plainEnglish", "impact", "severity", "fixInstruction", "lovablePrompt"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save analysis to database
    const { error: updateErr } = await supabase
      .from("error_reports")
      .update({
        plain_english: analysis.plainEnglish,
        impact: analysis.impact,
        severity: analysis.severity,
        fix_instruction: analysis.fixInstruction,
        lovable_prompt: analysis.lovablePrompt,
        analysed_at: new Date().toISOString(),
      })
      .eq("id", error_id);

    if (updateErr) console.error("Failed to save analysis:", updateErr);

    // Send email for high severity errors
    if (analysis.severity === "high") {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
              reply_to: "info@fluffandscruff.co.uk",
              to: ["info@fluffandscruff.co.uk"],
              subject: "🚨 High priority error on your website needs attention",
              html: `
                <h2>🚨 High Priority Error Detected</h2>
                <p><strong>What happened:</strong> ${analysis.plainEnglish}</p>
                <p><strong>Page affected:</strong> ${report.page_url}</p>
                <p><strong>Impact:</strong> ${analysis.impact}</p>
                <p><strong>Time:</strong> ${new Date(report.created_at).toLocaleString("en-GB")}</p>
                <hr/>
                <p><strong>To fix this, copy the following into Lovable:</strong></p>
                <pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap;">${analysis.lovablePrompt}</pre>
                <br/>
                <p><a href="https://fluffandscruff.co.uk/admin/error-reports">View all errors →</a></p>
              `,
            }),
          });
        }
      } catch (emailErr) {
        console.error("Failed to send high-priority email:", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyse-error error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
