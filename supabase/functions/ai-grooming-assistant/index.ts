import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Service duration map (minutes) ──────────────────────
const SERVICE_DURATIONS: Record<string, number> = {
  "full groom small": 120,
  "full groom medium": 150,
  "full groom large": 180,
  "full groom giant": 240,
  "full groom samoyed": 240,
  "full groom doodle": 180,
  "bath and blow dry small": 60,
  "bath and blow dry medium": 90,
  "bath and blow dry large": 120,
  "nail trim": 20,
  "nail trim and filing": 30,
  "teeth cleaning": 30,
  "de-shedding": 45,
  "brush out": 30,
  "puppy groom": 90,
  "puppy introduction": 60,
};

// ── Breed → size category ───────────────────────────────
const BREED_SIZES: Record<string, string> = {
  chihuahua: "small", pomeranian: "small", "shih tzu": "small", maltese: "small",
  "yorkshire terrier": "small", yorkie: "small", bichon: "small", "bichon frise": "small",
  "miniature schnauzer": "small", pug: "small", "french bulldog": "small", frenchie: "small",
  dachshund: "small", "sausage dog": "small", cavalier: "small", "cavalier king charles": "small",
  "toy poodle": "small", "miniature poodle": "small", "jack russell": "small",
  westie: "small", "west highland terrier": "small", maltipoo: "small", pomchi: "small",
  cavachon: "small", cavapoo: "small", "cairn terrier": "small", "scottish terrier": "small",
  pekingese: "small", "lhasa apso": "small",

  "cocker spaniel": "medium", "springer spaniel": "medium", sprocker: "medium",
  "border collie": "medium", collie: "medium", whippet: "medium", bulldog: "medium",
  cockapoo: "medium", beagle: "medium", "staffordshire bull terrier": "medium",
  staffy: "medium", corgi: "medium", schnauzer: "medium",

  labrador: "large", lab: "large", "golden retriever": "large", husky: "large",
  "german shepherd": "large", gsd: "large", dalmatian: "large", boxer: "large",
  "standard poodle": "large", setter: "large", rottweiler: "large", doberman: "large",
  labradoodle: "large", goldendoodle: "large", aussiedoodle: "large",
  "rough collie": "large", greyhound: "large",

  samoyed: "giant", "bernese mountain dog": "giant", "great dane": "giant",
  "saint bernard": "giant", newfoundland: "giant", "alaskan malamute": "giant", malamute: "giant",
  "old english sheepdog": "giant", bernedoodle: "giant", sheepadoodle: "giant",
  "chow chow": "giant",
};

function detectBreedSize(text: string): string | null {
  const lower = text.toLowerCase();
  // Sort by length descending so multi-word breeds match first
  const sorted = Object.keys(BREED_SIZES).sort((a, b) => b.length - a.length);
  for (const breed of sorted) {
    if (lower.includes(breed)) return BREED_SIZES[breed];
  }
  return null;
}

