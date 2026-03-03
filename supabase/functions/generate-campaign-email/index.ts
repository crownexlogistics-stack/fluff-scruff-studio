import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, bookingUrl, mode, currentHtml, editInstruction, imageBase64 } = await req.json();

    if (mode === "refine") {
      if (!currentHtml || !editInstruction) {
        return new Response(JSON.stringify({ error: "currentHtml and editInstruction are required for refine mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const refineSystem = `You are an expert email HTML editor for "Fluff & Scruff Studio", a premium dog grooming salon.

You will be given the current HTML of an email campaign and an edit instruction from the user. Apply the requested changes to the HTML and return the updated version.

Rules:
- Keep inline CSS only, max-width 600px
- Maintain the existing professional structure
- If the user asks to change colors, update ALL relevant inline styles consistently
- If the user provides an image, incorporate it as an <img> tag with proper styling (max-width:100%, centered)
- Keep the Book Now button and unsubscribe link intact
- Use web-safe fonts: Georgia for headings, Arial for body

You MUST return ONLY a valid JSON object (no markdown, no code fences) with exactly these keys:
- "subject": The subject line (keep existing unless asked to change)
- "previewText": The preview text (keep existing unless asked to change)  
- "html": The complete updated HTML email body`;

      const userContent: any[] = [
        { type: "text", text: `Current HTML email:\n\n${currentHtml}\n\nEdit instruction: ${editInstruction}` },
      ];

      if (imageBase64) {
        userContent.push({
          type: "image_url",
          image_url: { url: imageBase64 },
        });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: refineSystem },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        throw new Error("AI refinement failed");
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "";
      let cleaned = raw.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }

      let result;
      try {
        result = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI refine response:", cleaned.substring(0, 500));
        throw new Error("AI returned invalid format. Please try again.");
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GENERATE MODE (original) ===
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert email marketing designer for "Fluff & Scruff Studio", a premium dog grooming salon in Hornchurch, Essex, UK.

When given a campaign brief, you MUST return ONLY a valid JSON object (no markdown, no code fences) with exactly these keys:
- "subject": A catchy, compelling email subject line (max 60 chars)
- "previewText": A short preview/preheader text (max 100 chars)
- "html": The complete HTML email body

The HTML email MUST follow this professional structure:
1. Use inline CSS only (no external stylesheets)
2. Max width 600px, centered, with a clean white background
3. Include these sections in order:
   a. HEADER: Salon name "Fluff & Scruff Studio" in a styled banner with background color #2D3142 and white text
   b. HERO IMAGE: Use a placeholder with style "background:#E8D5B7;height:250px;display:flex;align-items:center;justify-content:center;" and a large paw emoji (🐾) with descriptive text about the campaign theme
   c. HEADLINE: Bold, compelling headline related to the campaign
   d. BODY TEXT: 2-3 short paragraphs of persuasive marketing copy. Warm, friendly tone. Reference dogs and grooming naturally.
   e. CTA BUTTON: A prominent "Book Now" button linking to ${bookingUrl || "https://fluff-scruff-studio.lovable.app/book"} — styled with background #2D3142, white text, rounded corners, large padding
   f. FOOTER: Salon address "138 Hillview Avenue, Hornchurch RM11 2DL", landline phone 01708 606655 (always show this first), WhatsApp/mobile +44 7476 452782, and an unsubscribe link placeholder {{UNSUBSCRIBE_URL}}

4. Use a warm, professional color palette: primary #2D3142, accent #E8D5B7, text #333333
5. Use web-safe fonts: Georgia for headings, Arial for body
6. Make it mobile-responsive with fluid widths
7. Include proper alt text for accessibility
8. The landline 01708 606655 must ALWAYS be displayed as the primary contact number

CRITICAL: Return ONLY the JSON object. No explanations, no markdown formatting.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a marketing email campaign for: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned.substring(0, 500));
      throw new Error("AI returned invalid format. Please try again.");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
