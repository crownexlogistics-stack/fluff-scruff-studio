import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchAllContext(supabaseAdmin: any) {
  const context: Record<string, any> = {};
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

  // Fetch everything in parallel
  const [
    monthBookings,
    staff,
    commissions,
    activePackages,
    packageSessions,
    emailCampaigns,
    smsCampaigns,
    allBookingEmails,
    todayBookingsResult,
  ] = await Promise.all([
    supabaseAdmin.from("bookings")
      .select("id, customer_name, dog_name, booking_date, booking_time, status, total_price, deposit_paid, final_charge, staff_id, service_id, booking_source, customer_email, stripe_payment_id")
      .gte("booking_date", monthStart).lte("booking_date", monthEnd)
      .order("booking_date", { ascending: true }),
    supabaseAdmin.from("staff").select("id, name, commission_rate, is_active"),
    supabaseAdmin.from("commission_records")
      .select("staff_id, groomer_pay, total_price, booking_source, commission_rate")
      .gte("created_at", monthStart),
    supabaseAdmin.from("package_bookings")
      .select("id, customer_name, dog_name, package_type, sessions_count, total_paid, status, tc_signed, created_at")
      .eq("status", "active"),
    supabaseAdmin.from("package_sessions").select("package_booking_id, status"),
    supabaseAdmin.from("email_campaigns")
      .select("id, subject, status, emails_sent, opens, clicks, unique_opens, unique_clicks, sent_at")
      .order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("bulk_sms_log")
      .select("campaign_name, status, delivery_status, sent_at")
      .order("sent_at", { ascending: false }).limit(50),
    supabaseAdmin.from("bookings")
      .select("customer_email").order("created_at", { ascending: true }),
    supabaseAdmin.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_date", today).in("status", ["Pending", "Confirmed"]),
  ]);

  const staffMap = Object.fromEntries((staff.data || []).map((s: any) => [s.id, s.name]));
  const bookings = monthBookings.data || [];

  // Status counts and sums
  const statusSummary: Record<string, { count: number; revenue: number }> = {};
  let totalDepositsCollected = 0;
  let futureBookedRevenue = 0;

  bookings.forEach((b: any) => {
    if (!statusSummary[b.status]) statusSummary[b.status] = { count: 0, revenue: 0 };
    statusSummary[b.status].count++;
    statusSummary[b.status].revenue += b.total_price || 0;
    totalDepositsCollected += b.deposit_paid || 0;
    if (b.booking_date >= today && (b.status === "Pending" || b.status === "Confirmed")) {
      futureBookedRevenue += b.total_price || 0;
    }
  });

  const bookedRevenue = bookings.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
  const earnedRevenue = bookings.filter((b: any) => b.status === "Completed").reduce((s: number, b: any) => s + (b.total_price || 0), 0);

  context.bookings_summary = {
    month: monthStart,
    today_count: todayBookingsResult.count || 0,
    total_booked_revenue: `£${bookedRevenue.toFixed(2)}`,
    earned_revenue_completed: `£${earnedRevenue.toFixed(2)}`,
    deposits_collected: `£${totalDepositsCollected.toFixed(2)}`,
    future_booked_revenue: `£${futureBookedRevenue.toFixed(2)}`,
    by_status: Object.fromEntries(
      Object.entries(statusSummary).map(([k, v]) => [k, { count: v.count, revenue: `£${v.revenue.toFixed(2)}` }])
    ),
  };

  // Recent bookings detail
  context.bookings_this_month = bookings.map((b: any) => ({
    id: b.id,
    customer_name: b.customer_name,
    dog_name: b.dog_name,
    date: b.booking_date,
    time: b.booking_time,
    status: b.status,
    total_price: b.total_price,
    deposit_paid: b.deposit_paid,
    groomer: staffMap[b.staff_id] || "Unassigned",
    source: b.booking_source,
    has_stripe: !!b.stripe_payment_id,
  }));

  // Commission by groomer
  const commByStaff: Record<string, { pay: number; revenue: number; count: number }> = {};
  (commissions.data || []).forEach((c: any) => {
    if (!commByStaff[c.staff_id]) commByStaff[c.staff_id] = { pay: 0, revenue: 0, count: 0 };
    commByStaff[c.staff_id].pay += c.groomer_pay || 0;
    commByStaff[c.staff_id].revenue += c.total_price || 0;
    commByStaff[c.staff_id].count++;
  });

  context.staff_performance = (staff.data || []).filter((s: any) => s.is_active).map((s: any) => ({
    name: s.name,
    commission_rate: s.commission_rate,
    month_pay: `£${(commByStaff[s.id]?.pay || 0).toFixed(2)}`,
    month_revenue: `£${(commByStaff[s.id]?.revenue || 0).toFixed(2)}`,
    month_bookings: commByStaff[s.id]?.count || 0,
  }));

  // Packages
  const sessionsByPkg: Record<string, { used: number; total: number }> = {};
  (packageSessions.data || []).forEach((s: any) => {
    if (!sessionsByPkg[s.package_booking_id]) sessionsByPkg[s.package_booking_id] = { used: 0, total: 0 };
    sessionsByPkg[s.package_booking_id].total++;
    if (s.status === "used") sessionsByPkg[s.package_booking_id].used++;
  });

  context.active_packages = (activePackages.data || []).map((p: any) => ({
    customer_name: p.customer_name,
    dog_name: p.dog_name,
    package_type: p.package_type,
    total_paid: `£${(p.total_paid || 0).toFixed(2)}`,
    tc_signed: p.tc_signed,
    sessions_used: sessionsByPkg[p.id]?.used || 0,
    sessions_total: sessionsByPkg[p.id]?.total || p.sessions_count,
  }));

  // Customers
  const allEmails = (allBookingEmails.data || []).map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean);
  const uniqueCustomers = new Set(allEmails);
  
  // New customers this month - first booking ever
  const firstBookingByEmail: Record<string, string> = {};
  (allBookingEmails.data || []).forEach((b: any) => {
    const email = b.customer_email?.toLowerCase();
    if (!email) return;
    // The bookings are ordered by created_at ascending, so first occurrence is the first booking
  });
  // Simpler: customers whose first booking in bookings table is this month
  const monthCustomerEmails = bookings.map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean);
  const newThisMonth = monthCustomerEmails.filter((email: string) => {
    // Check if this email has no bookings before this month
    return !allEmails.some((e: string) => e === email); // This won't work perfectly; use the count approach
  });

  context.customers = {
    total_unique_customers: uniqueCustomers.size,
    note: "Customer counts based on unique emails in bookings table",
  };

  // Campaigns
  context.email_campaigns = emailCampaigns.data || [];
  context.sms_campaigns_recent = smsCampaigns.data || [];

  // Anomalies
  const anomalies = bookings.filter((b: any) => b.status === "Pending" && b.deposit_paid === 0);
  context.unpaid_deposits = {
    count: anomalies.length,
    total_value: `£${anomalies.reduce((s: number, b: any) => s + (b.total_price || 0), 0).toFixed(2)}`,
    bookings: anomalies.slice(0, 20).map((b: any) => ({
      customer_name: b.customer_name,
      date: b.booking_date,
      total_price: b.total_price,
      groomer: staffMap[b.staff_id] || "Unassigned",
    })),
  };

  return context;
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
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "director") {
      return new Response(JSON.stringify({ error: "Director access only" }), { status: 403, headers: corsHeaders });
    }

    const { messages, imageBase64, imageMediaType, fileContent } = await req.json();
    if (!messages?.length) throw new Error("No messages provided");

    // Fetch ALL context data on every request
    const contextData = await fetchAllContext(supabaseAdmin);

    const systemPrompt = `You are a private AI analyst and assistant for Sevak, the director of Fluff & Scruff Studio, a dog grooming salon in Hornchurch, Essex. You have access to live data from the salon management system.

Your job is to answer questions accurately using the data provided. Be direct, honest and specific. Use actual numbers from the data. If something looks wrong or suspicious, flag it clearly. If you cannot find the answer in the data provided, say so clearly rather than guessing.

You can help with:
- Investigating payments and bookings
- Checking customer records
- Analysing groomer performance
- Reviewing campaign results
- Spotting anomalies or discrepancies
- Reviewing package deal status
- Analysing any uploaded screenshots or files

Always refer to money in pounds sterling (£). Always refer to the director as Sevak. Keep responses clear and structured. Use bullet points for lists of data. Flag urgent issues with a warning emoji 🚨. Use ✅ for all-clear items.

Here is the current live data from the system:
${JSON.stringify(contextData, null, 2)}`;

    // Build Claude messages
    const claudeMessages = messages.map((m: any, i: number) => {
      if (i === messages.length - 1 && (imageBase64 || fileContent)) {
        const content: any[] = [];
        if (imageBase64) {
          content.push({
            type: "image",
            source: { type: "base64", media_type: imageMediaType || "image/png", data: imageBase64 },
          });
        }
        if (fileContent) {
          content.push({ type: "text", text: `[Attached file content]:\n${fileContent}` });
        }
        content.push({ type: "text", text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

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
    console.error("director-assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
