import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { booking_id, is_migrated } = await req.json();
    if (!booking_id) throw new Error("booking_id required");

    const todayStr = new Date().toISOString().split("T")[0];

    // Check cache
    const cacheKey = `dog_brief_${booking_id}`;
    const { data: cached } = await supabase
      .from("site_config")
      .select("value, updated_at")
      .eq("key", cacheKey)
      .single();

    if (cached) {
      const cacheDate = cached.updated_at?.split("T")[0];
      if (cacheDate === todayStr) {
        return new Response(JSON.stringify(cached.value), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let customerName = "", dogName = "", breedName = "", serviceName = "", customerEmail = "";
    let dogAge = "", notes = "";

    if (is_migrated) {
      const { data: mb } = await supabase
        .from("migrated_bookings")
        .select("*, migrated_customers(full_name, email, phone)")
        .eq("id", booking_id)
        .single();

      if (!mb) throw new Error("Booking not found");
      customerName = mb.migrated_customers?.full_name || "Unknown";
      customerEmail = mb.migrated_customers?.email || "";
      dogName = mb.dog_name || "Unknown";
      breedName = mb.dog_breed || "Unknown";
      serviceName = mb.service_name || "Unknown";
      notes = mb.notes || "";

      // Get history from migrated bookings for this customer
      const { data: history } = await supabase
        .from("migrated_bookings")
        .select("booking_date, service_name, staff_name, notes, dog_name")
        .eq("migrated_customer_id", mb.migrated_customer_id)
        .order("booking_date", { ascending: false })
        .limit(20);

      // Also check main bookings by email
      let mainHistory: any[] = [];
      if (customerEmail) {
        const { data: mh } = await supabase
          .from("bookings")
          .select("booking_date, status, notes, dog_name, staff_id, total_price")
          .ilike("customer_email", customerEmail)
          .order("booking_date", { ascending: false })
          .limit(20);
        mainHistory = mh || [];
      }

      // Get staff names for main history
      const { data: allStaff } = await supabase.from("staff").select("id, name");
      const staffMap = new Map((allStaff || []).map(s => [s.id, s.name]));

      // Customer notes
      let customerNotes: any[] = [];
      if (customerEmail) {
        const { data: cn } = await supabase
          .from("customer_notes")
          .select("note, created_at")
          .ilike("customer_email", customerEmail)
          .order("created_at", { ascending: false })
          .limit(10);
        customerNotes = cn || [];
      }

      const totalVisits = (history || []).length + mainHistory.length;
      const lastVisit = (history || [])[0]?.booking_date || mainHistory[0]?.booking_date || null;
      const daysSinceLastVisit = lastVisit
        ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)
        : null;

      const dogData = {
        customerName,
        dogName,
        breed: breedName,
        serviceToday: serviceName,
        dogAge: dogAge || "Unknown",
        totalPreviousVisits: totalVisits,
        daysSinceLastVisit,
        groomingHistory: [
          ...(history || []).map(h => ({
            date: h.booking_date,
            service: h.service_name,
            groomer: h.staff_name,
            notes: h.notes,
          })),
          ...mainHistory.map(h => ({
            date: h.booking_date,
            service: "Booking",
            groomer: staffMap.get(h.staff_id || "") || "Unknown",
            notes: h.notes,
          })),
        ].slice(0, 10),
        customerNotes: customerNotes.map(n => n.note),
        bookingNotes: notes,
      };

      const brief = await callAnthropic(ANTHROPIC_API_KEY, dogData);
      const result = { text: brief, totalVisits, generatedAt: new Date().toISOString() };

      await supabase.from("site_config").upsert({
        key: cacheKey,
        value: result as any,
        updated_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, breeds(name), services(name)")
      .eq("id", booking_id)
      .single();

    if (!booking) throw new Error("Booking not found");

    customerName = booking.customer_name;
    customerEmail = booking.customer_email || "";
    dogName = booking.dog_name;
    breedName = booking.breeds?.name || "Unknown";
    serviceName = booking.services?.name || "Unknown";
    notes = booking.notes || "";

    // Get staff
    const { data: allStaff } = await supabase.from("staff").select("id, name");
    const staffMap = new Map((allStaff || []).map(s => [s.id, s.name]));

    // Grooming history from bookings
    let mainHistory: any[] = [];
    if (customerEmail) {
      const { data: mh } = await supabase
        .from("bookings")
        .select("booking_date, status, notes, dog_name, staff_id, total_price, service_id, services(name)")
        .ilike("customer_email", customerEmail)
        .order("booking_date", { ascending: false })
        .limit(20);
      mainHistory = mh || [];
    }

    // Migrated history
    let migratedHistory: any[] = [];
    if (customerEmail) {
      const { data: mc } = await supabase
        .from("migrated_customers")
        .select("id")
        .ilike("email", customerEmail)
        .limit(1);

      if (mc && mc.length > 0) {
        const { data: mh } = await supabase
          .from("migrated_bookings")
          .select("booking_date, service_name, staff_name, notes, dog_name")
          .eq("migrated_customer_id", mc[0].id)
          .order("booking_date", { ascending: false })
          .limit(20);
        migratedHistory = mh || [];
      }
    }

    // Customer notes
    let customerNotes: any[] = [];
    if (customerEmail) {
      const { data: cn } = await supabase
        .from("customer_notes")
        .select("note, created_at")
        .ilike("customer_email", customerEmail)
        .order("created_at", { ascending: false })
        .limit(10);
      customerNotes = cn || [];
    }

    // Pet profile
    let petAge = "Unknown";
    if (customerEmail) {
      const { data: userRec } = await supabase.rpc("get_user_id_by_email", { _email: customerEmail });
      if (userRec) {
        const { data: pets } = await supabase
          .from("customer_pets")
          .select("pet_name, dog_age_years, dog_age_months, notes, breed_id, breeds(name)")
          .eq("user_id", userRec);
        const matchingPet = (pets || []).find(p => p.pet_name?.toLowerCase() === dogName?.toLowerCase());
        if (matchingPet) {
          if (matchingPet.dog_age_years) petAge = `${matchingPet.dog_age_years} years${matchingPet.dog_age_months ? ` ${matchingPet.dog_age_months} months` : ""}`;
          if (matchingPet.notes) notes += ` Pet profile notes: ${matchingPet.notes}`;
        }
      }
    }

    const totalVisits = mainHistory.length + migratedHistory.length;
    const lastVisitDate = mainHistory[0]?.booking_date || migratedHistory[0]?.booking_date || null;
    const daysSinceLastVisit = lastVisitDate
      ? Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / 86400000)
      : null;

    const dogData = {
      customerName,
      dogName,
      breed: breedName,
      serviceToday: serviceName,
      dogAge: petAge,
      totalPreviousVisits: totalVisits,
      daysSinceLastVisit,
      groomingHistory: [
        ...mainHistory.map(h => ({
          date: h.booking_date,
          service: h.services?.name || "Unknown",
          groomer: staffMap.get(h.staff_id || "") || "Unknown",
          notes: h.notes,
          status: h.status,
        })),
        ...migratedHistory.map(h => ({
          date: h.booking_date,
          service: h.service_name,
          groomer: h.staff_name,
          notes: h.notes,
        })),
      ].slice(0, 10),
      customerNotes: customerNotes.map(n => n.note),
      bookingNotes: notes,
    };

    const brief = await callAnthropic(ANTHROPIC_API_KEY, dogData);
    const result = { text: brief, totalVisits, generatedAt: new Date().toISOString() };

    await supabase.from("site_config").upsert({
      key: cacheKey,
      value: result as any,
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("dog-brief error:", error);
    return new Response(
      JSON.stringify({ error: "AI briefing unavailable right now — please try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callAnthropic(apiKey: string, dogData: any): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are an expert dog grooming assistant. Give groomers a helpful pre-appointment brief about the dog they are about to groom. Be warm, practical and concise. Maximum 3-4 sentences. Focus on: coat condition expectations, temperament if known from history, what the owner usually prefers, anything to watch out for. Never make up information — only use what is in the data provided. If something is unknown say so briefly.`,
      messages: [
        {
          role: "user",
          content: `Please give me a pre-appointment brief for this dog:\n${JSON.stringify(dogData, null, 2)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic error:", res.status, errText);
    throw new Error("AI unavailable");
  }

  const data = await res.json();
  return data.content?.[0]?.text || "Unable to generate brief.";
}
