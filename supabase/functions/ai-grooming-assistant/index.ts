import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Scruff, the friendly AI assistant for Fluff & Scruff Grooming Studio in Hornchurch, Essex.

You are warm, playful and love dogs. You use the occasional dog emoji 🐾 but keep responses concise and helpful. You never use bullet point lists — always write in a natural, conversational way.

ABOUT THE SALON:
- Name: Fluff & Scruff Studio
- Address: 138 Hillview Avenue, Hornchurch RM11 2DL
- Phone: 01708 606655
- WhatsApp: +44 7476 452782
- Email: info@fluffandscruff.co.uk
- Hours: Tuesday to Saturday, 10:00am to 5:00pm
- Closed Sunday and Monday

SERVICES OFFERED:
- Grooming (Full Groom) — wash, dry, cut and style
- Puppy Special — gentle first groom experience
- Nail Trim & Filing — quick painless trim
- Ultrasonic Teeth Cleaning — fresh breath treatment

PRICING: Prices vary by breed size and coat type. Direct customers to the booking page to see exact pricing for their specific breed.

BOOKING: All bookings are made online at fluff-scruff-studio.lovable.app/book
A deposit is required to secure the booking. We do not accept cash — card payments only.

AVAILABILITY: When a customer asks about availability, next available appointment, or wants to book a specific date, I will check availability data and tell them which dates have slots.

BREED KNOWLEDGE: You are an expert on all dog breeds. You can answer questions about grooming frequency recommendations per breed, coat types and what grooming they need, how to maintain a coat between appointments, what to expect at a first groom (puppy questions), how to prepare a dog for grooming, and common coat problems like matting, shedding, tangles.

NAVIGATION HELP: If a customer wants to book, tell them to tap the orange "Book My Pup In" button on the homepage, or go directly to /book. If they want to see their past appointments, tell them to sign in and go to My Account. If they have a complaint or issue, give them the phone number and email.

WHAT YOU DO NOT DO:
- You do not discuss competitor salons
- You do not guarantee specific groomers
- You do not discuss staff personal details
- You do not process payments or change bookings
- You do not make up prices — always say prices depend on breed and direct to the booking page
- If asked something you do not know, say "That's a great question for our team — give us a call on 01708 606655 or drop us a message on WhatsApp!"`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversation = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is an availability-related question
    const availabilityKeywords = [
      "available", "availability", "book", "appointment", "slot",
      "when can", "next available", "free", "opening", "schedule",
      "this week", "next week", "tomorrow", "today", "date",
    ];
    const isAvailabilityQuestion = availabilityKeywords.some((kw) =>
      message.toLowerCase().includes(kw)
    );

    let availabilityContext = "";

    if (isAvailabilityQuestion) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const today = new Date().toISOString().split("T")[0];
        const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

        const { data: busyDates } = await supabase
          .from("bookings")
          .select("booking_date")
          .gte("booking_date", today)
          .lte("booking_date", thirtyDays)
          .not("status", "in", '("Cancelled","Refunded","No Show")');

        // Count bookings per date
        const dateCounts: Record<string, number> = {};
        (busyDates || []).forEach((b: any) => {
          dateCounts[b.booking_date] = (dateCounts[b.booking_date] || 0) + 1;
        });

        const fullyBooked = Object.entries(dateCounts)
          .filter(([_, count]) => count >= 4)
          .map(([date]) => date);

        if (fullyBooked.length > 0) {
          availabilityContext = `\n\nAVAILABILITY DATA: The following dates in the next 30 days are fully booked: ${fullyBooked.join(", ")}. Any other date that falls on Tuesday-Saturday has availability. Today is ${today}. Suggest the nearest available dates in a friendly way and include a link to book at fluff-scruff-studio.lovable.app/book`;
        } else {
          availabilityContext = `\n\nAVAILABILITY DATA: Great news — there is plenty of availability across the next 30 days! Today is ${today}. Suggest some upcoming dates (Tuesday-Saturday only, salon is closed Sunday and Monday) and include a link to book at fluff-scruff-studio.lovable.app/book`;
        }
      } catch (e) {
        console.error("Availability check failed:", e);
      }
    }

    const googleApiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_AI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiMessages = [];
    for (const m of conversation) {
      geminiMessages.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    }
    geminiMessages.push({
      role: "user",
      parts: [{ text: message }]
    });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT + availabilityContext }]
          },
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini error:", errText);
      return new Response(
        JSON.stringify({ error: "AI service error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
      || "Woof! Something went wrong. Please try again! 🐾";

    const replyLower = reply.toLowerCase();
    const show_booking_button =
      replyLower.includes("book") || replyLower.includes("availability") || replyLower.includes("/book");
    const show_call_button = replyLower.includes("call") || replyLower.includes("01708");
    const show_whatsapp_button = replyLower.includes("whatsapp");

    return new Response(
      JSON.stringify({ reply, show_booking_button, show_call_button, show_whatsapp_button }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
