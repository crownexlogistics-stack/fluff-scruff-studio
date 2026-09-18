import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calcDateAwareExpenses } from "@/lib/expenseCalc";
import { expandUpcomingBills } from "@/lib/billsCalc";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

/**
 * ═══════════════════════════════════════════════════════════════
 * OWNER DASHBOARD — SINGLE SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════
 * Every figure shown on /admin is calculated here, once, so the
 * owner can never see two different answers to the same question.
 *
 * Money definitions (deliberately distinct):
 *  • REVENUE EARNED   — value of appointments that have already
 *                       happened this month (total_price, excluding
 *                       Cancelled / No Show / Refunded).
 *  • CASH RECEIVED    — money that actually landed this month
 *                       (Stripe + salon card machine), from the
 *                       existing get-cash-flow function.
 *  • FUTURE BOOKED    — value of confirmed appointments still to
 *                       come this month. Never counted as earned.
 *
 * Payment on a booking = deposit_paid + cash_collected + card_collected.
 * (final_charge is the balance taken at checkout, NOT the total.)
 * ═══════════════════════════════════════════════════════════════
 */

const NON_EARNING = ["Cancelled", "No Show", "Refunded"];
/** Blended groomer pay rate used for appointments not yet completed (40% / 50% split). */
const PROJECTED_GROOMER_RATE = 0.42;

export interface DayRow {
  date: Date;
  label: string;
  isToday: boolean;
  count: number;
  revenue: number;
  open: boolean;
  workingStaff: number;
  bookedMinutes: number;
  availableMinutes: number;
}

export interface TeamRow {
  id: string;
  name: string;
  completed: number;
  revenue: number;
  groomerPay: number;
  cancellations: number;
  cancellationRate: number | null;
  todayCount: number;
  workingToday: boolean;
}

export interface ActivityRow {
  id: string;
  at: Date;
  kind: "booking" | "completed" | "cancelled" | "noshow" | "payment";
  text: string;
  amount: number | null;
  href: string;
}

export interface Alert {
  id: string;
  severity: "urgent" | "attention" | "info";
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
  value?: number;
}

const paidOn = (b: any) =>
  Number(b.deposit_paid || 0) + Number(b.cash_collected || 0) + Number(b.card_collected || 0);
const priceOf = (b: any) => Number(b.total_price || 0);
const sum = (rows: any[], fn: (r: any) => number) => rows.reduce((s, r) => s + fn(r), 0);
const minutesBetween = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
};

