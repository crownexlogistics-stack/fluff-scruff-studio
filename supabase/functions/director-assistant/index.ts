import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getDateContext() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

  return {
    today,
    current_week_start: weekStart.toISOString().split("T")[0],
    current_week_end: weekEnd.toISOString().split("T")[0],
    last_week_start: lastWeekStart.toISOString().split("T")[0],
    last_week_end: lastWeekEnd.toISOString().split("T")[0],
    current_month: now.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    current_month_start: monthStart.toISOString().split("T")[0],
    current_month_end: monthEnd.toISOString().split("T")[0],
    last_month_start: lastMonthStart.toISOString().split("T")[0],
    last_month_end: lastMonthEnd.toISOString().split("T")[0],
    prev_month_start: prevMonthStart.toISOString().split("T")[0],
    prev_month_end: prevMonthEnd.toISOString().split("T")[0],
    year_start: yearStart.toISOString().split("T")[0],
    last_year_start: lastYearStart.toISOString().split("T")[0],
    last_year_end: lastYearEnd.toISOString().split("T")[0],
  };
}

function summarizeByMonth(bookings: any[], dateField = "booking_date", revenueField = "total_price") {
  const byMonth: Record<string, { revenue: number; count: number }> = {};
  for (const b of bookings) {
    const d = b[dateField];
    if (!d) continue;
    const month = d.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = { revenue: 0, count: 0 };
    byMonth[month].revenue += Number(b[revenueField] || 0);
    byMonth[month].count++;
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => ({ month, revenue: `£${data.revenue.toFixed(2)}`, bookings_count: data.count }));
}

