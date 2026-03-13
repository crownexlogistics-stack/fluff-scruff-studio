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

    const { roughMessage } = await req.json();
    if (!roughMessage?.trim()) throw new Error("No message provided");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: "You are a professional assistant for Fluff & Scruff Studio, a dog grooming salon in Hornchurch, Essex. Rewrite the groomer's rough message into a short, friendly, professional SMS to a customer. Keep it warm and personal. Always sign off as 'Fluff & Scruff Team'. Maximum 4 sentences. No emojis unless the groomer included one. Do not add any information that was not in the original message. Reply with the SMS text only — no explanation, no quotes.",
        messages: [{ role: "user", content: roughMessage.trim() }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", response.status, err);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const generatedText = data.content?.[0]?.text || "";

    return new Response(JSON.stringify({ message: generatedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sms-message error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