export function useOwnerDashboard() {
  const { user } = useAuth();

  const now = new Date();
  const today = startOfDay(now);
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");
  const next30Str = format(addDays(today, 30), "yyyy-MM-dd");
  const nextMonthStart = startOfMonth(addMonths(now, 1));
  const nextMonthStartStr = format(nextMonthStart, "yyyy-MM-dd");
  const nextMonthEndStr = format(endOfMonth(addMonths(now, 1)), "yyyy-MM-dd");
  const horizonStr = format(addDays(today, 35), "yyyy-MM-dd");
  const threeMonthsAgoStr = format(startOfMonth(subMonths(now, 3)), "yyyy-MM-dd");

  const live = { refetchInterval: 120_000 } as const;

  // ── Who is the owner ───────────────────────────────────────
  const profileQ = useQuery({
    queryKey: ["owner-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Bookings ───────────────────────────────────────────────
  const monthBookingsQ = useQuery({
    queryKey: ["owner-month-bookings", monthStartStr, monthEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, customer_name, dog_name, booking_date, booking_time, status, total_price, deposit_paid, cash_collected, card_collected, staff_id, duration_minutes, created_at, staff(name), services(name)",
        )
        .gte("booking_date", monthStartStr)
        .lte("booking_date", monthEndStr);
      return (data ?? []) as any[];
    },
    ...live,
  });

  const weekBookingsQ = useQuery({
    queryKey: ["owner-week-bookings", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, booking_date, status, total_price, duration_minutes, staff_id")
        .gte("booking_date", weekStartStr)
        .lte("booking_date", weekEndStr);
      return (data ?? []) as any[];
    },
    ...live,
  });

  const migratedMonthQ = useQuery({
    queryKey: ["owner-migrated-month", monthStartStr, monthEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_bookings")
        .select("id, booking_date, total_price, is_future_booking")
        .gte("booking_date", monthStartStr)
        .lte("booking_date", monthEndStr);
      return (data ?? []) as any[];
    },
  });

  const next30Q = useQuery({
    queryKey: ["owner-next30", todayStr, next30Str],
    queryFn: async () => {
      const [liveRes, migratedRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, booking_date, total_price, status")
          .gte("booking_date", todayStr)
          .lte("booking_date", next30Str)
          .in("status", ["Confirmed", "Pending"]),
        supabase
          .from("migrated_bookings")
          .select("id, booking_date, total_price")
          .gte("booking_date", todayStr)
          .lte("booking_date", next30Str)
          .eq("is_future_booking", true),
      ]);
      return [...(liveRes.data ?? []), ...(migratedRes.data ?? [])] as any[];
    },
  });

  const nextMonthQ = useQuery({
    queryKey: ["owner-next-month", nextMonthStartStr, nextMonthEndStr],
    queryFn: async () => {
      const [liveRes, migratedRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, booking_date, total_price, status")
          .gte("booking_date", nextMonthStartStr)
          .lte("booking_date", nextMonthEndStr)
          .in("status", ["Confirmed", "Pending"]),
        supabase
          .from("migrated_bookings")
          .select("id, booking_date, total_price")
          .gte("booking_date", nextMonthStartStr)
          .lte("booking_date", nextMonthEndStr)
          .eq("is_future_booking", true),
      ]);
      return [...(liveRes.data ?? []), ...(migratedRes.data ?? [])] as any[];
    },
  });

  // Completed months baseline — how many appointments a normal month holds
  const monthlyBaselineQ = useQuery({
    queryKey: ["owner-baseline", threeMonthsAgoStr, monthStartStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("booking_date")
        .gte("booking_date", threeMonthsAgoStr)
        .lt("booking_date", monthStartStr)
        .not("status", "in", '("Cancelled")');
      return (data ?? []) as any[];
    },
  });

  // ── Money ──────────────────────────────────────────────────
  const cashFlowQ = useQuery({
    queryKey: ["owner-cash-flow", monthStartStr, monthEndStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cash-flow", {
        body: { month_start: monthStartStr, month_end: monthEndStr },
      });
      if (error) throw error;
      return data as { total_cash: number; stripe: { total: number }; salon_card: number };
    },
    staleTime: 60_000,
  });

  const commissionsQ = useQuery({
    queryKey: ["owner-commissions", monthStartStr, monthEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("staff_id, groomer_pay, total_price, created_at")
        .gte("created_at", `${monthStartStr}T00:00:00`)
        .lte("created_at", `${monthEndStr}T23:59:59`);
      return (data ?? []) as any[];
    },
    ...live,
  });

  const recurringQ = useQuery({
    queryKey: ["owner-recurring-expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      return (data ?? []) as any[];
    },
  });

  const oneOffQ = useQuery({
    queryKey: ["owner-oneoff-expenses", monthStartStr, horizonStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, expense_date")
        .eq("expense_type", "one_off")
        .gte("expense_date", monthStartStr)
        .lte("expense_date", horizonStr);
      return (data ?? []) as any[];
    },
  });

  const purchasesQ = useQuery({
    queryKey: ["owner-purchases", monthStartStr, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("total_price")
        .eq("is_returned", false)
        .gte("purchased_at", `${monthStartStr}T00:00:00`)
        .lte("purchased_at", `${todayStr}T23:59:59`);
      return (data ?? []) as any[];
    },
  });

  const bankQ = useQuery({
    queryKey: ["owner-bank"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_balance_snapshots")
        .select("balance, noted_at, noted_by")
        .order("noted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // ── Team & schedules ───────────────────────────────────────
  const staffQ = useQuery({
    queryKey: ["owner-staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, name, role, account_blocked, employment_end_date")
        .ilike("role", "%groomer%")
        .order("name");
      return (data ?? []).filter(
        (s: any) => !s.account_blocked && (!s.employment_end_date || s.employment_end_date >= todayStr),
      ) as any[];
    },
  });

  const availabilityQ = useQuery({
    queryKey: ["owner-availability"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_availability")
        .select("staff_id, day_of_week, start_time, end_time, is_available");
      return (data ?? []) as any[];
    },
  });

  const overridesQ = useQuery({
    queryKey: ["owner-overrides", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_schedule_overrides")
        .select("staff_id, override_date, is_working, start_time, end_time")
        .gte("override_date", weekStartStr)
        .lte("override_date", weekEndStr);
      return (data ?? []) as any[];
    },
  });

  // ── Things that may need attention ─────────────────────────
  const payLinksQ = useQuery({
    queryKey: ["owner-pay-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_pay_links")
        .select("id, amount, created_at, status")
        .eq("status", "pending");
      return (data ?? []) as any[];
    },
  });

  const inboxQ = useQuery({
    queryKey: ["owner-inbox-cases"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_inbox_cases")
        .select("id", { count: "exact", head: true })
        .eq("status", "unassigned");
      return count ?? 0;
    },
    ...live,
  });

  const handoffsQ = useQuery({
    queryKey: ["owner-handoffs"],
    queryFn: async () => {
      const { count } = await supabase
        .from("scruff_handoffs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    ...live,
  });

  const unreadSmsQ = useQuery({
    queryKey: ["owner-unread-sms"],
    queryFn: async () => {
      const { count } = await supabase
        .from("sms_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("is_read", false);
      return count ?? 0;
    },
    ...live,
  });

  // Unpaid balances on appointments that already happened (last 90 days)
  const unpaidQ = useQuery({
    queryKey: ["owner-unpaid", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, total_price, deposit_paid, cash_collected, card_collected, booking_date")
        .eq("status", "Completed")
        .gte("booking_date", format(addDays(today, -90), "yyyy-MM-dd"))
        .lte("booking_date", todayStr);
      return ((data ?? []) as any[]).filter((b) => priceOf(b) - paidOn(b) > 0.5);
    },
    ...live,
  });

  const activityQ = useQuery({
    queryKey: ["owner-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, customer_name, dog_name, booking_date, status, total_price, deposit_paid, created_at, staff(name), services(name)",
        )
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []) as any[];
    },
    ...live,
  });

  // ── Marketing snapshot ─────────────────────────────────────
  const analyticsQ = useQuery({
    queryKey: ["owner-analytics", monthStartStr, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-analytics-data", {
        body: { startDate: monthStartStr, endDate: todayStr },
      });
      if (error) throw error;
      if ((data as any)?.error) return null;
      return data as { summary: { totalVisitors: number } };
    },
    staleTime: 10 * 60_000,
    retry: false,
  });

  const onlineBookingsQ = useQuery({
    queryKey: ["owner-online-bookings", monthStartStr],
    queryFn: async () => {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("booking_source", "online")
        .gte("created_at", `${monthStartStr}T00:00:00`);
      return count ?? 0;
    },
  });

  // ═══════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ═══════════════════════════════════════════════════════════
  const monthBookings = monthBookingsQ.data ?? [];
  const migratedMonth = migratedMonthQ.data ?? [];
  const staff = staffQ.data ?? [];
  const availability = availabilityQ.data ?? [];
  const overrides = overridesQ.data ?? [];

  /** Working window (minutes) for one groomer on one date — real schedule data only. */
  const workingMinutesFor = useMemo(() => {
    return (staffId: string, date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const override = overrides.find((o: any) => o.staff_id === staffId && o.override_date === dateStr);
      const dow = (date.getDay() + 6) % 7; // 0 = Monday
      const base = availability.find(
        (a: any) => a.staff_id === staffId && a.day_of_week === dow && a.is_available,
      );
      if (override) {
        if (!override.is_working) {
          // Full day off, or a partial block against the base schedule
          if (!override.start_time && !override.end_time) return 0;
          const blocked = minutesBetween(override.start_time, override.end_time);
          const baseMins = base ? minutesBetween(base.start_time, base.end_time) : 0;
          return Math.max(0, baseMins - blocked);
        }
        if (override.start_time && override.end_time) return minutesBetween(override.start_time, override.end_time);
      }
      return base ? minutesBetween(base.start_time, base.end_time) : 0;
    };
  }, [availability, overrides]);

  const dayStats = useMemo(() => {
    return (date: Date, bookingsForDay: any[]): DayRow => {
      let workingStaff = 0;
      let availableMinutes = 0;
      for (const s of staff) {
        const mins = workingMinutesFor(s.id, date);
        if (mins > 0) {
          workingStaff += 1;
          availableMinutes += mins;
        }
      }
      const activeBookings = bookingsForDay.filter((b) => b.status !== "Cancelled");
      return {
        date,
        label: format(date, "EEEE"),
        isToday: format(date, "yyyy-MM-dd") === todayStr,
        count: activeBookings.length,
        revenue: sum(activeBookings, priceOf),
        open: workingStaff > 0 || activeBookings.length > 0,
        workingStaff,
        bookedMinutes: sum(activeBookings, (b) => Number(b.duration_minutes || 0)),
        availableMinutes,
      };
    };
  }, [staff, workingMinutesFor, todayStr]);

  // ── TODAY ──────────────────────────────────────────────────
  const todayBookings = monthBookings.filter((b: any) => b.booking_date === todayStr);
  const todayActive = todayBookings.filter((b: any) => b.status !== "Cancelled");
  const todayRow = dayStats(today, todayBookings);
  const todayScheduledRevenue = sum(todayActive, priceOf);
  const todayCollected = sum(
    todayBookings,
    (b) => Number(b.cash_collected || 0) + Number(b.card_collected || 0),
  );
  const todayExpected = sum(todayActive, (b) => Math.max(0, priceOf(b) - paidOn(b)));
  const todayCancellations = todayBookings.filter((b: any) => b.status === "Cancelled").length;
  const todayNoShows = todayBookings.filter((b: any) => b.status === "No Show").length;
  const groomersWorkingToday = todayRow.workingStaff;

  // ── MONEY (one calculation, used everywhere) ───────────────
  const pastMonthBookings = monthBookings.filter(
    (b: any) => b.booking_date <= todayStr && !NON_EARNING.includes(b.status),
  );
  const migratedPast = migratedMonth.filter((b: any) => b.booking_date <= todayStr);
  const revenueEarned = sum(pastMonthBookings, priceOf) + sum(migratedPast, priceOf);

  // Unpaid balances on finished appointments — same list the alert uses, so the
  // Money panel and "Needs your attention" can never show different totals.
  const outstandingFromCompleted = sum(unpaidQ.data ?? [], (b) => Math.max(0, priceOf(b) - paidOn(b)));

  const futureMonthBookings = monthBookings.filter(
    (b: any) => b.booking_date > todayStr && ["Confirmed", "Pending"].includes(b.status),
  );
  const migratedFuture = migratedMonth.filter(
    (b: any) => b.booking_date > todayStr && b.is_future_booking,
  );
  const futureBookedRevenue = sum(futureMonthBookings, priceOf) + sum(migratedFuture, priceOf);

  const cashReceived = cashFlowQ.data?.total_cash ?? 0;

  const groomerPayEarned = sum(commissionsQ.data ?? [], (c) => Number(c.groomer_pay || 0));
  const groomerPayProjected = futureBookedRevenue * PROJECTED_GROOMER_RATE;

  const dateAware = calcDateAwareExpenses(recurringQ.data ?? [], now, now);
  const oneOff = oneOffQ.data ?? [];
  const billsPaid =
    dateAware.paidTotal +
    sum(
      oneOff.filter((e: any) => e.expense_date <= todayStr && e.expense_date >= monthStartStr),
      (e) => Number(e.amount || 0),
    ) +
    sum(purchasesQ.data ?? [], (p) => Number(p.total_price || 0));
  const billsRemaining =
    dateAware.upcomingTotal +
    sum(
      oneOff.filter((e: any) => e.expense_date > todayStr && e.expense_date <= monthEndStr),
      (e) => Number(e.amount || 0),
    );

  const totalProjectedIncome = revenueEarned + futureBookedRevenue;
  const totalProjectedCosts = groomerPayEarned + groomerPayProjected + billsPaid + billsRemaining;
  const projectedResult = totalProjectedIncome - totalProjectedCosts;
  const breakEvenGap = projectedResult < 0 ? Math.abs(projectedResult) : 0;

  const bankBalance = bankQ.data ? Number(bankQ.data.balance) : null;
  const bills7d = useMemo(
    () =>
      expandUpcomingBills(recurringQ.data ?? [], oneOff, today, 35).filter((b) => b.daysUntilDue <= 7),
    [recurringQ.data, oneOff, todayStr],
  );
  const billsDueThisWeek = sum(bills7d, (b) => b.amount);
  const balanceAfterBills = bankBalance === null ? null : bankBalance - billsDueThisWeek;

  const moneyStatus: "green" | "amber" | "red" =
    projectedResult >= 0 ? "green" : projectedResult >= -300 ? "amber" : "red";

  // ── WEEK ───────────────────────────────────────────────────
  const weekBookings = weekBookingsQ.data ?? [];
  const weekDays: DayRow[] = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((d) => {
      const dStr = format(d, "yyyy-MM-dd");
      return dayStats(
        d,
        weekBookings.filter((b: any) => b.booking_date === dStr),
      );
    });
  }, [weekBookings, weekStart, weekEnd, dayStats]);

  const weekActive = weekBookings.filter((b: any) => b.status !== "Cancelled");
  const weekAvailableMinutes = weekDays.reduce((s, d) => s + d.availableMinutes, 0);
  const weekBookedMinutes = weekDays.reduce((s, d) => s + d.bookedMinutes, 0);
  const weekUtilisation =
    weekAvailableMinutes > 0 ? Math.round((weekBookedMinutes / weekAvailableMinutes) * 100) : null;

  // ── FORWARD ────────────────────────────────────────────────
  const next30 = next30Q.data ?? [];
  const nextMonth = nextMonthQ.data ?? [];
  const baseline = monthlyBaselineQ.data ?? [];
  const baselineMonths = new Set(baseline.map((b: any) => (b.booking_date as string).slice(0, 7)));
  const avgMonthlyAppointments =
    baselineMonths.size > 0 ? Math.round(baseline.length / baselineMonths.size) : null;
  const nextMonthCount = nextMonth.length;
  const nextMonthHealth: "healthy" | "quiet" | null =
    avgMonthlyAppointments === null
      ? null
      : nextMonthCount >= avgMonthlyAppointments * 0.8
      ? "healthy"
      : "quiet";

  // ── TEAM ───────────────────────────────────────────────────
  const team: TeamRow[] = useMemo(() => {
    const commissions = commissionsQ.data ?? [];
    return staff
      .map((s: any) => {
        const own = commissions.filter((c: any) => c.staff_id === s.id);
        const cancelled = monthBookings.filter(
          (b: any) => b.staff_id === s.id && b.status === "Cancelled",
        ).length;
        const completed = own.length;
        const denom = completed + cancelled;
        return {
          id: s.id,
          name: s.name,
          completed,
          revenue: sum(own, (c) => Number(c.total_price || 0)),
          groomerPay: sum(own, (c) => Number(c.groomer_pay || 0)),
          cancellations: cancelled,
          cancellationRate: denom >= 5 ? Math.round((cancelled / denom) * 100) : null,
          todayCount: todayActive.filter((b: any) => b.staff_id === s.id).length,
          workingToday: workingMinutesFor(s.id, today) > 0,
        };
      })
      .filter((t) => t.completed > 0 || t.todayCount > 0 || t.workingToday)
      .sort((a, b) => b.revenue - a.revenue);
  }, [staff, commissionsQ.data, monthBookings, todayActive, workingMinutesFor, todayStr]);

  // ── ACTIVITY ───────────────────────────────────────────────
  const activity: ActivityRow[] = useMemo(() => {
    return (activityQ.data ?? []).map((b: any) => {
      const svc = b.services?.name ? ` ${b.services.name}` : " appointment";
      const when = format(parseISO(b.booking_date), "d MMM");
      let kind: ActivityRow["kind"] = "booking";
      let text = `${b.customer_name} booked${svc} for ${when}`;
      if (b.status === "Completed") {
        kind = "completed";
        text = `${b.customer_name}'s${svc} completed${b.staff?.name ? ` by ${b.staff.name}` : ""}`;
      } else if (b.status === "Cancelled") {
        kind = "cancelled";
        text = `${b.customer_name} cancelled their ${when} appointment`;
      } else if (b.status === "No Show") {
        kind = "noshow";
        text = `${b.customer_name} did not turn up on ${when}`;
      } else if (Number(b.deposit_paid) > 0) {
        kind = "payment";
        text = `${b.customer_name} booked${svc} for ${when} and paid £${Math.round(Number(b.deposit_paid))}`;
      }
      return {
        id: b.id,
        at: parseISO(b.created_at),
        kind,
        text,
        amount: Number(b.total_price) > 0 ? Number(b.total_price) : null,
        href: `/bookings?highlight=${b.id}`,
      };
    });
  }, [activityQ.data]);

  // ── ATTENTION ──────────────────────────────────────────────
  const unpaid = unpaidQ.data ?? [];
  const payLinks = payLinksQ.data ?? [];
  const unassignedToday = todayActive.filter((b: any) => !b.staff_id).length;
  const monthCancelled = monthBookings.filter((b: any) => b.status === "Cancelled").length;
  const cancellationRate =
    monthBookings.length >= 10 ? Math.round((monthCancelled / monthBookings.length) * 100) : null;

  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = [];

    if (unassignedToday > 0) {
      list.push({
        id: "unassigned",
        severity: "urgent",
        title: `${unassignedToday} appointment${unassignedToday > 1 ? "s" : ""} today with no groomer`,
        detail: "Assign a groomer so the day runs properly.",
        actionLabel: "Open today",
        href: "/bookings",
      });
    }

    if (balanceAfterBills !== null && balanceAfterBills < 0) {
      list.push({
        id: "bank",
        severity: "urgent",
        title: `Bank balance won't cover this week's bills`,
        detail: `£${Math.round(Math.abs(balanceAfterBills)).toLocaleString()} short once £${Math.round(billsDueThisWeek).toLocaleString()} of bills leave the account.`,
        actionLabel: "View finance",
        href: "/finance",
      });
    }

    if (unpaid.length > 0) {
      const amount = sum(unpaid, (b) => priceOf(b) - paidOn(b));
      list.push({
        id: "unpaid",
        severity: amount > 300 ? "urgent" : "attention",
        title: `£${Math.round(amount).toLocaleString()} unpaid across ${unpaid.length} finished appointment${unpaid.length > 1 ? "s" : ""}`,
        detail: "These customers have been seen but have a balance left on their booking.",
        actionLabel: "Review bookings",
        href: "/bookings",
        value: amount,
      });
    }

    if (payLinks.length > 0) {
      const amount = sum(payLinks, (p) => Number(p.amount || 0));
      list.push({
        id: "paylinks",
        severity: "attention",
        title: `${payLinks.length} payment link${payLinks.length > 1 ? "s" : ""} still unpaid`,
        detail: `£${Math.round(amount).toLocaleString()} has been requested but not paid yet.`,
        actionLabel: "View finance",
        href: "/finance",
        value: amount,
      });
    }

    if (projectedResult < 0) {
      list.push({
        id: "forecast",
        severity: projectedResult < -300 ? "urgent" : "attention",
        title: `${format(now, "MMMM")} is forecast below break-even`,
        detail: `About £${Math.round(breakEvenGap).toLocaleString()} more revenue is needed to break even this month.`,
        actionLabel: "View finance",
        href: "/finance",
        value: breakEvenGap,
      });
    }

    if ((inboxQ.data ?? 0) > 0) {
      list.push({
        id: "inbox",
        severity: "attention",
        title: `${inboxQ.data} missed call${(inboxQ.data ?? 0) > 1 ? "s" : ""} waiting in the AI inbox`,
        detail: "Nobody has picked these up yet.",
        actionLabel: "Open AI inbox",
        href: "/ai-inbox",
      });
    }

    if ((handoffsQ.data ?? 0) > 0) {
      list.push({
        id: "handoffs",
        severity: "attention",
        title: `${handoffsQ.data} chat${(handoffsQ.data ?? 0) > 1 ? "s" : ""} handed over by Scruff`,
        detail: "A customer asked to speak to a person.",
        actionLabel: "Open handoffs",
        href: "/admin/scruff/handoffs",
      });
    }

    if ((unreadSmsQ.data ?? 0) > 0) {
      list.push({
        id: "sms",
        severity: "info",
        title: `${unreadSmsQ.data} unread text message${(unreadSmsQ.data ?? 0) > 1 ? "s" : ""}`,
        detail: "Customers have replied and nobody has read it yet.",
        actionLabel: "Open messages",
        href: "/messages",
      });
    }

    if (cancellationRate !== null && cancellationRate >= 15) {
      list.push({
        id: "cancellations",
        severity: "attention",
        title: `${cancellationRate}% of this month's bookings were cancelled`,
        detail: `${monthCancelled} of ${monthBookings.length} appointments. Anything above roughly 12% is worth looking into.`,
        actionLabel: "See analytics",
        href: "/marketing/analytics",
        value: cancellationRate,
      });
    }

    if (groomersWorkingToday === 0 && todayActive.length > 0) {
      list.push({
        id: "nostaff",
        severity: "urgent",
        title: "Appointments today but no groomer is scheduled",
        detail: "Check the work schedule — someone needs to cover today.",
        actionLabel: "Work schedule",
        href: "/staff/schedule",
      });
    }

    const order = { urgent: 0, attention: 1, info: 2 };
    return list.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [
    unassignedToday,
    balanceAfterBills,
    billsDueThisWeek,
    unpaid,
    payLinks,
    projectedResult,
    breakEvenGap,
    inboxQ.data,
    handoffsQ.data,
    unreadSmsQ.data,
    cancellationRate,
    monthCancelled,
    monthBookings.length,
    groomersWorkingToday,
    todayActive.length,
  ]);

  // ── MARKETING ──────────────────────────────────────────────
  const visitors = analyticsQ.data?.summary?.totalVisitors ?? null;
  const onlineBookings = onlineBookingsQ.data ?? 0;
  const conversion = visitors && visitors > 0 ? Math.round((onlineBookings / visitors) * 1000) / 10 : null;

  const lastUpdatedAt = Math.max(
    monthBookingsQ.dataUpdatedAt || 0,
    cashFlowQ.dataUpdatedAt || 0,
    commissionsQ.dataUpdatedAt || 0,
  );

  return {
    isLoading: monthBookingsQ.isLoading || staffQ.isLoading,
    lastUpdatedAt: lastUpdatedAt > 0 ? lastUpdatedAt : null,
    ownerName: (profileQ.data?.full_name || user?.email?.split("@")[0] || "there").split(" ")[0],
    today: {
      date: today,
      appointments: todayActive,
      count: todayActive.length,
      scheduledRevenue: todayScheduledRevenue,
      collected: todayCollected,
      expectedCollections: todayExpected,
      groomersWorking: groomersWorkingToday,
      cancellations: todayCancellations,
      noShows: todayNoShows,
      availableHours: Math.max(0, Math.round(((todayRow.availableMinutes - todayRow.bookedMinutes) / 60) * 10) / 10),
      utilisation:
        todayRow.availableMinutes > 0
          ? Math.round((todayRow.bookedMinutes / todayRow.availableMinutes) * 100)
          : null,
    },
    money: {
      bankBalance,
      bankNotedAt: bankQ.data?.noted_at ? new Date(bankQ.data.noted_at) : null,
      billsDueThisWeek,
      balanceAfterBills,
      bills7d,
      cashReceived,
      revenueEarned,
      outstandingFromCompleted,
      futureBookedRevenue,
      groomerPayEarned,
      groomerPayProjected,
      billsPaid,
      billsRemaining,
      totalProjectedIncome,
      totalProjectedCosts,
      projectedResult,
      breakEvenGap,
      status: moneyStatus,
      monthName: format(now, "MMMM"),
    },
    week: {
      days: weekDays,
      appointments: weekActive.length,
      revenue: sum(weekActive, priceOf),
      utilisation: weekUtilisation,
      availableHours: Math.max(0, Math.round(((weekAvailableMinutes - weekBookedMinutes) / 60) * 10) / 10),
    },
    forward: {
      next30Count: next30.length,
      next30Revenue: sum(next30, priceOf),
      nextMonthName: format(nextMonthStart, "MMMM"),
      nextMonthCount,
      nextMonthRevenue: sum(nextMonth, priceOf),
      nextMonthHealth,
      avgMonthlyAppointments,
    },
    team,
    activity,
    alerts,
    marketing: { visitors, onlineBookings, conversion },
  };
}

export type OwnerDashboard = ReturnType<typeof useOwnerDashboard>;