async function fetchAllContext(supabaseAdmin: any) {
  const context: Record<string, any> = {};
  const dates = getDateContext();
  context.current_date_context = dates;
  const { today, current_month_start: monthStart, current_month_end: monthEnd,
    last_month_start: lastMonthStart, last_month_end: lastMonthEnd,
    current_week_start: weekStart, current_week_end: weekEnd,
    last_week_start: lastWeekStart, last_week_end: lastWeekEnd } = dates;

  // Fetch everything in parallel
  const [
    allBookingsResult,
    allMigratedResult,
    staff,
    allCommissions,
    allPackageBookings,
    allPackageSessions,
    emailCampaigns,
    bulkSmsLog,
    emailEvents,
    expenses,
    auditLog,
    activityLog,
    packageTcSigs,
    failedSms,
    academyEnquiries,
    addOns,
    services,
    migratedCustomers,
  ] = await Promise.all([
    supabaseAdmin.from("bookings")
      .select("id, customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, status, total_price, deposit_paid, final_charge, staff_id, service_id, booking_source, stripe_payment_id, notes, attributed_campaign_id, attributed_sms_campaign, created_at, is_groomers_own_customer")
      .order("booking_date", { ascending: false })
      .limit(1000),
    supabaseAdmin.from("migrated_bookings")
      .select("id, migrated_customer_id, dog_name, dog_breed, service_name, staff_name, booking_date, booking_time, payment_status, total_price, deposit_paid, amount_due, notes")
      .order("booking_date", { ascending: false })
      .limit(1000),
    supabaseAdmin.from("staff").select("id, name, commission_rate, is_active, created_at"),
    supabaseAdmin.from("commission_records")
      .select("id, staff_id, groomer_pay, studio_share, total_price, commission_type, commission_rate, booking_source, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin.from("package_bookings")
      .select("id, customer_name, dog_name, package_type, sessions_count, total_paid, status, tc_signed, created_at, customer_email")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("package_sessions").select("id, package_booking_id, status, booking_id"),
    supabaseAdmin.from("email_campaigns")
      .select("id, subject, status, emails_sent, opens, clicks, unique_opens, unique_clicks, sent_at, segment")
      .order("created_at", { ascending: false }).limit(30),
    supabaseAdmin.from("bulk_sms_log")
      .select("campaign_name, status, delivery_status, sent_at, phone, error_message")
      .order("sent_at", { ascending: false }).limit(200),
    supabaseAdmin.from("email_events")
      .select("campaign_id, event_type, email, created_at")
      .order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("expenses").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("booking_audit_log")
      .select("id, booking_id, event_type, note, performed_at")
      .order("performed_at", { ascending: false }).limit(100),
    supabaseAdmin.from("groomer_activity_log")
      .select("id, staff_id, action_type, action_summary, performed_at")
      .order("performed_at", { ascending: false }).limit(200),
    supabaseAdmin.from("package_tc_signatures")
      .select("id, package_booking_id, signed_at, status")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("bulk_sms_log")
      .select("campaign_name, error_message, sent_at")
      .eq("status", "failed")
      .order("sent_at", { ascending: false }).limit(50),
    supabaseAdmin.from("academy_enquiries")
      .select("id, first_name, last_name, email, phone, programme_interest, status, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("add_ons").select("id, name, price"),
    supabaseAdmin.from("services").select("id, name"),
    supabaseAdmin.from("migrated_customers")
      .select("id, full_name, email, phone, status, sms_opt_out, sms_unreachable")
      .limit(500),
  ]);

  const allBookings = allBookingsResult.data || [];
  const allMigrated = allMigratedResult.data || [];
  const staffList = staff.data || [];
  const commissions = allCommissions.data || [];
  const staffMap = Object.fromEntries(staffList.map((s: any) => [s.id, s.name]));
  const serviceMap = Object.fromEntries((services.data || []).map((s: any) => [s.id, s.name]));

  // Revenue helper
  const bookingRevenue = (b: any) => Number(b.final_charge && Number(b.final_charge) > 0 ? b.final_charge : b.total_price || 0);

  // ── BOOKINGS SUMMARY ──
  const completedBookings = allBookings.filter((b: any) => b.status === "Completed");
  const completedMigrated = allMigrated.filter((b: any) => b.payment_status === "Completed");

  const totalRevenueAllTime = completedBookings.reduce((s: number, b: any) => s + bookingRevenue(b), 0)
    + completedMigrated.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  // Monthly revenue for last 12 months
  const revenueByMonth = summarizeByMonth(completedBookings, "booking_date", "total_price");
  const migratedByMonth = summarizeByMonth(completedMigrated, "booking_date", "total_price");

  // Period calculations
  const filterByDateRange = (arr: any[], field: string, start: string, end: string) =>
    arr.filter((b: any) => b[field] >= start && b[field] <= end);

  const completedThisMonth = filterByDateRange(completedBookings, "booking_date", monthStart, monthEnd);
  const completedLastMonth = filterByDateRange(completedBookings, "booking_date", lastMonthStart, lastMonthEnd);
  const completedThisWeek = filterByDateRange(completedBookings, "booking_date", weekStart, weekEnd);
  const completedLastWeek = filterByDateRange(completedBookings, "booking_date", lastWeekStart, lastWeekEnd);
  const completedMigratedThisMonth = filterByDateRange(completedMigrated, "booking_date", monthStart, monthEnd);
  const completedMigratedLastMonth = filterByDateRange(completedMigrated, "booking_date", lastMonthStart, lastMonthEnd);

  const revenueThisMonth = completedThisMonth.reduce((s: number, b: any) => s + bookingRevenue(b), 0)
    + completedMigratedThisMonth.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const revenueLastMonth = completedLastMonth.reduce((s: number, b: any) => s + bookingRevenue(b), 0)
    + completedMigratedLastMonth.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const revenueThisWeek = completedThisWeek.reduce((s: number, b: any) => s + bookingRevenue(b), 0);
  const revenueLastWeek = completedLastWeek.reduce((s: number, b: any) => s + bookingRevenue(b), 0);

  // Future confirmed bookings
  const futureConfirmed = allBookings.filter((b: any) => b.booking_date >= today && (b.status === "Pending" || b.status === "Confirmed"));
  const projectedThisMonth = revenueThisMonth + futureConfirmed
    .filter((b: any) => b.booking_date <= monthEnd)
    .reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  // Next month projection
  const nextMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split("T")[0];
  const nextMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString().split("T")[0];
  const nextMonthBookings = futureConfirmed.filter((b: any) => b.booking_date >= nextMonthStart && b.booking_date <= nextMonthEnd);
  const projectedNextMonth = nextMonthBookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  // Today
  const todayBookings = allBookings.filter((b: any) => b.booking_date === today);
  const todayCompleted = todayBookings.filter((b: any) => b.status === "Completed");
  const todayRevenue = todayCompleted.reduce((s: number, b: any) => s + bookingRevenue(b), 0);

  context.revenue_summary = {
    total_all_time: `£${totalRevenueAllTime.toFixed(2)}`,
    this_month: `£${revenueThisMonth.toFixed(2)}`,
    last_month: `£${revenueLastMonth.toFixed(2)}`,
    this_week: `£${revenueThisWeek.toFixed(2)}`,
    last_week: `£${revenueLastWeek.toFixed(2)}`,
    today: `£${todayRevenue.toFixed(2)}`,
    projected_this_month: `£${projectedThisMonth.toFixed(2)}`,
    projected_next_month: `£${projectedNextMonth.toFixed(2)}`,
    next_month_booked_count: nextMonthBookings.length,
    revenue_by_month_last_12: revenueByMonth.slice(0, 12),
    migrated_revenue_by_month: migratedByMonth.slice(0, 12),
    completed_revenue_exact: `£${revenueThisMonth.toFixed(2)}`,
  };

  // Recent 90 days detail
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysStr = ninetyDaysAgo.toISOString().split("T")[0];
  const recentBookings = allBookings
    .filter((b: any) => b.booking_date >= ninetyDaysStr)
    .map((b: any) => ({
      ...b,
      groomer: staffMap[b.staff_id] || "Unassigned",
      service_name: serviceMap[b.service_id] || "Unknown",
      effective_revenue: bookingRevenue(b),
    }));

  context.recent_bookings_90_days = recentBookings;
  context.today_bookings = todayBookings.map((b: any) => ({
    ...b,
    groomer: staffMap[b.staff_id] || "Unassigned",
    service_name: serviceMap[b.service_id] || "Unknown",
  }));
  context.future_confirmed_bookings = futureConfirmed.slice(0, 100).map((b: any) => ({
    ...b,
    groomer: staffMap[b.staff_id] || "Unassigned",
    service_name: serviceMap[b.service_id] || "Unknown",
  }));

  // ── STAFF PERFORMANCE ──
  const commByStaff: Record<string, { pay: number; revenue: number; count: number; thisMonth: number; thisMonthPay: number; lastMonth: number; lastMonthPay: number }> = {};
  for (const c of commissions) {
    if (!commByStaff[c.staff_id]) commByStaff[c.staff_id] = { pay: 0, revenue: 0, count: 0, thisMonth: 0, thisMonthPay: 0, lastMonth: 0, lastMonthPay: 0 };
    commByStaff[c.staff_id].pay += Number(c.groomer_pay || 0);
    commByStaff[c.staff_id].revenue += Number(c.total_price || 0);
    commByStaff[c.staff_id].count++;
    if (c.created_at >= monthStart && c.created_at <= monthEnd + "T23:59:59") {
      commByStaff[c.staff_id].thisMonth++;
      commByStaff[c.staff_id].thisMonthPay += Number(c.groomer_pay || 0);
    }
    if (c.created_at >= lastMonthStart && c.created_at <= lastMonthEnd + "T23:59:59") {
      commByStaff[c.staff_id].lastMonth++;
      commByStaff[c.staff_id].lastMonthPay += Number(c.groomer_pay || 0);
    }
  }

  // Per groomer booking counts this month and next month
  const groomerBookingsThisMonth: Record<string, number> = {};
  const groomerBookingsNextMonth: Record<string, number> = {};
  for (const b of allBookings) {
    if (!b.staff_id) continue;
    if (b.booking_date >= monthStart && b.booking_date <= monthEnd) {
      groomerBookingsThisMonth[b.staff_id] = (groomerBookingsThisMonth[b.staff_id] || 0) + 1;
    }
    if (b.booking_date >= nextMonthStart && b.booking_date <= nextMonthEnd) {
      groomerBookingsNextMonth[b.staff_id] = (groomerBookingsNextMonth[b.staff_id] || 0) + 1;
    }
  }

  context.staff_performance = staffList.filter((s: any) => s.is_active).map((s: any) => {
    const c = commByStaff[s.id] || { pay: 0, revenue: 0, count: 0, thisMonth: 0, thisMonthPay: 0, lastMonth: 0, lastMonthPay: 0 };
    return {
      name: s.name,
      commission_rate: s.commission_rate,
      total_earned_all_time: `£${c.pay.toFixed(2)}`,
      total_revenue_all_time: `£${c.revenue.toFixed(2)}`,
      total_bookings_all_time: c.count,
      earned_this_month: `£${c.thisMonthPay.toFixed(2)}`,
      bookings_this_month: groomerBookingsThisMonth[s.id] || 0,
      earned_last_month: `£${c.lastMonthPay.toFixed(2)}`,
      bookings_next_month: groomerBookingsNextMonth[s.id] || 0,
      avg_booking_value: c.count > 0 ? `£${(c.revenue / c.count).toFixed(2)}` : "£0.00",
    };
  });

  // ── CUSTOMERS ──
  const uniqueEmails = new Set(allBookings.map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean));
  const firstBookingByEmail: Record<string, string> = {};
  for (const b of [...allBookings].reverse()) {
    const email = b.customer_email?.toLowerCase();
    if (email && !firstBookingByEmail[email]) firstBookingByEmail[email] = b.booking_date;
  }
  const newThisMonth = Object.values(firstBookingByEmail).filter(d => d >= monthStart && d <= monthEnd).length;
  const newLastMonth = Object.values(firstBookingByEmail).filter(d => d >= lastMonthStart && d <= lastMonthEnd).length;

  const bookingCountByEmail: Record<string, number> = {};
  const lastBookingByEmail: Record<string, string> = {};
  const revenueByEmail: Record<string, number> = {};
  for (const b of allBookings) {
    const email = b.customer_email?.toLowerCase();
    if (!email) continue;
    bookingCountByEmail[email] = (bookingCountByEmail[email] || 0) + 1;
    if (!lastBookingByEmail[email] || b.booking_date > lastBookingByEmail[email]) lastBookingByEmail[email] = b.booking_date;
    revenueByEmail[email] = (revenueByEmail[email] || 0) + Number(b.total_price || 0);
  }

  const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const ninetyDays = new Date(); ninetyDays.setDate(ninetyDays.getDate() - 90);
  const sixtyStr = sixtyDaysAgo.toISOString().split("T")[0];
  const ninetyStr = ninetyDays.toISOString().split("T")[0];

  const singleVisit = Object.values(bookingCountByEmail).filter(c => c === 1).length;
  const loyalCustomers = Object.values(bookingCountByEmail).filter(c => c >= 5).length;
  const noBooking60 = Object.entries(lastBookingByEmail).filter(([, d]) => d < sixtyStr).length;
  const noBooking90 = Object.entries(lastBookingByEmail).filter(([, d]) => d < ninetyStr).length;

  const topByCount = Object.entries(bookingCountByEmail).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topByRevenue = Object.entries(revenueByEmail).sort((a, b) => b[1] - a[1]).slice(0, 20);

  // Get names for top customers
  const emailToName: Record<string, string> = {};
  for (const b of allBookings) {
    const email = b.customer_email?.toLowerCase();
    if (email && !emailToName[email]) emailToName[email] = b.customer_name;
  }

  const mcData = migratedCustomers.data || [];
  context.customers = {
    total_unique: uniqueEmails.size,
    new_this_month: newThisMonth,
    new_last_month: newLastMonth,
    single_visit_at_risk: singleVisit,
    loyal_5_plus: loyalCustomers,
    no_booking_60_days: noBooking60,
    no_booking_90_days: noBooking90,
    top_20_by_bookings: topByCount.map(([e, c]) => ({ email: e, name: emailToName[e] || e, bookings: c })),
    top_20_by_revenue: topByRevenue.map(([e, r]) => ({ email: e, name: emailToName[e] || e, revenue: `£${r.toFixed(2)}` })),
    migrated_total: mcData.length,
    migrated_sms_opt_out: mcData.filter((m: any) => m.sms_opt_out).length,
    migrated_unreachable: mcData.filter((m: any) => m.sms_unreachable).length,
  };

  // ── PACKAGES ──
  const pkgBookings = allPackageBookings.data || [];
  const pkgSessions = allPackageSessions.data || [];
  const sessionsByPkg: Record<string, { used: number; total: number }> = {};
  for (const s of pkgSessions) {
    if (!sessionsByPkg[s.package_booking_id]) sessionsByPkg[s.package_booking_id] = { used: 0, total: 0 };
    sessionsByPkg[s.package_booking_id].total++;
    if (s.status === "used") sessionsByPkg[s.package_booking_id].used++;
  }

  const activePkgs = pkgBookings.filter((p: any) => p.status === "active");
  const completedPkgs = pkgBookings.filter((p: any) => p.status === "completed");
  const cancelledPkgs = pkgBookings.filter((p: any) => p.status === "cancelled");
  const totalPkgRevenue = pkgBookings.reduce((s: number, p: any) => s + Number(p.total_paid || 0), 0);

  context.packages = {
    total_revenue_all_time: `£${totalPkgRevenue.toFixed(2)}`,
    active_count: activePkgs.length,
    active_value: `£${activePkgs.reduce((s: number, p: any) => s + Number(p.total_paid || 0), 0).toFixed(2)}`,
    completed_count: completedPkgs.length,
    cancelled_count: cancelledPkgs.length,
    unsigned_tc: pkgBookings.filter((p: any) => !p.tc_signed && p.status === "active").length,
    active_packages: activePkgs.map((p: any) => ({
      customer_name: p.customer_name,
      dog_name: p.dog_name,
      package_type: p.package_type,
      total_paid: `£${Number(p.total_paid || 0).toFixed(2)}`,
      tc_signed: p.tc_signed,
      sessions_used: sessionsByPkg[p.id]?.used || 0,
      sessions_total: sessionsByPkg[p.id]?.total || p.sessions_count,
    })),
  };

  // ── CAMPAIGNS ──
  const campaigns = emailCampaigns.data || [];
  const smsLogs = bulkSmsLog.data || [];
  const events = emailEvents.data || [];

  // Group SMS by campaign
  const smsByCampaign: Record<string, { sent: number; delivered: number; failed: number }> = {};
  for (const s of smsLogs) {
    const name = s.campaign_name || "direct";
    if (!smsByCampaign[name]) smsByCampaign[name] = { sent: 0, delivered: 0, failed: 0 };
    smsByCampaign[name].sent++;
    if (s.delivery_status === "delivered") smsByCampaign[name].delivered++;
    if (s.status === "failed") smsByCampaign[name].failed++;
  }

  context.campaigns = {
    email_campaigns: campaigns.map((c: any) => ({
      subject: c.subject,
      status: c.status,
      sent: c.emails_sent,
      opens: c.unique_opens,
      clicks: c.unique_clicks,
      sent_at: c.sent_at,
      segment: c.segment,
    })),
    sms_campaigns: Object.entries(smsByCampaign).map(([name, data]) => ({ name, ...data })),
  };

  // ── FINANCE ──
  const allExpenses = expenses.data || [];
  const thisMonthExpenses = allExpenses.filter((e: any) =>
    (e.expense_date && e.expense_date >= monthStart && e.expense_date <= monthEnd) ||
    (e.expense_type === "recurring")
  );
  const lastMonthExpenses = allExpenses.filter((e: any) =>
    e.expense_date && e.expense_date >= lastMonthStart && e.expense_date <= lastMonthEnd
  );

  const totalExpensesThisMonth = thisMonthExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalExpensesLastMonth = lastMonthExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalGroomerPayThisMonth = commissions
    .filter((c: any) => c.created_at >= monthStart && c.created_at <= monthEnd + "T23:59:59")
    .reduce((s: number, c: any) => s + Number(c.groomer_pay || 0), 0);
  const totalGroomerPayLastMonth = commissions
    .filter((c: any) => c.created_at >= lastMonthStart && c.created_at <= lastMonthEnd + "T23:59:59")
    .reduce((s: number, c: any) => s + Number(c.groomer_pay || 0), 0);

  context.finance = {
    expenses_this_month: `£${totalExpensesThisMonth.toFixed(2)}`,
    expenses_last_month: `£${totalExpensesLastMonth.toFixed(2)}`,
    groomer_pay_this_month: `£${totalGroomerPayThisMonth.toFixed(2)}`,
    groomer_pay_last_month: `£${totalGroomerPayLastMonth.toFixed(2)}`,
    net_profit_this_month: `£${(revenueThisMonth - totalExpensesThisMonth - totalGroomerPayThisMonth).toFixed(2)}`,
    net_profit_last_month: `£${(revenueLastMonth - totalExpensesLastMonth - totalGroomerPayLastMonth).toFixed(2)}`,
    trend: revenueThisMonth - totalExpensesThisMonth - totalGroomerPayThisMonth >
           revenueLastMonth - totalExpensesLastMonth - totalGroomerPayLastMonth ? "improving" : "declining",
    all_expenses: allExpenses.slice(0, 50),
  };

  // ── SYSTEM HEALTH ──
  const recentAudit = auditLog.data || [];
  const recentActivityData = activityLog.data || [];
  const tcSigs = packageTcSigs.data || [];
  const failedSmsList = failedSms.data || [];

  // Activity count per groomer per day (last 7 days)
  const activityByGroomer: Record<string, Record<string, number>> = {};
  for (const a of recentActivityData) {
    const date = a.performed_at?.split("T")[0];
    const groomer = staffMap[a.staff_id] || a.staff_id;
    if (!activityByGroomer[groomer]) activityByGroomer[groomer] = {};
    activityByGroomer[groomer][date] = (activityByGroomer[groomer][date] || 0) + 1;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString();
  const pendingOldTc = tcSigs.filter((t: any) =>
    t.status === "pending" && t.created_at && t.created_at < sevenDaysStr
  );

  context.system_health = {
    recent_audit_events: recentAudit.slice(0, 30),
    groomer_activity_last_7_days: activityByGroomer,
    pending_tc_signatures_older_than_7_days: pendingOldTc.length,
    failed_sms_last_30_days: failedSmsList.slice(0, 20),
    failed_sms_patterns: Object.entries(
      failedSmsList.reduce((acc: Record<string, number>, s: any) => {
        const msg = s.error_message || "unknown";
        acc[msg] = (acc[msg] || 0) + 1;
        return acc;
      }, {})
    ).map(([msg, count]) => ({ error: msg, count })),
  };

  // ── UNPAID DEPOSITS ──
  const unpaid = allBookings.filter((b: any) =>
    b.booking_date >= today && (b.status === "Pending" || b.status === "Confirmed") && Number(b.deposit_paid || 0) === 0
  );
  context.unpaid_deposits = {
    count: unpaid.length,
    total_value: `£${unpaid.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0).toFixed(2)}`,
    bookings: unpaid.slice(0, 30).map((b: any) => ({
      customer_name: b.customer_name,
      date: b.booking_date,
      total_price: Number(b.total_price || 0),
      groomer: staffMap[b.staff_id] || "Unassigned",
    })),
  };

  // ── ACADEMY ──
  const enquiries = academyEnquiries.data || [];
  context.academy = {
    total_enquiries: enquiries.length,
    new: enquiries.filter((e: any) => e.status === "new").length,
    contacted: enquiries.filter((e: any) => e.status === "contacted").length,
    enrolled: enquiries.filter((e: any) => e.status === "enrolled").length,
    recent: enquiries.slice(0, 10).map((e: any) => ({
      name: `${e.first_name} ${e.last_name}`,
      email: e.email,
      programme: e.programme_interest,
      status: e.status,
      submitted: e.created_at,
    })),
  };

  // ── STRIPE ──
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (STRIPE_SECRET_KEY) {
      const monthStartUnix = Math.floor(new Date(monthStart).getTime() / 1000);
      const lastMonthStartUnix = Math.floor(new Date(lastMonthStart).getTime() / 1000);
      const lastMonthEndUnix = Math.floor(new Date(lastMonthEnd + "T23:59:59").getTime() / 1000);

      const [stripeThisMonth, stripeLastMonth, payoutsRes] = await Promise.all([
        fetch(`https://api.stripe.com/v1/payment_intents?limit=100&created[gte]=${monthStartUnix}`, {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        }),
        fetch(`https://api.stripe.com/v1/payment_intents?limit=100&created[gte]=${lastMonthStartUnix}&created[lte]=${lastMonthEndUnix}`, {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        }),
        fetch(`https://api.stripe.com/v1/payouts?limit=20`, {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        }),
      ]);

      if (stripeThisMonth.ok && stripeLastMonth.ok) {
        const thisData = await stripeThisMonth.json();
        const lastData = await stripeLastMonth.json();
        const payoutsData = payoutsRes.ok ? await payoutsRes.json() : { data: [] };

        const thisSucceeded = (thisData.data || []).filter((pi: any) => pi.status === "succeeded");
        const lastSucceeded = (lastData.data || []).filter((pi: any) => pi.status === "succeeded");
        const thisFailed = (thisData.data || []).filter((pi: any) => pi.status !== "succeeded" && pi.status !== "canceled");

        context.stripe = {
          revenue_this_month: `£${(thisSucceeded.reduce((s: number, pi: any) => s + (pi.amount_received || 0), 0) / 100).toFixed(2)}`,
          revenue_last_month: `£${(lastSucceeded.reduce((s: number, pi: any) => s + (pi.amount_received || 0), 0) / 100).toFixed(2)}`,
          succeeded_count_this_month: thisSucceeded.length,
          failed_this_month: thisFailed.length,
          recent_payouts: (payoutsData.data || []).slice(0, 10).map((p: any) => ({
            amount: `£${(p.amount / 100).toFixed(2)}`,
            status: p.status,
            arrival_date: new Date(p.arrival_date * 1000).toISOString().split("T")[0],
          })),
        };
      }
    }
  } catch {
    context.stripe = { error: "Could not fetch Stripe data" };
  }

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

    const contextData = await fetchAllContext(supabaseAdmin);

    const systemPrompt = `You are Sevak's personal AI business analyst for Fluff & Scruff Studio. You have COMPLETE access to all salon data — every booking ever made, every payment, every customer, every groomer's performance, all campaigns, all expenses, and all system activity.

You can answer ANY business question including:
- Revenue projections for any future month
- Groomer performance comparisons
- Customer retention and churn analysis
- Campaign ROI and recommendations
- Financial health and profit trends
- System errors and how to fix them
- Writing Lovable prompts to fix issues

When asked about errors or system problems:
1. Look in the audit logs and error data
2. Explain what went wrong in plain English
3. Write the exact Lovable prompt needed to fix it — formatted as a code block ready to copy and paste

When writing Lovable prompts:
- Be specific about file names and functions
- Include the exact SQL if database changes are needed
- Reference the actual error message
- Give step by step implementation instructions

You have access to historical data going back to when the salon opened. Use ALL of it when answering questions — not just this month.

CRITICAL REVENUE RULES:
- Revenue for a booking is ALWAYS total_price (or final_charge if > 0). This is the final discounted amount owed.
- total_price ALREADY includes add-on prices and coupon discounts.
- deposit_paid is how much has been collected so far. It is NOT separate revenue.
- Wix migrated bookings are included in summaries. They have payment_status instead of status.
- The revenue_summary object contains authoritative figures. Always use those numbers.

Always be direct, specific and use real numbers. Never say you don't have access to something — if the data exists in the system context provided, use it.

Always refer to money in pounds sterling (£). Always refer to the director as Sevak. Keep responses clear and structured. Use bullet points for lists. Flag urgent issues with 🚨. Use ✅ for all-clear items.

Use the current_date_context object to determine exact date ranges.

Here is the current live data from the system:
${JSON.stringify(contextData, null, 2)}`;

    // Filter out empty messages
    const validMessages = messages.filter((m: any) => {
      if (typeof m.content === "string" && m.content.trim() === "") return false;
      return true;
    });

    const claudeMessages = validMessages.map((m: any, i: number) => {
      if (i === validMessages.length - 1 && (imageBase64 || fileContent)) {
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
        const textContent = (m.content || "").trim();
        if (textContent) {
          content.push({ type: "text", text: textContent });
        } else if (content.length === 0) {
          content.push({ type: "text", text: "Please analyse the attached content." });
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content || "..." };
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
        max_tokens: 8192,
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
