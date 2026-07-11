import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { force } = await req.json().catch(() => ({ force: false }));

    // Check cache
    if (!force) {
      const { data: cached } = await supabase
        .from("site_config")
        .select("value, updated_at")
        .eq("key", "daily_briefing")
        .single();

      if (cached) {
        const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
        if (cacheAge < 3600000) {
          return new Response(JSON.stringify(cached.value), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dayOfWeek = today.toLocaleDateString("en-GB", { weekday: "long" });
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Last month same week
    const lastMonthStart = new Date(weekStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(lastMonthStart);
    lastMonthEnd.setDate(lastMonthEnd.getDate() + 6);

    // Today's bookings
    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("id, booking_time, staff_id, total_price, status, customer_name, customer_email, dog_name, is_groomers_own_customer")
      .eq("booking_date", todayStr)
      .not("status", "eq", "Cancelled");

    // Today's migrated bookings
    const { data: todayMigrated } = await supabase
      .from("migrated_bookings")
      .select("id, booking_time, total_price, staff_name, dog_name")
      .eq("booking_date", todayStr);

    // Staff
    const { data: staff } = await supabase
      .from("staff")
      .select("id, name, role")
      .ilike("role", "%groomer%");

    const staffMap = new Map((staff || []).map(s => [s.id, s.name]));

    // This week revenue
    const { data: weekBookings } = await supabase
      .from("bookings")
      .select("total_price, status, customer_email")
      .gte("booking_date", weekStartStr)
      .lte("booking_date", todayStr)
      .not("status", "eq", "Cancelled");

    const thisWeekRevenue = (weekBookings || []).reduce((s, b) => s + Number(b.total_price || 0), 0);

    // Last month same week revenue
    const { data: lastMonthBookings } = await supabase
      .from("bookings")
      .select("total_price")
      .gte("booking_date", lastMonthStart.toISOString().split("T")[0])
      .lte("booking_date", lastMonthEnd.toISOString().split("T")[0])
      .not("status", "eq", "Cancelled");

    const lastMonthWeekRevenue = (lastMonthBookings || []).reduce((s, b) => s + Number(b.total_price || 0), 0);

    // Cancellations in last 48 hours
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const { count: cancellationCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "Cancelled")
      .gte("created_at", twoDaysAgo.toISOString());

    // Overdue customers (8+ weeks)
    const eightWeeksAgo = new Date(today);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const { data: allBookingEmails } = await supabase
      .from("bookings")
      .select("customer_email, customer_name, booking_date, status")
      .not("customer_email", "is", null)
      .order("booking_date", { ascending: false });

    const lastVisitMap = new Map<string, { name: string; date: string }>();
    const hasFuture = new Set<string>();
    (allBookingEmails || []).forEach(b => {
      const email = b.customer_email?.toLowerCase();
      if (!email) return;
      if (b.booking_date > todayStr && b.status !== "Cancelled") hasFuture.add(email);
      if (!lastVisitMap.has(email) && b.booking_date <= todayStr) {
        lastVisitMap.set(email, { name: b.customer_name, date: b.booking_date });
      }
    });
    const overdueCustomers: { name: string; lastVisit: string }[] = [];
    lastVisitMap.forEach((val, email) => {
      if (hasFuture.has(email)) return;
      if (val.date < eightWeeksAgo.toISOString().split("T")[0]) {
        overdueCustomers.push({ name: val.name, lastVisit: val.date });
      }
    });

    // Pending Scruff handoffs
    const { count: pendingHandoffs } = await supabase
      .from("scruff_handoffs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    // Unpaid pay links
    const { count: unpaidPayLinks } = await supabase
      .from("customer_pay_links")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    // Month forecast
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
    const { data: monthBookings } = await supabase
      .from("bookings")
      .select("total_price, status")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd)
      .not("status", "eq", "Cancelled");
    const monthRevenue = (monthBookings || []).reduce((s, b) => s + Number(b.total_price || 0), 0);

    // New customers this week
    const weekEmails = new Set((weekBookings || []).map(b => b.customer_email?.toLowerCase()).filter(Boolean));
    const { data: previousBookings } = await supabase
      .from("bookings")
      .select("customer_email")
      .lt("booking_date", weekStartStr)
      .not("customer_email", "is", null);
    const previousEmails = new Set((previousBookings || []).map(b => b.customer_email?.toLowerCase()));
    const newCustomers = [...weekEmails].filter(e => e && !previousEmails.has(e));

    // Build today's summary
    const allToday = [
      ...(todayBookings || []).map(b => ({
        time: b.booking_time,
        groomer: staffMap.get(b.staff_id || "") || "Unassigned",
        customer: b.customer_name,
        dog: b.dog_name,
        price: Number(b.total_price),
        status: b.status,
      })),
      ...(todayMigrated || []).map(b => ({
        time: b.booking_time || "Unknown",
        groomer: b.staff_name || "Unknown",
        customer: "Migrated",
        dog: b.dog_name || "Unknown",
        price: Number(b.total_price || 0),
        status: "Confirmed",
      })),
    ].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    const todayRevenue = allToday.reduce((s, b) => s + b.price, 0);
    const groomersWorking = [...new Set(allToday.map(b => b.groomer))];
    const groomerCounts = allToday.reduce((acc, b) => {
      acc[b.groomer] = (acc[b.groomer] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const busiestGroomer = Object.entries(groomerCounts).sort((a, b) => b[1] - a[1])[0];

    const businessData = {
      today: todayStr,
      dayOfWeek,
      todayAppointments: allToday.length,
      groomersWorking,
      firstAppointmentTime: allToday[0]?.time?.slice(0, 5) || "None",
      todayExpectedRevenue: `£${todayRevenue.toFixed(0)}`,
      thisWeekRevenue: `£${thisWeekRevenue.toFixed(0)}`,
      lastMonthSameWeekRevenue: `£${lastMonthWeekRevenue.toFixed(0)}`,
      cancellationsLast48Hours: cancellationCount || 0,
      overdueCustomersCount: overdueCustomers.length,
      overdueCustomerNames: overdueCustomers.slice(0, 5).map(c => c.name),
      pendingScruffHandoffs: pendingHandoffs || 0,
      outstandingPayLinks: unpaidPayLinks || 0,
      monthProjectedRevenue: `£${monthRevenue.toFixed(0)}`,
      busiestGroomerToday: busiestGroomer ? `${busiestGroomer[0]} (${busiestGroomer[1]} appointments)` : "None",
      newCustomersThisWeek: newCustomers.length,
    };

    // Call Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a smart business assistant for Fluff & Scruff Studio, a dog grooming salon in Hornchurch. You give the owner a warm, friendly, concise morning briefing. Maximum 4-5 sentences. Be conversational and human. Point out anything that needs attention today. If everything looks good say so. Never use bullet points. Write like a helpful colleague giving a quick update over coffee.`,
          },
          {
            role: "user",
            content: `Here is today's business data:\n${JSON.stringify(businessData, null, 2)}\n\nGive me my morning briefing.`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      throw new Error("AI briefing unavailable");
    }

    const aiData = await aiRes.json();
    const briefingText = aiData.choices?.[0]?.message?.content || "Unable to generate briefing.";

    const result = {
      text: briefingText,
      generatedAt: new Date().toISOString(),
      data: businessData,
    };

    // Cache in site_config
    await supabase.from("site_config").upsert({
      key: "daily_briefing",
      value: result as any,
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("daily-briefing error:", error);
    return new Response(
      JSON.stringify({ error: "AI briefing unavailable right now — please try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
