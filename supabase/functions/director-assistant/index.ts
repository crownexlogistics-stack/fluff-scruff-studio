import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PREBOOKED_STATUSES = new Set(["Pending", "Confirmed"]);

function isPrebookedStatus(status: string | null | undefined) {
  return status ? PREBOOKED_STATUSES.has(status) : false;
}

function getDateContext() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const monthName = now.toLocaleString("en-GB", { month: "long", year: "numeric" });
  return {
    today,
    current_week_start: weekStart.toISOString().split("T")[0],
    current_week_end: weekEnd.toISOString().split("T")[0],
    current_month: monthName,
    current_month_start: monthStart.toISOString().split("T")[0],
    current_month_end: monthEnd.toISOString().split("T")[0],
    last_month_start: lastMonthStart.toISOString().split("T")[0],
    last_month_end: lastMonthEnd.toISOString().split("T")[0],
    next_month_start: nextMonthStart.toISOString().split("T")[0],
    next_month_end: nextMonthEnd.toISOString().split("T")[0],
    year_start: yearStart.toISOString().split("T")[0],
    year_end: yearEnd.toISOString().split("T")[0],
  };
}

async function fetchAllContext(supabaseAdmin: any) {
  const context: Record<string, any> = {};
  const dates = getDateContext();
  context.current_date_context = dates;
  const {
    today,
    current_month_start: monthStart,
    current_month_end: monthEnd,
    last_month_start: lastMonthStart,
    last_month_end: lastMonthEnd,
    next_month_start: nextMonthStart,
    next_month_end: nextMonthEnd,
    year_start: yearStart,
    year_end: yearEnd,
    current_week_start: weekStart,
    current_week_end: weekEnd,
  } = dates;

  // Fetch everything in parallel — NO date restrictions on main queries
  const [
    allBookingsResult,
    allMigratedResult,
    staff,
    allCommissions,
    activePackages,
    allPackageBookings,
    packageSessions,
    emailCampaigns,
    smsCampaigns,
    allBookingEmails,
    addOns,
    bookingAddonsResult,
    completedMonthRevenueRows,
    completedTodayRevenueRows,
    migratedCompletedMonthRows,
    migratedCompletedTodayRows,
    packageTcSigs,
    academyEnquiries,
    services,
    allMigratedCustomers,
  ] = await Promise.all([
    // ALL bookings — no date filter
    supabaseAdmin
      .from("bookings")
      .select(
        "id, customer_name, dog_name, booking_date, booking_time, status, total_price, deposit_paid, final_charge, staff_id, service_id, booking_source, customer_email, stripe_payment_id, notes, created_at",
      )
      .order("booking_date", { ascending: false })
      .limit(2000),

    // ALL migrated bookings — no date filter
    supabaseAdmin
      .from("migrated_bookings")
      .select(
        "id, migrated_customer_id, dog_name, dog_breed, service_name, staff_name, booking_date, booking_time, duration_minutes, payment_status, total_price, deposit_paid, amount_due, notes, is_future_booking",
      )
      .order("booking_date", { ascending: false })
      .limit(2000),

    supabaseAdmin.from("staff").select("id, name, commission_rate, is_active"),

    // ALL commissions — no date filter
    supabaseAdmin
      .from("commission_records")
      .select("staff_id, groomer_pay, studio_share, total_price, booking_source, commission_rate, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),

    supabaseAdmin
      .from("package_bookings")
      .select(
        "id, customer_name, dog_name, package_type, sessions_count, total_paid, status, tc_signed, created_at, customer_email",
      )
      .eq("status", "active"),

    supabaseAdmin
      .from("package_bookings")
      .select("id, customer_name, dog_name, package_type, sessions_count, total_paid, status, tc_signed, created_at")
      .order("created_at", { ascending: false }),

    supabaseAdmin.from("package_sessions").select("package_booking_id, status, booking_id"),

    supabaseAdmin
      .from("email_campaigns")
      .select("id, subject, status, emails_sent, opens, clicks, unique_opens, unique_clicks, sent_at, segment")
      .order("created_at", { ascending: false })
      .limit(20),

    supabaseAdmin
      .from("bulk_sms_log")
      .select("campaign_name, status, delivery_status, sent_at, phone, error_message")
      .order("sent_at", { ascending: false })
      .limit(200),

    supabaseAdmin.from("bookings").select("customer_email").order("created_at", { ascending: true }),

    supabaseAdmin.from("add_ons").select("id, name, price"),

    supabaseAdmin.from("booking_addons").select("booking_id, addon_id"),

    // Monthly revenue — scoped to this month only (for monthly summaries)
    supabaseAdmin
      .from("bookings")
      .select("total_price")
      .eq("status", "Completed")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),

    supabaseAdmin.from("bookings").select("total_price").eq("status", "Completed").eq("booking_date", today),

    supabaseAdmin
      .from("migrated_bookings")
      .select("total_price")
      .eq("payment_status", "Completed")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),

    supabaseAdmin
      .from("migrated_bookings")
      .select("total_price")
      .eq("payment_status", "Completed")
      .eq("booking_date", today),

    supabaseAdmin
      .from("package_tc_signatures")
      .select("id, package_booking_id, signed_at, status, created_at")
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("academy_enquiries")
      .select("id, first_name, last_name, email, phone, programme_interest, status, created_at")
      .order("created_at", { ascending: false }),

    supabaseAdmin.from("services").select("id, name"),

    supabaseAdmin
      .from("migrated_customers")
      .select("id, full_name, email, phone, sms_opt_out, sms_unreachable")
      .limit(500),
  ]);

  const allBookings = allBookingsResult.data || [];
  const allMigrated = allMigratedResult.data || [];
  const staffList = staff.data || [];
  const allCommissionsList = allCommissions.data || [];
  const staffMap = Object.fromEntries(staffList.map((s: any) => [s.id, s.name]));
  const serviceMap = Object.fromEntries((services.data || []).map((s: any) => [s.id, s.name]));

  // Fetch migrated customer names
  const migratedCustomerIds = [...new Set(allMigrated.map((mb: any) => mb.migrated_customer_id).filter(Boolean))];
  let migratedCustomerMap: Record<string, string> = {};
  if (migratedCustomerIds.length > 0) {
    const { data: mcData } = await supabaseAdmin
      .from("migrated_customers")
      .select("id, full_name")
      .in("id", migratedCustomerIds);
    migratedCustomerMap = Object.fromEntries((mcData || []).map((mc: any) => [mc.id, mc.full_name]));
  }

  // Add-on labels
  const addonPriceMap = Object.fromEntries(
    (addOns.data || []).map((a: any) => [a.id, { name: a.name, price: a.price }]),
  );
  const bookingIdSet = new Set(allBookings.map((b: any) => b.id));
  const addonsByBooking: Record<string, { total: number; items: string[] }> = {};
  (bookingAddonsResult.data || []).forEach((ba: any) => {
    if (!bookingIdSet.has(ba.booking_id)) return;
    if (!addonsByBooking[ba.booking_id]) addonsByBooking[ba.booking_id] = { total: 0, items: [] };
    const addon = addonPriceMap[ba.addon_id];
    if (addon) {
      addonsByBooking[ba.booking_id].total += addon.price;
      addonsByBooking[ba.booking_id].items.push(`${addon.name} (£${addon.price.toFixed(2)})`);
    }
  });

  const bookingRevenue = (b: any) => Number(b.total_price || 0);

  // ── REVENUE CALCULATIONS ──
  const completedRevenueBookings = (completedMonthRevenueRows.data || []).reduce(
    (s: number, r: any) => s + Number(r.total_price || 0),
    0,
  );
  const completedRevenueMigrated = (migratedCompletedMonthRows.data || []).reduce(
    (s: number, r: any) => s + Number(r.total_price || 0),
    0,
  );
  const completedRevenueExact = completedRevenueBookings + completedRevenueMigrated;
  const todayCompletedRevenue =
    (completedTodayRevenueRows.data || []).reduce((s: number, r: any) => s + Number(r.total_price || 0), 0) +
    (migratedCompletedTodayRows.data || []).reduce((s: number, r: any) => s + Number(r.total_price || 0), 0);

  // All-time revenue
  const totalRevenueAllTime =
    allBookings.filter((b: any) => b.status === "Completed").reduce((s: number, b: any) => s + bookingRevenue(b), 0) +
    allMigrated
      .filter((b: any) => b.payment_status === "Completed")
      .reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  // Revenue by period
  const revenueForPeriod = (
    arr: any[],
    startDate: string,
    endDate: string,
    statusField = "status",
    statusValue = "Completed",
  ) =>
    arr
      .filter((b: any) => b.booking_date >= startDate && b.booking_date <= endDate && b[statusField] === statusValue)
      .reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  const revenueLastMonth =
    revenueForPeriod(allBookings, lastMonthStart, lastMonthEnd) +
    revenueForPeriod(allMigrated, lastMonthStart, lastMonthEnd, "payment_status");
  const revenueThisWeek =
    revenueForPeriod(allBookings, weekStart, weekEnd) +
    revenueForPeriod(allMigrated, weekStart, weekEnd, "payment_status");
  const revenueThisYear =
    revenueForPeriod(allBookings, yearStart, yearEnd) +
    revenueForPeriod(allMigrated, yearStart, yearEnd, "payment_status");

  // Future bookings
  const futureConfirmedLive = allBookings.filter(
    (b: any) => b.booking_date >= today && isPrebookedStatus(b.status),
  );
  const futureConfirmedMigrated = allMigrated
    .filter(
      (b: any) =>
        b.booking_date >= today &&
        (b.is_future_booking === true || isPrebookedStatus(b.payment_status)),
    )
    .map((b: any) => ({
      ...b,
      status: b.payment_status || "Confirmed",
      customer_name: migratedCustomerMap[b.migrated_customer_id] || "Unknown",
      source: "wix_migrated",
    }));

  const futureConfirmed = [...futureConfirmedLive, ...futureConfirmedMigrated];
  const futureRestOfYear = futureConfirmed.filter((b: any) => b.booking_date <= yearEnd);
  const futureThisMonth = futureConfirmed.filter((b: any) => b.booking_date >= today && b.booking_date <= monthEnd);
  const futureNextMonth = futureConfirmed.filter(
    (b: any) => b.booking_date >= nextMonthStart && b.booking_date <= nextMonthEnd,
  );

  const projectedThisMonth =
    completedRevenueExact + futureThisMonth.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const projectedNextMonth = futureNextMonth.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  const bookingsThisYear = allBookings.filter((b: any) => b.booking_date >= yearStart && b.booking_date <= yearEnd);
  const migratedBookingsThisYear = allMigrated.filter(
    (b: any) => b.booking_date >= yearStart && b.booking_date <= yearEnd,
  );

  const prebookedThisYearLive = bookingsThisYear.filter((b: any) => isPrebookedStatus(b.status));
  const prebookedThisYearMigrated = migratedBookingsThisYear.filter(
    (b: any) => b.is_future_booking === true || isPrebookedStatus(b.payment_status),
  );

  const prebookedByMonth: Record<string, number> = {};
  [...prebookedThisYearLive, ...prebookedThisYearMigrated].forEach((b: any) => {
    const month = b.booking_date?.substring(0, 7);
    if (!month) return;
    prebookedByMonth[month] = (prebookedByMonth[month] || 0) + 1;
  });

  // Group future by month
  const futureByMonth: Record<string, { count: number; revenue: number }> = {};
  futureRestOfYear.forEach((b: any) => {
    const month = b.booking_date.substring(0, 7);
    if (!futureByMonth[month]) futureByMonth[month] = { count: 0, revenue: 0 };
    futureByMonth[month].count++;
    futureByMonth[month].revenue += Number(b.total_price || 0);
  });

  // Revenue by month (last 12 months completed)
  const revenueByMonth: Record<string, { revenue: number; count: number }> = {};
  [
    ...allBookings.filter((b: any) => b.status === "Completed"),
    ...allMigrated.filter((b: any) => b.payment_status === "Completed"),
  ].forEach((b: any) => {
    const month = b.booking_date?.substring(0, 7);
    if (!month) return;
    if (!revenueByMonth[month]) revenueByMonth[month] = { revenue: 0, count: 0 };
    revenueByMonth[month].revenue += Number(b.total_price || 0);
    revenueByMonth[month].count++;
  });

  context.revenue_summary = {
    total_all_time: `£${totalRevenueAllTime.toFixed(2)}`,
    this_month_completed: `£${completedRevenueExact.toFixed(2)}`,
    last_month_completed: `£${revenueLastMonth.toFixed(2)}`,
    this_week_completed: `£${revenueThisWeek.toFixed(2)}`,
    this_year_completed: `£${revenueThisYear.toFixed(2)}`,
    today: `£${todayCompletedRevenue.toFixed(2)}`,
    projected_this_month: `£${projectedThisMonth.toFixed(2)}`,
    projected_next_month: `£${projectedNextMonth.toFixed(2)}`,
    revenue_by_month: Object.entries(revenueByMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 24)
      .map(([month, data]) => ({
        month,
        revenue: `£${data.revenue.toFixed(2)}`,
        bookings: data.count,
      })),
  };

  context.future_bookings_summary = {
    total_future_confirmed: futureConfirmed.length,
    rest_of_year_count: futureRestOfYear.length,
    rest_of_year_projected_revenue: `£${futureRestOfYear.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0).toFixed(2)}`,
    next_month_count: futureNextMonth.length,
    next_month_projected_revenue: `£${projectedNextMonth.toFixed(2)}`,
    by_month: Object.entries(futureByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        count: data.count,
        projected_revenue: `£${data.revenue.toFixed(2)}`,
      })),
  };

  context.prebooked_appointments = {
    this_year_total_prebooked: prebookedThisYearLive.length + prebookedThisYearMigrated.length,
    this_year_rest_of_year_prebooked: futureRestOfYear.length,
    this_month_prebooked: futureThisMonth.length,
    next_month_prebooked: futureNextMonth.length,
    this_year_total_appointments: bookingsThisYear.length + migratedBookingsThisYear.length,
    this_year_completed_appointments:
      bookingsThisYear.filter((b: any) => b.status === "Completed").length +
      migratedBookingsThisYear.filter((b: any) => b.payment_status === "Completed").length,
    by_month: Object.entries(prebookedByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, prebooked_count: count })),
  };

  // ── THIS MONTH DETAIL ──
  const monthBookings = allBookings.filter((b: any) => b.booking_date >= monthStart && b.booking_date <= monthEnd);
  const monthMigrated = allMigrated.filter((b: any) => b.booking_date >= monthStart && b.booking_date <= monthEnd);
  const todayBookings = allBookings.filter((b: any) => b.booking_date === today);

  let totalDepositsCollected = 0;
  let futureBookedRevenue = 0;
  let cashPaymentsTotal = 0;
  let cardOnlineTotal = 0;
  let outstandingBalance = 0;
  const statusSummary: Record<string, { count: number; revenue: number }> = {};

  monthBookings.forEach((b: any) => {
    const price = bookingRevenue(b);
    if (!statusSummary[b.status]) statusSummary[b.status] = { count: 0, revenue: 0 };
    statusSummary[b.status].count++;
    statusSummary[b.status].revenue += price;
    totalDepositsCollected += Number(b.deposit_paid || 0);
    if (b.status === "Completed") {
      if (b.booking_source === "cash") cashPaymentsTotal += price;
      else cardOnlineTotal += price;
    }
    if (b.booking_date >= today && (b.status === "Pending" || b.status === "Confirmed")) {
      futureBookedRevenue += price;
      outstandingBalance += Math.max(0, Number(b.total_price || 0) - Number(b.deposit_paid || 0));
    }
  });

  context.completed_revenue_exact = completedRevenueExact;
  context.today_completed_revenue = todayCompletedRevenue;

  context.bookings_summary = {
    month: monthStart,
    today_count: todayBookings.length,
    completed_today: todayBookings.filter((b: any) => b.status === "Completed").length,
    revenue_today: `£${todayCompletedRevenue.toFixed(2)}`,
    completed_revenue_exact: `£${completedRevenueExact.toFixed(2)}`,
    total_earned_this_month: `£${completedRevenueExact.toFixed(2)}`,
    cash_payments_total: `£${cashPaymentsTotal.toFixed(2)}`,
    card_online_payments_total: `£${cardOnlineTotal.toFixed(2)}`,
    deposits_collected: `£${totalDepositsCollected.toFixed(2)}`,
    future_booked_revenue: `£${futureBookedRevenue.toFixed(2)}`,
    outstanding_balance_to_collect: `£${outstandingBalance.toFixed(2)}`,
    by_status: Object.fromEntries(
      Object.entries(statusSummary).map(([k, v]) => [k, { count: v.count, revenue: `£${v.revenue.toFixed(2)}` }]),
    ),
    note_on_revenue:
      "Revenue = total_price. deposit_paid and balance_due are payment timing only. completed_revenue_exact includes both bookings and migrated_bookings tables.",
  };

  // Combined bookings this month
  const bookingsThisMonthFormatted = monthBookings.map((b: any) => ({
    id: b.id,
    customer_name: b.customer_name,
    dog_name: b.dog_name,
    date: b.booking_date,
    time: b.booking_time,
    status: b.status,
    total_price: Number(b.total_price || 0),
    deposit_paid: Number(b.deposit_paid || 0),
    balance_due: Math.max(0, Number(b.total_price || 0) - Number(b.deposit_paid || 0)),
    groomer: staffMap[b.staff_id] || "Unassigned",
    source: b.booking_source,
    service_name: serviceMap[b.service_id] || "Unknown",
    addons: addonsByBooking[b.id]?.items || [],
  }));

  const migratedThisMonthFormatted = monthMigrated.map((mb: any) => ({
    id: mb.id,
    customer_name: migratedCustomerMap[mb.migrated_customer_id] || "Unknown",
    dog_name: mb.dog_name || "Unknown",
    date: mb.booking_date,
    time: mb.booking_time,
    status: mb.payment_status,
    total_price: Number(mb.total_price || 0),
    deposit_paid: Number(mb.deposit_paid || 0),
    balance_due: Math.max(0, Number(mb.total_price || 0) - Number(mb.deposit_paid || 0)),
    groomer: mb.staff_name || "Unassigned",
    source: "wix_migrated",
    service_name: mb.service_name || "Unknown",
    addons: [],
  }));

  context.combined_bookings_this_month = [...bookingsThisMonthFormatted, ...migratedThisMonthFormatted].sort(
    (a: any, b: any) => {
      const dateCmp = (a.date || "").localeCompare(b.date || "");
      return dateCmp !== 0 ? dateCmp : (a.time || "").localeCompare(b.time || "");
    },
  );

  // Future bookings detail
  context.future_bookings_detail = futureConfirmed.slice(0, 250).map((b: any) => ({
    customer_name: b.customer_name,
    dog_name: b.dog_name,
    date: b.booking_date,
    time: b.booking_time,
    status: b.status,
    total_price: Number(b.total_price || 0),
    groomer: b.staff_id ? staffMap[b.staff_id] || "Unassigned" : b.staff_name || "Unassigned",
    service_name: serviceMap[b.service_id] || b.service_name || "Unknown",
    source: b.source || "live",
  }));

  // ── STAFF PERFORMANCE ──
  const commByStaff: Record<
    string,
    {
      pay: number;
      revenue: number;
      count: number;
      thisMonthPay: number;
      thisMonthCount: number;
      lastMonthPay: number;
      lastMonthCount: number;
    }
  > = {};
  allCommissionsList.forEach((c: any) => {
    if (!commByStaff[c.staff_id])
      commByStaff[c.staff_id] = {
        pay: 0,
        revenue: 0,
        count: 0,
        thisMonthPay: 0,
        thisMonthCount: 0,
        lastMonthPay: 0,
        lastMonthCount: 0,
      };
    commByStaff[c.staff_id].pay += Number(c.groomer_pay || 0);
    commByStaff[c.staff_id].revenue += Number(c.total_price || 0);
    commByStaff[c.staff_id].count++;
    if (c.created_at >= monthStart && c.created_at <= monthEnd + "T23:59:59") {
      commByStaff[c.staff_id].thisMonthPay += Number(c.groomer_pay || 0);
      commByStaff[c.staff_id].thisMonthCount++;
    }
    if (c.created_at >= lastMonthStart && c.created_at <= lastMonthEnd + "T23:59:59") {
      commByStaff[c.staff_id].lastMonthPay += Number(c.groomer_pay || 0);
      commByStaff[c.staff_id].lastMonthCount++;
    }
  });

  const groomerBookingsNextMonth: Record<string, number> = {};
  futureNextMonth.forEach((b: any) => {
    if (b.staff_id) groomerBookingsNextMonth[b.staff_id] = (groomerBookingsNextMonth[b.staff_id] || 0) + 1;
  });

  context.staff_performance = staffList
    .filter((s: any) => s.is_active)
    .map((s: any) => {
      const c = commByStaff[s.id] || {
        pay: 0,
        revenue: 0,
        count: 0,
        thisMonthPay: 0,
        thisMonthCount: 0,
        lastMonthPay: 0,
        lastMonthCount: 0,
      };
      return {
        name: s.name,
        commission_rate: s.commission_rate,
        total_earned_all_time: `£${c.pay.toFixed(2)}`,
        total_bookings_all_time: c.count,
        earned_this_month: `£${c.thisMonthPay.toFixed(2)}`,
        bookings_this_month: c.thisMonthCount,
        earned_last_month: `£${c.lastMonthPay.toFixed(2)}`,
        bookings_last_month: c.lastMonthCount,
        bookings_next_month_already_booked: groomerBookingsNextMonth[s.id] || 0,
      };
    });

  // ── CUSTOMERS ──
  const allEmails = (allBookingEmails.data || []).map((b: any) => b.customer_email?.toLowerCase()).filter(Boolean);
  const uniqueCustomers = new Set(allEmails);

  const bookingCountByEmail: Record<string, number> = {};
  const lastBookingByEmail: Record<string, string> = {};
  const firstBookingByEmail: Record<string, string> = {};
  allBookings.forEach((b: any) => {
    const email = b.customer_email?.toLowerCase();
    if (!email) return;
    bookingCountByEmail[email] = (bookingCountByEmail[email] || 0) + 1;
    if (!lastBookingByEmail[email] || b.booking_date > lastBookingByEmail[email])
      lastBookingByEmail[email] = b.booking_date;
    if (!firstBookingByEmail[email] || b.booking_date < firstBookingByEmail[email])
      firstBookingByEmail[email] = b.booking_date;
  });

  const newThisMonth = Object.values(firstBookingByEmail).filter((d) => d >= monthStart && d <= monthEnd).length;
  const noBooking60 = Object.entries(lastBookingByEmail).filter(([, d]) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    return d < cutoff.toISOString().split("T")[0];
  }).length;
  const noBooking90 = Object.entries(lastBookingByEmail).filter(([, d]) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    return d < cutoff.toISOString().split("T")[0];
  }).length;

  context.customers = {
    total_unique: uniqueCustomers.size,
    new_this_month: newThisMonth,
    single_visit_at_risk: Object.values(bookingCountByEmail).filter((c) => c === 1).length,
    loyal_5_plus: Object.values(bookingCountByEmail).filter((c) => c >= 5).length,
    no_booking_60_days: noBooking60,
    no_booking_90_days: noBooking90,
    migrated_total: (allMigratedCustomers.data || []).length,
    migrated_sms_opt_out: (allMigratedCustomers.data || []).filter((m: any) => m.sms_opt_out).length,
    migrated_unreachable: (allMigratedCustomers.data || []).filter((m: any) => m.sms_unreachable).length,
  };

  // ── PACKAGES ──
  const pkgBookings = allPackageBookings.data || [];
  const pkgSessions = packageSessions.data || [];
  const sessionsByPkg: Record<string, { used: number; total: number }> = {};
  pkgSessions.forEach((s: any) => {
    if (!sessionsByPkg[s.package_booking_id]) sessionsByPkg[s.package_booking_id] = { used: 0, total: 0 };
    sessionsByPkg[s.package_booking_id].total++;
    if (s.status === "used") sessionsByPkg[s.package_booking_id].used++;
  });

  const activePkgs = activePackages.data || [];
  context.active_packages = activePkgs.map((p: any) => ({
    customer_name: p.customer_name,
    dog_name: p.dog_name,
    package_type: p.package_type,
    total_paid: `£${(p.total_paid || 0).toFixed(2)}`,
    tc_signed: p.tc_signed,
    sessions_used: sessionsByPkg[p.id]?.used || 0,
    sessions_total: sessionsByPkg[p.id]?.total || p.sessions_count,
  }));

  context.packages_summary = {
    total_all_time: pkgBookings.length,
    active: pkgBookings.filter((p: any) => p.status === "active").length,
    completed: pkgBookings.filter((p: any) => p.status === "completed").length,
    cancelled: pkgBookings.filter((p: any) => p.status === "cancelled").length,
    total_revenue: `£${pkgBookings.reduce((s: number, p: any) => s + Number(p.total_paid || 0), 0).toFixed(2)}`,
    unsigned_tc: pkgBookings.filter((p: any) => !p.tc_signed && p.status === "active").length,
  };

  const tcSigRows = packageTcSigs.data || [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  context.system_health = {
    package_tc_pending_over_7_days: tcSigRows.filter(
      (sig: any) => sig.status === "pending" && sig.created_at < sevenDaysAgoIso,
    ).length,
  };

  // ── CAMPAIGNS ──
  context.email_campaigns = emailCampaigns.data || [];

  const smsByCampaign: Record<string, { sent: number; delivered: number; failed: number }> = {};
  (smsCampaigns.data || []).forEach((s: any) => {
    const name = s.campaign_name || "direct";
    if (!smsByCampaign[name]) smsByCampaign[name] = { sent: 0, delivered: 0, failed: 0 };
    smsByCampaign[name].sent++;
    if (s.delivery_status === "delivered") smsByCampaign[name].delivered++;
    if (s.status === "failed") smsByCampaign[name].failed++;
  });
  context.sms_campaigns = Object.entries(smsByCampaign).map(([name, data]) => ({ name, ...data }));

  // ── UNPAID DEPOSITS ──
  const anomalies = allBookings.filter(
    (b: any) =>
      b.booking_date >= today &&
      (b.status === "Pending" || b.status === "Confirmed") &&
      Number(b.deposit_paid || 0) === 0,
  );
  context.unpaid_deposits = {
    count: anomalies.length,
    total_value: `£${anomalies.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0).toFixed(2)}`,
    bookings: anomalies.slice(0, 30).map((b: any) => ({
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
        fetch(
          `https://api.stripe.com/v1/payment_intents?limit=100&created[gte]=${lastMonthStartUnix}&created[lte]=${lastMonthEndUnix}`,
          {
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          },
        ),
        fetch(`https://api.stripe.com/v1/payouts?limit=10`, {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        }),
      ]);
      if (stripeThisMonth.ok) {
        const thisData = await stripeThisMonth.json();
        const lastData = stripeLastMonth.ok ? await stripeLastMonth.json() : { data: [] };
        const payoutsData = payoutsRes.ok ? await payoutsRes.json() : { data: [] };
        const thisSucceeded = (thisData.data || []).filter((pi: any) => pi.status === "succeeded");
        const lastSucceeded = (lastData.data || []).filter((pi: any) => pi.status === "succeeded");
        context.stripe = {
          revenue_this_month: `£${(thisSucceeded.reduce((s: number, pi: any) => s + (pi.amount_received || 0), 0) / 100).toFixed(2)}`,
          revenue_last_month: `£${(lastSucceeded.reduce((s: number, pi: any) => s + (pi.amount_received || 0), 0) / 100).toFixed(2)}`,
          succeeded_count_this_month: thisSucceeded.length,
          recent_payouts: (payoutsData.data || []).slice(0, 5).map((p: any) => ({
            amount: `£${(p.amount / 100).toFixed(2)}`,
            status: p.status,
            arrival_date: new Date(p.arrival_date * 1000).toISOString().split("T")[0],
          })),
          note: "Compare stripe revenue against completed_revenue_exact to spot unmatched payments",
        };
      }
    }
  } catch {
    context.stripe = { error: "Could not fetch Stripe data" };
  }

  console.log(
    "Context built. Future confirmed bookings:",
    futureConfirmed.length,
    "All bookings fetched:",
    allBookings.length,
  );
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

    const systemPrompt = `You are Sevak's personal AI business analyst for Fluff & Scruff Studio, a dog grooming salon in Hornchurch, Essex. You have COMPLETE access to ALL salon data — every booking ever made, every payment, every customer, every groomer's performance, all campaigns, all expenses, and all system activity.

You can answer ANY business question including:
- Revenue for any time period (today, this week, this month, last month, this year, all time)
- Projections for any future month based on already-booked appointments
- How many appointments the salon has for the rest of the year
- Groomer performance comparisons and projections
- Customer retention, churn, and re-engagement analysis
- Campaign ROI and recommendations
- Financial health and profit trends
- System errors and how to fix them
- Writing Lovable prompts to fix technical issues

When asked about errors or system problems:
1. Look in the audit logs and error data provided
2. Explain what went wrong in plain English
3. Write the exact Lovable prompt needed to fix it — formatted as a code block ready to copy and paste

CRITICAL REVENUE RULES:
- Revenue = total_price always. Never use deposit_paid or balance_due as revenue.
- total_price already includes add-ons and discounts.
- completed_revenue_exact is the authoritative monthly figure.
- Always check combined_bookings_this_month for daily/weekly breakdowns — it includes both main system and Wix migrated bookings.

CRITICAL DATE RULES:
- Always use current_date_context for exact date ranges.
- future_bookings_summary contains the count and projected revenue for rest of year and by month.
- prebooked_appointments contains full-year pre-booked counts and month-by-month totals.
- future_bookings_detail contains individual future appointments.
- When asked "rest of the year" use future_bookings_summary.rest_of_year_count.
- When asked "whole year pre-booked" use prebooked_appointments.this_year_total_prebooked.

Always be direct, specific and use real numbers from the data provided. Never say you cannot access something that is in the context. Never claim data is restricted to a single month when historical data exists in context. Always refer to money in pounds (£). Always call the director Sevak. Flag urgent issues with 🚨. Use ✅ for good news.

Here is the complete live data:
${JSON.stringify(contextData, null, 2)}`;

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
        content.push({ type: "text", text: textContent || "Please analyse the attached content." });
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