function detectBreedName(text: string): string | null {
  const lower = text.toLowerCase();
  const sorted = Object.keys(BREED_SIZES).sort((a, b) => b.length - a.length);
  for (const breed of sorted) {
    if (lower.includes(breed)) return breed;
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────
function timeToMinutes(t: string): number {
  // Handles "10:00", "10:00:00", "10:00 AM" etc
  const clean = t.replace(/\s*(am|pm)\s*/i, (_, ap) => ap);
  const parts = clean.split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (/pm/i.test(t) && h < 12) h += 12;
  if (/am/i.test(t) && h === 12) h = 0;
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")}${suffix}`;
}

const SALON_OPEN = 10 * 60; // 600 = 10:00am
const SALON_CLOSE = 17 * 60; // 1020 = 5:00pm

// ── Availability checking ───────────────────────────────
async function checkDetailedAvailability(
  supabase: any,
  requestedDate: string,
  serviceDurationMinutes: number
): Promise<{
  available: boolean;
  slots: Array<{ time: string; groomerName: string }>;
  fullyBookedAlternatives?: string[];
}> {
  // Get active groomers
  const { data: groomers } = await supabase
    .from("staff")
    .select("id, name, booking_priority")
    .eq("is_accepting_bookings", true)
    .eq("role", "groomer")
    .order("booking_priority", { ascending: true, nullsLast: true });

  if (!groomers || groomers.length === 0) {
    return { available: false, slots: [] };
  }

  // Get bookings for requested date
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time, duration_minutes, staff_id")
    .eq("booking_date", requestedDate)
    .not("status", "in", '("Cancelled","No Show","Refunded")');

  // Get migrated bookings for requested date
  const { data: migratedBookings } = await supabase
    .from("migrated_bookings")
    .select("booking_time, duration_minutes, staff_name")
    .eq("booking_date", requestedDate)
    .eq("is_future_booking", true);

  // Get schedule overrides (days off)
  const { data: overrides } = await supabase
    .from("staff_schedule_overrides")
    .select("staff_id, is_working")
    .eq("override_date", requestedDate);

  const overrideMap = new Map<string, boolean>();
  (overrides || []).forEach((o: any) => overrideMap.set(o.staff_id, o.is_working));

  // Get recurring availability
  const dow = new Date(requestedDate + "T12:00:00Z").getDay();
  const { data: recurringAvail } = await supabase
    .from("staff_availability")
    .select("staff_id, is_available")
    .eq("day_of_week", dow);

  const recurringMap = new Map<string, boolean>();
  (recurringAvail || []).forEach((a: any) => recurringMap.set(a.staff_id, a.is_available));

  const slots: Array<{ time: string; groomerName: string }> = [];

  for (const groomer of groomers) {
    // Check if groomer is off
    if (overrideMap.has(groomer.id)) {
      if (!overrideMap.get(groomer.id)) continue; // explicitly off
    } else if (recurringMap.has(groomer.id) && !recurringMap.get(groomer.id)) {
      continue; // recurring day off
    }

    // Collect booked intervals for this groomer
    const intervals: Array<[number, number]> = [];

    (bookings || []).filter((b: any) => b.staff_id === groomer.id).forEach((b: any) => {
      const start = timeToMinutes(b.booking_time);
      const dur = b.duration_minutes || 60;
      intervals.push([start, start + dur]);
    });

    // Match migrated bookings by groomer name
    (migratedBookings || []).filter((mb: any) => {
      const mbName = (mb.staff_name || "").toLowerCase();
      return mbName.includes(groomer.name.toLowerCase()) || groomer.name.toLowerCase().includes(mbName);
    }).forEach((mb: any) => {
      if (mb.booking_time) {
        const start = timeToMinutes(mb.booking_time);
        const dur = mb.duration_minutes || 60;
        intervals.push([start, start + dur]);
      }
    });

    // Sort intervals
    intervals.sort((a, b) => a[0] - b[0]);

    // Find gaps
    let cursor = SALON_OPEN;
    for (const [start, end] of intervals) {
      if (start > cursor) {
        const gapDuration = start - cursor;
        if (gapDuration >= serviceDurationMinutes) {
          slots.push({ time: minutesToTime(cursor), groomerName: groomer.name });
        }
      }
      cursor = Math.max(cursor, end);
    }
    // Check gap after last booking
    if (SALON_CLOSE - cursor >= serviceDurationMinutes) {
      slots.push({ time: minutesToTime(cursor), groomerName: groomer.name });
    }
  }

  if (slots.length > 0) {
    return { available: true, slots: slots.slice(0, 5) };
  }

  // Find next available dates
  const alternatives: string[] = [];
  const startDate = new Date(requestedDate + "T12:00:00Z");
  for (let i = 1; i <= 14 && alternatives.length < 3; i++) {
    const d = new Date(startDate.getTime() + i * 86400000);
    const dayOfWeek = d.getDay();
    if (dayOfWeek < 2 || dayOfWeek > 6) continue; // Skip Sun/Mon
    const dateStr = d.toISOString().split("T")[0];
    const result = await checkDetailedAvailability(supabase, dateStr, serviceDurationMinutes);
    if (result.available) {
      const formatted = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      alternatives.push(`${formatted} at ${result.slots[0].time} with ${result.slots[0].groomerName}`);
    }
  }

  return { available: false, slots: [], fullyBookedAlternatives: alternatives };
}

// ── Send escalation email ───────────────────────────────
async function sendEscalationEmail(
  name: string,
  contact: string,
  query: string,
  conversationSummary: string
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY not configured for escalation");
    return;
  }

  const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Fluff & Scruff Studio <onboarding@resend.dev>",
      to: ["info@fluffandscruff.co.uk"],
      reply_to: "info@fluffandscruff.co.uk",
      subject: "🐾 Scruff Chat — Customer needs help",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #FF6B35;">🐾 Scruff Chat — Customer Needs Help</h2>
          <p>A customer has requested to speak with a team member via the website chat.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Name:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Contact:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Query:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${query}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Time:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${now}</td></tr>
          </table>
          <h3 style="color: #333;">Recent Conversation:</h3>
          <div style="background: #f9f5f0; padding: 15px; border-radius: 8px; white-space: pre-wrap; font-size: 14px;">${conversationSummary}</div>
          <p style="margin-top: 20px; color: #888;">Please follow up as soon as possible.</p>
        </div>
      `,
    }),
  });
}

// ── Fetch live data from database ────────────────────────
async function fetchLiveData(supabase: any) {
  const fallbackHours = "Tuesday to Saturday, 10am to 5pm. Closed Sunday and Monday.";
  let openingHoursText = fallbackHours;
  let servicesText = "";
  let breedPricingText = "";

  try {
    // Fetch opening hours from site_config
    const { data: configRows } = await supabase
      .from("site_config")
      .select("key, value")
      .in("key", ["opening_hours", "opening_days", "holiday_dates", "special_closures"]);

    if (configRows && configRows.length > 0) {
      const configMap: Record<string, any> = {};
      for (const row of configRows) {
        configMap[row.key] = row.value;
      }
      const parts: string[] = [];
      if (configMap.opening_hours) parts.push(`Hours: ${JSON.stringify(configMap.opening_hours)}`);
      if (configMap.opening_days) parts.push(`Open days: ${JSON.stringify(configMap.opening_days)}`);
      if (configMap.holiday_dates) parts.push(`Holiday closures: ${JSON.stringify(configMap.holiday_dates)}`);
      if (configMap.special_closures) parts.push(`Special closures: ${JSON.stringify(configMap.special_closures)}`);
      if (parts.length > 0) openingHoursText = parts.join("\n");
    }
  } catch (e) {
    console.error("Failed to fetch opening hours:", e);
  }

  try {
    // Fetch active services
    const { data: services } = await supabase
      .from("services")
      .select("name, description, fixed_price, duration_minutes, is_active")
      .eq("is_active", true)
      .order("name");

    if (services && services.length > 0) {
      servicesText = services.map((s: any) => {
        const priceInfo = s.fixed_price ? `£${s.fixed_price}` : "Price varies by breed";
        const durInfo = s.duration_minutes ? `${s.duration_minutes} mins` : "Duration varies";
        return `- ${s.name}: ${priceInfo} (${durInfo})${s.description ? ` — ${s.description}` : ""}`;
      }).join("\n");
    }
  } catch (e) {
    console.error("Failed to fetch services:", e);
  }

  try {
    // Fetch breed-specific pricing from breeds table
    const { data: breeds } = await supabase
      .from("breeds")
      .select("name, size_category, price_full_groom, price_bath_brush, duration_minutes")
      .order("name");

    if (breeds && breeds.length > 0) {
      breedPricingText = breeds.map((b: any) => {
        const parts: string[] = [];
        if (b.price_full_groom > 0) parts.push(`Full Groom: £${b.price_full_groom}`);
        if (b.price_bath_brush > 0) parts.push(`Bath & Brush: £${b.price_bath_brush}`);
        return `- ${b.name} (${b.size_category}): ${parts.join(", ")} — ${b.duration_minutes} mins`;
      }).join("\n");
    }

    // Also fetch service_prices for any additional service/breed combos
    const { data: servicePrices } = await supabase
      .from("service_prices")
      .select("price, service_id, breed_id, services(name), breeds(name)")
      .order("price");

    if (servicePrices && servicePrices.length > 0) {
      const extraPricing = servicePrices
        .filter((sp: any) => sp.services?.name && sp.breeds?.name)
        .map((sp: any) => `- ${sp.services.name} for ${sp.breeds.name}: £${sp.price}`)
        .join("\n");
      if (extraPricing) {
        breedPricingText += "\n\nAdditional service-specific pricing:\n" + extraPricing;
      }
    }
  } catch (e) {
    console.error("Failed to fetch breed pricing:", e);
  }

  return { openingHoursText, servicesText, breedPricingText };
}

// ── System prompt (base) ────────────────────────────────
const BASE_SYSTEM_PROMPT = `You are Scruff, the AI assistant for Fluff & Scruff Studio — a professional dog grooming salon in Hornchurch, Essex.

CRITICAL RULES — ALWAYS FOLLOW THESE:

1. YOU ONLY HELP WITH DOG-RELATED TOPICS
You are a DOG grooming assistant only. If someone asks about cats, rabbits, birds, or any other animal say: "I'm only trained to help with dogs I'm afraid! We're a dog-only salon 🐾 Is there anything I can help you with for your dog?" Never answer questions about other animals. Never assume a question is about a dog if the customer has not confirmed it is.

2. UNDERSTAND CONTEXT BEFORE ANSWERING
Before answering any question, consider: Is this question about a dog or another animal? Is this customer asking about our services or general advice? Do I have enough information to give a useful answer? If the question is ambiguous — ASK first. Do not assume. Do not guess. Example: Customer says "how often should I cut nails?" — do NOT assume it's a dog. Instead ask "Happy to help! Is this for your dog? 🐾"

3. DO NOT MAKE UP INFORMATION
If you don't know something — say so. Direct to the team: "I'm not sure about that — best to speak to our team directly! You can call us on 01708 606655, WhatsApp us on +44 7476 452782, or email info@fluffandscruff.co.uk"

4. PRICING — USE LIVE DATA ONLY
You now have access to LIVE pricing data from our database (shown below under "CURRENT SALON INFORMATION"). When a customer asks about pricing:
- If the breed and service match exists in the live data, quote the exact price confidently.
- If the breed is not listed but the service exists, say pricing starts from the lowest price for that service and suggest checking the booking page for exact pricing.
- NEVER invent or guess prices that are not in the live data below.

5. STAY ON TOPIC
You help with: dog grooming questions, breed-specific coat advice, our services and what they include, booking availability and guidance, general dog care tips (brushing, bathing, nail care for DOGS only), salon information (hours, location, parking, what to bring).
You do NOT help with: other animals, veterinary advice or medical questions, nutrition or diet advice, training or behaviour advice, anything unrelated to dog grooming.
If asked about vet or medical topics say: "That sounds like a question for your vet rather than a groomer! We'd always recommend speaking to a professional for health-related questions 🐾"

6. PERSONALITY
Warm, friendly and professional. Use 🐾 emoji occasionally but not on every single message. Keep responses SHORT and mobile-friendly — maximum 3-4 sentences per response unless a detailed answer is genuinely needed. Never use bullet points for simple answers. Sound like a knowledgeable friend, not a corporate chatbot. Never start two consecutive messages the same way. Vary your greetings and responses.

7. SALON INFORMATION
Name: Fluff & Scruff Studio
Address: 138 Hillview Avenue, Hornchurch, Essex RM11 2DL
Phone: 01708 606655
WhatsApp: +44 7476 452782
Email: info@fluffandscruff.co.uk
Rating: 4.9 stars on Google
Speciality: All breeds welcome, family-run, dogs-first approach

BOOKING: All bookings are made online at fluff-scruff-studio.lovable.app/book. A deposit is required to secure the booking. We do not accept cash — card payments only.

8. IF CUSTOMER SEEMS UPSET OR COMPLAINING
Do not argue or defend. Acknowledge their concern warmly: "I'm really sorry to hear that — I want to make sure this is looked into properly. Let me connect you with our team directly." Then trigger the human handoff flow.

9. CONVERSATION MEMORY
Remember within the conversation: customer's name if given, dog's name and breed, what service they asked about, what dates were mentioned. Use this to personalise responses naturally (e.g. "So for Bella's full groom on Saturday...").

HUMAN HANDOFF RULES:
When a customer asks to speak to a human, asks for a callback, seems frustrated, or you cannot help after 2 attempts, respond with: "Of course! I'll make sure a member of our team gets back to you. Could I take your name and best contact number or email? 🐾"
Then collect their name and contact details. Once you have them, confirm with: "Perfect! I've passed your details to the team. Someone will be in touch very soon. In the meantime you can also reach us on WhatsApp: +44 7476 452782 🐾"

IMPORTANT: When you detect a handoff request, include the marker [HANDOFF_REQUESTED] at the very end of your response (after your visible message). When a customer provides their contact details for a handoff, include [HANDOFF_DETAILS:name=Their Name|contact=their@email.com or phone|query=what they need help with] at the very end of your response.

WHAT YOU DO NOT DO:
You do not discuss competitor salons, guarantee specific groomers, discuss staff personal details, process payments or change bookings.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversation = [], context = {} } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const lowerMsg = message.toLowerCase();

    // ── Detect service + breed from full conversation ────
    const fullText = [...conversation.map((m: any) => m.content), message].join(" ").toLowerCase();
    const breedSize = detectBreedSize(fullText);
    const breedName = detectBreedName(fullText);

    // Detect service type
    let serviceType = "full groom";
    let serviceDuration = 120; // default
    if (/nail|claw/i.test(fullText)) { serviceType = "nail trim and filing"; serviceDuration = 30; }
    else if (/teeth|dental|ultrasonic|breath/i.test(fullText)) { serviceType = "teeth cleaning"; serviceDuration = 30; }
    else if (/puppy|first.?groom/i.test(fullText)) { serviceType = "puppy groom"; serviceDuration = 90; }
    else if (/bath|wash|blow.?dry/i.test(fullText)) { serviceType = `bath and blow dry ${breedSize || "medium"}`; }
    else if (/de.?shed/i.test(fullText)) { serviceType = "de-shedding"; serviceDuration = 45; }
    else if (/brush.?out/i.test(fullText)) { serviceType = "brush out"; serviceDuration = 30; }
    else { serviceType = `full groom ${breedSize || "medium"}`; }

    // Look up duration from map
    if (SERVICE_DURATIONS[serviceType]) {
      serviceDuration = SERVICE_DURATIONS[serviceType];
    }

    // ── Availability check ──────────────────────────────
    const availabilityKeywords = [
      "available", "availability", "slot", "when can", "next available",
      "free", "opening", "schedule", "this week", "next week", "tomorrow",
      "today", "saturday", "tuesday", "wednesday", "thursday", "friday",
      "next", "any slots", "can i book", "can I get",
    ];
    const isAvailabilityQuestion = availabilityKeywords.some((kw) => lowerMsg.includes(kw));

    let availabilityContext = "";

    if (isAvailabilityQuestion) {
      try {
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        // Parse requested date from message
        let requestedDate = todayStr;
        if (/tomorrow/i.test(lowerMsg)) {
          const d = new Date(today.getTime() + 86400000);
          requestedDate = d.toISOString().split("T")[0];
        } else if (/this saturday/i.test(lowerMsg)) {
          const d = new Date(today);
          d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
          requestedDate = d.toISOString().split("T")[0];
        } else if (/next (tuesday|wednesday|thursday|friday|saturday)/i.test(lowerMsg)) {
          const dayNames: Record<string, number> = { tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
          const match = lowerMsg.match(/next (tuesday|wednesday|thursday|friday|saturday)/i);
          if (match) {
            const targetDay = dayNames[match[1].toLowerCase()];
            const d = new Date(today);
            const daysUntil = ((targetDay - d.getDay() + 7) % 7) || 7;
            d.setDate(d.getDate() + daysUntil + (daysUntil <= (targetDay - d.getDay() + 7) % 7 ? 0 : 7));
            // "next X" means next week's occurrence
            if (daysUntil <= 7) d.setDate(d.getDate() + 7);
            requestedDate = d.toISOString().split("T")[0];
          }
        } else if (/this (tuesday|wednesday|thursday|friday)/i.test(lowerMsg)) {
          const dayNames: Record<string, number> = { tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
          const match = lowerMsg.match(/this (tuesday|wednesday|thursday|friday)/i);
          if (match) {
            const targetDay = dayNames[match[1].toLowerCase()];
            const d = new Date(today);
            const daysUntil = (targetDay - d.getDay() + 7) % 7;
            d.setDate(d.getDate() + (daysUntil || 7));
            requestedDate = d.toISOString().split("T")[0];
          }
        } else {
          // Try to find a date pattern like "15th March", "March 15"
          const dateMatch = lowerMsg.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i);
          if (dateMatch) {
            const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const day = parseInt(dateMatch[1]);
            const monthKey = dateMatch[2].substring(0, 3).toLowerCase();
            const month = months[monthKey];
            if (month !== undefined) {
              const d = new Date(today.getFullYear(), month, day);
              if (d < today) d.setFullYear(d.getFullYear() + 1);
              requestedDate = d.toISOString().split("T")[0];
            }
          }
        }

        // Check if requested date is Sun or Mon
        const reqDow = new Date(requestedDate + "T12:00:00Z").getDay();
        if (reqDow === 0 || reqDow === 1) {
          availabilityContext = `\n\nAVAILABILITY DATA: The customer asked about a date that falls on ${reqDow === 0 ? "Sunday" : "Monday"} — the salon is closed. Suggest the nearest open days (Tuesday-Saturday). Today is ${todayStr}.`;
        } else {
          const result = await checkDetailedAvailability(supabase, requestedDate, serviceDuration);
          const formattedDate = new Date(requestedDate + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

          if (result.available) {
            const slotList = result.slots.map((s) => `🕐 ${s.time} — with ${s.groomerName}`).join("\n");
            availabilityContext = `\n\nAVAILABILITY DATA: There ARE available slots for a ${serviceType} (${serviceDuration} mins) on ${formattedDate}:\n${slotList}\n\nPresent these slots in a friendly way. Mention the groomer names. Include a link to book at fluff-scruff-studio.lovable.app/book`;
          } else {
            let altText = "No alternative dates found in the next 2 weeks.";
            if (result.fullyBookedAlternatives && result.fullyBookedAlternatives.length > 0) {
              altText = `Next available dates:\n${result.fullyBookedAlternatives.map((a) => `📅 ${a}`).join("\n")}`;
            }
            availabilityContext = `\n\nAVAILABILITY DATA: Unfortunately there are NO available slots for a ${serviceType} (${serviceDuration} mins) on ${formattedDate}. ${altText}\n\nPresent this in a friendly, empathetic way and suggest the alternatives. Include a link to book at fluff-scruff-studio.lovable.app/book`;
          }
        }
      } catch (e) {
        console.error("Availability check failed:", e);
        availabilityContext = "\n\nAVAILABILITY DATA: Could not check availability right now. Suggest the customer book online or call 01708 606655.";
      }
    }

    // ── Breed context ───────────────────────────────────
    let breedContext = "";
    if (breedName) {
      breedContext = `\n\nBREED CONTEXT: The customer has mentioned a ${breedName} (size: ${breedSize || "unknown"}). For service duration, use ${serviceDuration} minutes for a ${serviceType}.`;
    }

    // ── Conversation context from client ────────────────
    let memoryContext = "";
    if (context.customerName) memoryContext += `\nCustomer name: ${context.customerName}`;
    if (context.dogName) memoryContext += `\nDog name: ${context.dogName}`;
    if (context.breed) memoryContext += `\nBreed: ${context.breed}`;
    if (memoryContext) {
      memoryContext = `\n\nCONVERSATION MEMORY (from earlier in chat):${memoryContext}`;
    }

    // ── Fetch live data from database ──────────────────
    const liveData = await fetchLiveData(supabase);
    let liveContext = `\n\nCURRENT SALON INFORMATION (live from database — use this as the source of truth):`;
    liveContext += `\n\nOPENING HOURS:\n${liveData.openingHoursText}`;
    if (liveData.servicesText) {
      liveContext += `\n\nSERVICES AND PRICING:\n${liveData.servicesText}`;
    } else {
      liveContext += `\n\nSERVICES: Could not load live service data. Direct customer to booking page or call 01708 606655 for pricing.`;
    }
    if (liveData.breedPricingText) {
      liveContext += `\n\nBREED-SPECIFIC PRICING:\n${liveData.breedPricingText}`;
    }

    // ── Call Anthropic ──────────────────────────────────
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: Array<{ role: string; content: string }> = [];
    for (const m of conversation) {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
    messages.push({ role: "user", content: message });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: BASE_SYSTEM_PROMPT + liveContext + availabilityContext + breedContext + memoryContext,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", errText);
      return new Response(
        JSON.stringify({ error: "AI service error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let reply = data.content?.[0]?.text || "Woof! Something went wrong 🐾";

    // ── Handle handoff markers ──────────────────────────
    let handoff_requested = false;
    let handoff_completed = false;

    if (reply.includes("[HANDOFF_REQUESTED]")) {
      handoff_requested = true;
      reply = reply.replace("[HANDOFF_REQUESTED]", "").trim();
    }

    const handoffMatch = reply.match(/\[HANDOFF_DETAILS:name=([^|]*)\|contact=([^|]*)\|query=([^\]]*)\]/);
    if (handoffMatch) {
      handoff_completed = true;
      const hName = handoffMatch[1] || "Not provided";
      const hContact = handoffMatch[2] || "Not provided";
      const hQuery = handoffMatch[3] || "Not provided";

      // Build conversation summary (last 6 messages)
      const recentMsgs = [...conversation.slice(-6), { role: "user", content: message }];
      const summary = recentMsgs
        .map((m: any) => `${m.role === "user" ? "Customer" : "Scruff"}: ${m.content}`)
        .join("\n");

      // Send escalation email
      try {
        await sendEscalationEmail(hName, hContact, hQuery, summary);
        console.log("Escalation email sent successfully");
      } catch (e) {
        console.error("Failed to send escalation email:", e);
      }

      reply = reply.replace(handoffMatch[0], "").trim();
    }

    const replyLower = reply.toLowerCase();
    const show_booking_button =
      replyLower.includes("book") || replyLower.includes("availability") || replyLower.includes("/book") || replyLower.includes("fluff-scruff");
    const show_call_button = replyLower.includes("call") || replyLower.includes("01708");
    const show_whatsapp_button = replyLower.includes("whatsapp") || replyLower.includes("7476");

    return new Response(
      JSON.stringify({
        reply,
        show_booking_button,
        show_call_button,
        show_whatsapp_button,
        handoff_requested,
        handoff_completed,
        detected_breed: breedName,
        detected_size: breedSize,
      }),
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
