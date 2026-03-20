import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchContextData(supabaseAdmin: any, latestMessage: string) {
  const msg = latestMessage.toLowerCase();
  const context: Record<string, any> = {};

  // Always fetch base context
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [todayBookings, weekRevenue, unpaidDeposits, activePackages] = await Promise.all([
    supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("booking_date", today).in("status", ["Pending", "Confirmed"]),
    supabaseAdmin.from("bookings").select("total_price, deposit_paid, final_charge").gte("booking_date", weekAgo).in("status", ["Confirmed", "Completed"]),
    supabaseAdmin.from("bookings").select("id, customer_name, total_price, deposit_paid, staff_id").eq("status", "Pending").eq("deposit_paid", 0),
    supabaseAdmin.from("package_bookings").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const weekTotal = (weekRevenue.data || []).reduce((s: number, b: any) => s + (b.final_charge || b.total_price || 0), 0);

  context.base = {
    todays_bookings_count: todayBookings.count || 0,
    this_weeks_revenue: `£${weekTotal.toFixed(2)}`,
    unpaid_deposits_count: (unpaidDeposits.data || []).length,
    unpaid_deposits_total: `£${(unpaidDeposits.data || []).reduce((s: number, b: any) => s + (b.total_price || 0), 0).toFixed(2)}`,
    active_packages_count: activePackages.count || 0,
  };

  // Booking/payment context
  if (/booking|payment|deposit|appoint|revenue|money|income/.test(msg)) {
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_name, dog_name, booking_date, booking_time, status, total_price, deposit_paid, final_charge, staff_id, booking_source")
      .order("booking_date", { ascending: false })
      .limit(50);

    const { data: staff } = await supabaseAdmin.from("staff").select("id, name");
    const staffMap = Object.fromEntries((staff || []).map((s: any) => [s.id, s.name]));

    context.recent_bookings = (bookings || []).map((b: any) => ({
      ...b,
      groomer: staffMap[b.staff_id] || "Unassigned",
    }));
  }

  // Customer context
  if (/customer|client|new.*week|retention|loyal/.test(msg)) {
    const { data: recentCustomers } = await supabaseAdmin
      .from("bookings")
      .select("customer_name, customer_email")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(100);

    const uniqueNewEmails = new Set((recentCustomers || []).map((c: any) => c.customer_email?.toLowerCase()).filter(Boolean));

    const { data: topCustomers } = await supabaseAdmin
      .from("bookings")
      .select("customer_name, customer_email")
      .in("status", ["Confirmed", "Completed"]);

    const visitCounts: Record<string, { name: string; count: number }> = {};
    (topCustomers || []).forEach((b: any) => {
      const key = b.customer_email?.toLowerCase();
      if (!key) return;
      if (!visitCounts[key]) visitCounts[key] = { name: b.customer_name, count: 0 };
      visitCounts[key].count++;
    });

    const topList = Object.values(visitCounts).sort((a, b) => b.count - a.count).slice(0, 15);

    context.customers = {
      new_this_week: uniqueNewEmails.size,
      top_customers_by_visits: topList,
    };
  }

  // Staff/groomer context
  if (/groomer|staff|commission|performance|team/.test(msg)) {
    const { data: staff } = await supabaseAdmin.from("staff").select("id, name, commission_rate, is_active");
    const { data: commissions } = await supabaseAdmin
      .from("commission_records")
      .select("staff_id, groomer_pay, total_price, booking_source")
      .gte("created_at", monthStart);

    const { data: weekBookings } = await supabaseAdmin
      .from("bookings")
      .select("staff_id, id")
      .gte("booking_date", weekAgo)
      .in("status", ["Confirmed", "Completed"]);

    const commByStaff: Record<string, { pay: number; revenue: number; count: number }> = {};
    (commissions || []).forEach((c: any) => {
      if (!commByStaff[c.staff_id]) commByStaff[c.staff_id] = { pay: 0, revenue: 0, count: 0 };
      commByStaff[c.staff_id].pay += c.groomer_pay || 0;
      commByStaff[c.staff_id].revenue += c.total_price || 0;
      commByStaff[c.staff_id].count++;
    });

    const weekByStaff: Record<string, number> = {};
    (weekBookings || []).forEach((b: any) => {
      weekByStaff[b.staff_id] = (weekByStaff[b.staff_id] || 0) + 1;
    });

    context.staff_performance = (staff || []).filter((s: any) => s.is_active).map((s: any) => ({
      name: s.name,
      commission_rate: s.commission_rate,
      month_pay: `£${(commByStaff[s.id]?.pay || 0).toFixed(2)}`,
      month_revenue: `£${(commByStaff[s.id]?.revenue || 0).toFixed(2)}`,
      month_bookings: commByStaff[s.id]?.count || 0,
      week_bookings: weekByStaff[s.id] || 0,
    }));
  }

  // Marketing context
  if (/campaign|sms|email|marketing|promot/.test(msg)) {
    const { data: emailCampaigns } = await supabaseAdmin
      .from("email_campaigns")
      .select("id, subject, status, emails_sent, opens, clicks, unique_opens, unique_clicks, sent_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: smsCampaigns } = await supabaseAdmin
      .from("bulk_sms_log")
      .select("campaign_name, status, delivery_status, sent_at")
      .order("sent_at", { ascending: false })
      .limit(50);

    context.marketing = { email_campaigns: emailCampaigns, sms_recent: smsCampaigns };
  }

  // Package context
  if (/package|deal|bundle/.test(msg)) {
    const { data: packages } = await supabaseAdmin
      .from("package_bookings")
      .select("id, customer_name, dog_name, package_type, sessions_count, total_paid, status, tc_signed, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: sessions } = await supabaseAdmin
      .from("package_sessions")
      .select("package_booking_id, status");

    const sessionsByPkg: Record<string, { used: number; total: number }> = {};
    (sessions || []).forEach((s: any) => {
      if (!sessionsByPkg[s.package_booking_id]) sessionsByPkg[s.package_booking_id] = { used: 0, total: 0 };
      sessionsByPkg[s.package_booking_id].total++;
      if (s.status === "used") sessionsByPkg[s.package_booking_id].used++;
    });

    context.packages = (packages || []).map((p: any) => ({
      ...p,
      sessions_used: sessionsByPkg[p.id]?.used || 0,
      sessions_total: sessionsByPkg[p.id]?.total || p.sessions_count,
    }));
  }

  // Fraud/anomaly context
  if (/fraud|anomal|suspicious|discrepan|wrong|investigate|check/.test(msg)) {
    const { data: anomalies } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_name, booking_date, total_price, final_charge, deposit_paid, staff_id, payment_anomaly, anomaly_type, anomaly_reviewed")
      .eq("payment_anomaly", true)
      .order("booking_date", { ascending: false })
      .limit(20);

    const { data: staff } = await supabaseAdmin.from("staff").select("id, name");
    const staffMap = Object.fromEntries((staff || []).map((s: any) => [s.id, s.name]));

    context.anomalies = (anomalies || []).map((b: any) => ({
      ...b,
      groomer: staffMap[b.staff_id] || "Unknown",
    }));

    const { data: auditFlags } = await supabaseAdmin
      .from("audit_logs")
      .select("action, details, created_at")
      .eq("action", "UNMATCHED_PAYMENT")
      .order("created_at", { ascending: false })
      .limit(5);

    context.unmatched_payments = auditFlags;
  }

  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Verify director role
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

    // Check director role
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

    const latestMessage = messages[messages.length - 1]?.content || "";

    // Fetch context data
    const contextData = await fetchContextData(supabaseAdmin, latestMessage);

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

    // Stream from Claude
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
