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

    const { roughMessage, customerName } = await req.json();
    if (!roughMessage?.trim()) throw new Error("No message provided");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a professional assistant for Fluff & Scruff Studio, a dog grooming salon in Hornchurch, Essex. Rewrite the groomer's rough notes into a friendly, professional email to a customer. Keep it warm and personal. Sign off as "Fluff & Scruff Studio". Do not add any information that was not in the original message. Return a JSON object with two keys: "subject" (a concise email subject line) and "body" (the email body text). Return ONLY the JSON — no explanation, no code fences.`,
          },
          {
            role: "user",
            content: customerName
              ? `Customer name: ${customerName}\n\nRough notes: ${roughMessage.trim()}`
              : roughMessage.trim(),
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI gateway error:", response.status, err);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Parse JSON from the response, stripping code fences if present
    let subject = "";
    let body = "";
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      subject = parsed.subject || "";
      body = parsed.body || "";
    } catch {
      // Fallback: use entire text as body
      body = rawText;
    }

    return new Response(JSON.stringify({ subject, body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email-message error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
