import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { breed_name, breed_id } = await req.json();
    if (!breed_name || !breed_id) throw new Error("breed_name and breed_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("breed_advice_cache")
      .select("*")
      .eq("breed_id", breed_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({ topics: cached.topics, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new advice via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a friendly, expert dog care advisor. Generate exactly 3 daily advice topics for a specific dog breed. Each topic should be practical, engaging, and breed-specific. Return a JSON array of 3 objects with fields: "icon" (single emoji), "title" (short catchy title, max 8 words), "content" (2-3 sentences of helpful advice). Cover different areas: health/nutrition, grooming/care, exercise/behaviour, fun facts/tips. Keep the tone warm and conversational.`
          },
          {
            role: "user",
            content: `Generate 3 daily advice topics specifically for a ${breed_name} dog breed. Make them practical and breed-specific.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_advice_topics",
              description: "Return 3 breed-specific advice topics",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        icon: { type: "string", description: "Single emoji" },
                        title: { type: "string" },
                        content: { type: "string" }
                      },
                      required: ["icon", "title", "content"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["topics"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_advice_topics" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let topics = [];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      topics = parsed.topics || [];
    }

    if (topics.length === 0) {
      // Fallback topics
      topics = [
        { icon: "🐾", title: `${breed_name} Care Tip`, content: `Keep your ${breed_name} happy with regular exercise and mental stimulation. Every breed has unique needs!` },
        { icon: "🦴", title: "Nutrition Matters", content: `A balanced diet is key for your ${breed_name}. Consult your vet about the best food choices for this breed.` },
        { icon: "✨", title: "Grooming Love", content: `Regular grooming keeps your ${breed_name} looking and feeling great. Book a professional groom for the best results!` },
      ];
    }

    // Cache the result
    // Delete old cache for this breed first
    await supabase.from("breed_advice_cache").delete().eq("breed_id", breed_id);
    await supabase.from("breed_advice_cache").insert({
      breed_id,
      topics,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify({ topics, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-breed-advice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
