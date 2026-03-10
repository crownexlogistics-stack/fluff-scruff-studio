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

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];
    const monthName = today.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    // Last month
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0];
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];

    // Last year same month
    const lastYearStart = new Date(today.getFullYear() - 1, today.getMonth(), 1).toISOString().split("T")[0];
    const lastYearEnd = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0).toISOString().split("T")[0];

    // This month bookings
    const { data: thisMonthBookings } = await supabase
      .from("bookings")
      .select("total_price, status, booking_date, staff_id, is_groomers_own_customer, deposit_paid")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd);

    const completed = (thisMonthBookings || []).filter(b => b.status === "Completed" || (b.booking_date <= todayStr && b.status !== "Cancelled"));
    const upcoming = (thisMonthBookings || []).filter(b => b.booking_date > todayStr && b.status !== "Cancelled");
    const cancelled = (thisMonthBookings || []).filter(b => b.status === "Cancelled");

    const totalRevenue = (thisMonthBookings || []).filter(b => b.status !== "Cancelled").reduce((s, b) => s + Number(b.total_price || 0), 0);
    const completedRevenue = completed.reduce((s, b) => s + Number(b.total_price || 0), 0);
    const upcomingRevenue = upcoming.reduce((s, b) => s + Number(b.total_price || 0), 0);

    // Last month revenue
    const { data: lastMonthData } = await supabase
      .from("bookings")
      .select("total_price")
      .gte("booking_date", lastMonthStart)
      .lte("booking_date", lastMonthEnd)
      .not("status", "eq", "Cancelled");
    const lastMonthRevenue = (lastMonthData || []).reduce((s, b) => s + Number(b.total_price || 0), 0);

    // Last year same month revenue
    const { data: lastYearData } = await supabase
      .from("bookings")
      .select("total_price")
      .gte("booking_date", lastYearStart)
      .lte("booking_date", lastYearEnd)
      .not("status", "eq", "Cancelled");
    const lastYearRevenue = (lastYearData || []).reduce((s, b) => s + Number(b.total_price || 0), 0);

    // Commission records this month
    const { data: commissions } = await supabase
      .from("commission_records")
      .select("groomer_pay")
      .gte("created_at", `${monthStart}T00:00:00`)
      .lte("created_at", `${monthEnd}T23:59:59`);
    const groomerPayPaid = (commissions || []).reduce((s, c) => s + Number(c.groomer_pay || 0), 0);

    // Estimate upcoming groomer pay
    const groomerPayUpcoming = upcoming.reduce((s, b) => {
      const rate = b.is_groomers_own_customer ? 0.5 : 0.4;
      return s + Number(b.total_price || 0) * rate;
    }, 0);

    // Expenses this month
    const { data: recurringExpenses } = await supabase
      .from("expenses")
      .select("amount, frequency, recurring_start_date, recurring_end_date")
      .eq("expense_type", "recurring");

    const { data: oneOffExpenses } = await supabase
      .from("expenses")
      .select("amount")
      .eq("expense_type", "one_off")
      .gte("expense_date", monthStart)
      .lte("expense_date", monthEnd);

    // Simple monthly expense calculation
    let totalExpenses = (oneOffExpenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    (recurringExpenses || []).forEach(e => {
      const freq = e.frequency || "monthly";
      if (freq === "weekly") totalExpenses += Number(e.amount) * 4.33;
      else if (freq === "annual") totalExpenses += Number(e.amount) / 12;
      else totalExpenses += Number(e.amount);
    });

    const totalGroomerPay = groomerPayPaid + groomerPayUpcoming;
    const netProfit = totalRevenue - totalGroomerPay - totalExpenses;
    const projectedProfit = totalRevenue - totalGroomerPay - totalExpenses;

    // Busiest day
    const dayCounts: Record<string, number> = {};
    (thisMonthBookings || []).filter(b => b.status !== "Cancelled").forEach(b => {
      dayCounts[b.booking_date] = (dayCounts[b.booking_date] || 0) + 1;
    });
    const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

    // Best groomer
    const { data: staff } = await supabase.from("staff").select("id, name").ilike("role", "%groomer%");
    const staffMap = new Map((staff || []).map(s => [s.id, s.name]));
    const groomerRevenue: Record<string, number> = {};
    (thisMonthBookings || []).filter(b => b.status !== "Cancelled" && b.staff_id).forEach(b => {
      const name = staffMap.get(b.staff_id!) || "Unknown";
      groomerRevenue[name] = (groomerRevenue[name] || 0) + Number(b.total_price || 0);
    });
    const bestGroomer = Object.entries(groomerRevenue).sort((a, b) => b[1] - a[1])[0];

    const avgBookingValue = (thisMonthBookings || []).filter(b => b.status !== "Cancelled").length > 0
      ? totalRevenue / (thisMonthBookings || []).filter(b => b.status !== "Cancelled").length
      : 0;

    const financeData = {
      month: monthName,
      totalRevenue: `£${totalRevenue.toFixed(0)}`,
      lastMonthRevenue: `£${lastMonthRevenue.toFixed(0)}`,
      lastYearSameMonthRevenue: lastYearRevenue > 0 ? `£${lastYearRevenue.toFixed(0)}` : "No data",
      totalGroomerPay: `£${totalGroomerPay.toFixed(0)}`,
      groomerPayBreakdown: `£${groomerPayPaid.toFixed(0)} paid + £${groomerPayUpcoming.toFixed(0)} estimated upcoming`,
      totalExpenses: `£${totalExpenses.toFixed(0)}`,
      netProfit: `£${netProfit.toFixed(0)}`,
      projectedEndOfMonthProfit: `£${projectedProfit.toFixed(0)}`,
      breakeven: netProfit >= 0 ? "Reached" : `£${Math.abs(netProfit).toFixed(0)} short`,
      completedAppointments: completed.length,
      upcomingAppointments: upcoming.length,
      cancellations: cancelled.length,
      averageBookingValue: `£${avgBookingValue.toFixed(0)}`,
      busiestDay: busiestDay ? `${busiestDay[0]} (${busiestDay[1]} bookings)` : "None yet",
      bestPerformingGroomer: bestGroomer ? `${bestGroomer[0]} (£${bestGroomer[1].toFixed(0)})` : "None yet",
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a friendly financial advisor for a small dog grooming salon. Explain the business finances in plain simple English that a non-financial person can understand. Be honest — if numbers look concerning say so kindly. If things look good say so enthusiastically. Maximum 5-6 sentences. No jargon. No bullet points. Sound like a trusted advisor having a honest conversation. End with ONE specific actionable suggestion for improving the financial position.`,
        messages: [
          {
            role: "user",
            content: `Please explain this month's finances for my salon:\n${JSON.stringify(financeData, null, 2)}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      throw new Error("AI unavailable");
    }

    const anthropicData = await anthropicRes.json();
    const explanation = anthropicData.content?.[0]?.text || "Unable to generate explanation.";

    return new Response(
      JSON.stringify({ text: explanation, data: financeData, generatedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("finance-explainer error:", error);
    return new Response(
      JSON.stringify({ error: "AI briefing unavailable right now — please try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
