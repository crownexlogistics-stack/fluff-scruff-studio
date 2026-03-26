import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchGroomerContext(supabaseAdmin: any, staffId: string, staffName: string) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [
    allBookings,
    completedBookings,
    commissionRecords,
    customerNotes,
    activePackages,
    recentActivity,
  ] = await Promise.all([
    supabaseAdmin.from("bookings")
      .select("id, customer_name, customer_email, dog_name, booking_date, booking_time, status, total_price, deposit_paid, final_charge, service_id, notes, booking_source, created_at, breed_id")
      .eq("staff_id", staffId)
      .order("booking_date", { ascending: false })
      .limit(500),
    supabaseAdmin.from("bookings")
      .select("id, customer_name, dog_name, booking_date, total_price, final_charge, service_id")
      .eq("staff_id", staffId)
      .eq("status", "Completed")
      .order("booking_date", { ascending: false })
      .limit(500),
    supabaseAdmin.from("commission_records")
      .select("id, groomer_pay, total_price, commission_type, commission_rate, booking_source, created_at")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin.from("customer_notes")
      .select("id, customer_email, note, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin.from("package_bookings")
      .select("id, customer_name, dog_name, package_type, sessions_count, total_paid, status, tc_signed, created_at")
      .eq("status", "active"),
    supabaseAdmin.from("groomer_activity_log")
      .select("*")
      .eq("staff_id", staffId)
      .order("performed_at", { ascending: false })
      .limit(50),
  ]);

  // Fetch services and breeds for name lookups
  const [services, breeds] = await Promise.all([
    supabaseAdmin.from("services").select("id, name"),
    supabaseAdmin.from("breeds").select("id, name"),
  ]);

  const serviceMap = Object.fromEntries((services.data || []).map((s: any) => [s.id, s.name]));
  const breedMap = Object.fromEntries((breeds.data || []).map((b: any) => [b.id, b.name]));

  const bookingsData = (allBookings.data || []).map((b: any) => ({
    ...b,
    service_name: serviceMap[b.service_id] || "Unknown",
    breed_name: breedMap[b.breed_id] || "Unknown",
  }));

  // Calculate summaries
  const allCommissions = commissionRecords.data || [];
  const totalEarnedAllTime = allCommissions.reduce((s: number, c: any) => s + Number(c.groomer_pay || 0), 0);
  const thisMonthCommissions = allCommissions.filter((c: any) => c.created_at >= monthStart && c.created_at <= monthEnd + "T23:59:59");
  const earnedThisMonth = thisMonthCommissions.reduce((s: number, c: any) => s + Number(c.groomer_pay || 0), 0);

  const todayBookings = bookingsData.filter((b: any) => b.booking_date === today);
  const futureBookings = bookingsData.filter((b: any) => b.booking_date > today && (b.status === "Pending" || b.status === "Confirmed"));

  return {
    current_date: today,
    current_month: `${now.toLocaleString("en-GB", { month: "long" })} ${now.getFullYear()}`,
    groomer_name: staffName,
    today_bookings: todayBookings,
    future_bookings: futureBookings.slice(0, 50),
    all_bookings_count: bookingsData.length,
    completed_bookings_count: (completedBookings.data || []).length,
    recent_bookings: bookingsData.slice(0, 100),
    earnings_summary: {
      total_earned_all_time: `£${totalEarnedAllTime.toFixed(2)}`,
      earned_this_month: `£${earnedThisMonth.toFixed(2)}`,
      bookings_this_month: thisMonthCommissions.length,
    },
    customer_notes: (customerNotes.data || []).slice(0, 100),
    active_packages: (activePackages.data || []),
    recent_activity: (recentActivity.data || []),
    salon_policies: {
      cancellation: "Customers must cancel at least 48 hours before their appointment. Cancellations within 48 hours may forfeit their deposit.",
      deposits: "A 50% deposit is required to confirm a booking. Deposits are non-refundable if the customer cancels within 48 hours.",
      no_shows: "If a customer does not attend, the deposit is split 50/50 between the salon and the groomer. The booking is marked as No Show.",
      packages: "Package deals offer discounted sessions (4-session at 10% off, 6-session at 15% off, 5 teeth cleaning at £100). Sessions are locked in at purchase price. No-show sessions are marked as used without refund.",
      commission: "Standard commission is 40% of the total price. Own customers (brought in by the groomer) earn 50%. No-show commission is 50% of the deposit paid.",
    },
    code_of_conduct: "Be professional and courteous at all times. Treat all dogs with care and respect. Follow salon hygiene standards. Report any injuries or incidents immediately. Maintain confidentiality about customer information. Arrive on time for all appointments. Keep your workspace clean and organised.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify groomer role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "groomer") {
      return new Response(JSON.stringify({ error: "Groomer access only" }), { status: 403, headers: corsHeaders });
    }

    // Get staff record
    const { data: staffData } = await supabaseAdmin
      .from("staff")
      .select("id, name")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!staffData) {
      return new Response(JSON.stringify({ error: "Staff profile not found" }), { status: 404, headers: corsHeaders });
    }

    const { messages } = await req.json();
    if (!messages?.length) throw new Error("No messages provided");

    const contextData = await fetchGroomerContext(supabaseAdmin, staffData.id, staffData.name);

    const systemPrompt = `You are a friendly and helpful assistant for groomers at Fluff & Scruff Studio in Hornchurch. Your job is to help groomers with any question they have about their work, their bookings, customers, or the salon system.

You have access to this groomer's live booking and customer data. Use it to give specific, accurate answers.

The groomer you are helping is: ${staffData.name}

When a groomer encounters an error or problem with the system:
1. Explain what went wrong in plain English
2. Tell them what to try themselves
3. Give them the exact message to send to Sevak (the director) to get it fixed

Always be warm, encouraging and practical. Never use technical jargon unless you explain it. If you don't know something, say so clearly.

You can help with:
- Finding customer or booking information
- Explaining system errors
- Answering questions about salon policies
- Reviewing their schedule and customers
- Checking package booking status
- Code of conduct questions
- Commission and earnings questions

Always refer to money in pounds sterling (£). Use the groomer's name when addressing them. Keep responses helpful and concise.

Here is the groomer's current live data:
${JSON.stringify(contextData, null, 2)}`;

    const claudeMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content || "...",
    }));

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      throw new Error("AI unavailable");
    }

    return new Response(anthropicRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("groomer-assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
