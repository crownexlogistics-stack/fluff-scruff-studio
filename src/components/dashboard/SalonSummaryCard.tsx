import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  addMonths,
  addDays,
  parseISO,
  formatDistanceToNow,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcDateAwareExpenses } from "@/lib/expenseCalc";

interface CashFlowResponse {
  total_cash: number;
}

const fmt0 = (n: number) =>
  `£${Math.round(Number(n) || 0).toLocaleString("en-GB")}`;

const SalonSummaryCard = () => {
  const today = useMemo(() => new Date(), []);
  const todayStart = startOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const nextMonth = addMonths(today, 1);
  const nextMonthStart = startOfMonth(nextMonth);
  const nextMonthEnd = endOfMonth(nextMonth);

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");
  const todayStr = format(todayStart, "yyyy-MM-dd");
  const nextStartStr = format(nextMonthStart, "yyyy-MM-dd");
  const nextEndStr = format(nextMonthEnd, "yyyy-MM-dd");
  const monthName = format(today, "MMMM");
  const nextMonthName = format(nextMonth, "MMMM");

  // End of this week (Saturday)
  const dayIdx = today.getDay(); // 0 Sun ... 6 Sat
  const daysUntilSat = (6 - dayIdx + 7) % 7;
  const weekEnd = addDays(todayStart, daysUntilSat);
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  const [refreshing, setRefreshing] = useState(false);

  // 1. Cash received so far (Stripe + salon card via existing edge fn)
  const cashFlowQ = useQuery<CashFlowResponse>({
    queryKey: ["salon-summary-cashflow", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cash-flow", {
        body: { month_start: startStr, month_end: endStr },
      });
      if (error) throw error;
      return data as CashFlowResponse;
    },
    staleTime: 60_000,
  });

  // 2. Confirmed upcoming bookings this month (live)
  const upcomingLiveQ = useQuery({
    queryKey: ["salon-summary-upcoming-live", todayStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("total_price, status, booking_date")
        .gte("booking_date", todayStr)
        .lte("booking_date", endStr)
        .in("status", ["Confirmed", "Pending"]);
      return (data ?? []) as any[];
    },
  });

  // 2b. Confirmed upcoming migrated bookings this month
  const upcomingMigratedQ = useQuery({
    queryKey: ["salon-summary-upcoming-migrated", todayStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_bookings")
        .select("total_price, booking_date")
        .gte("booking_date", todayStr)
        .lte("booking_date", endStr)
        .eq("is_future_booking", true);
      return (data ?? []) as any[];
    },
  });

  // 3. Recurring expenses (full list)
  const recurringQ = useQuery({
    queryKey: ["salon-summary-recurring"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      return (data ?? []) as any[];
    },
  });

  // 4. One-off expenses this month (paid = on or before today)
  const oneOffPaidQ = useQuery({
    queryKey: ["salon-summary-oneoff-paid", startStr, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", startStr)
        .lte("expense_date", todayStr);
      return (data ?? []) as any[];
    },
  });

  // 5. One-off expenses upcoming (after today, on/before month end)
  const oneOffUpcomingQ = useQuery({
    queryKey: ["salon-summary-oneoff-upcoming", todayStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gt("expense_date", todayStr)
        .lte("expense_date", endStr);
      return (data ?? []) as any[];
    },
  });

  // 6. Groomer pay earned so far (commission_records this month)
  const commissionsQ = useQuery({
    queryKey: ["salon-summary-commissions", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("groomer_pay, created_at")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`);
      return (data ?? []) as any[];
    },
  });

  // 7. Bank balance (most recent snapshot)
  const bankQ = useQuery({
    queryKey: ["salon-summary-bank"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_balance_snapshots")
        .select("balance, noted_at")
        .order("noted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // 8. Bills due this week (one-off between today and Saturday)
  const billsThisWeekQ = useQuery({
    queryKey: ["salon-summary-week-bills", todayStr, weekEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", todayStr)
        .lte("expense_date", weekEndStr);
      return (data ?? []) as any[];
    },
  });

  // 9. Next month bookings (live + migrated)
  const nextMonthLiveQ = useQuery({
    queryKey: ["salon-summary-next-live", nextStartStr, nextEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("total_price, status, booking_date")
        .gte("booking_date", nextStartStr)
        .lte("booking_date", nextEndStr)
        .in("status", ["Confirmed", "Pending"]);
      return (data ?? []) as any[];
    },
  });

  const nextMonthMigratedQ = useQuery({
    queryKey: ["salon-summary-next-migrated", nextStartStr, nextEndStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_bookings")
        .select("total_price, booking_date")
        .gte("booking_date", nextStartStr)
        .lte("booking_date", nextEndStr)
        .eq("is_future_booking", true);
      return (data ?? []) as any[];
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        cashFlowQ.refetch(),
        upcomingLiveQ.refetch(),
        upcomingMigratedQ.refetch(),
        recurringQ.refetch(),
        oneOffPaidQ.refetch(),
        oneOffUpcomingQ.refetch(),
        commissionsQ.refetch(),
        bankQ.refetch(),
        billsThisWeekQ.refetch(),
        nextMonthLiveQ.refetch(),
        nextMonthMigratedQ.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [cashFlowQ, upcomingLiveQ, upcomingMigratedQ, recurringQ, oneOffPaidQ, oneOffUpcomingQ, commissionsQ, bankQ, billsThisWeekQ, nextMonthLiveQ, nextMonthMigratedQ]);

  // ── Calculations ──────────────────────────────
  const receivedSoFar = cashFlowQ.data?.total_cash ?? 0;

  const upcomingLive = upcomingLiveQ.data ?? [];
  const upcomingMigrated = upcomingMigratedQ.data ?? [];
  const confirmedUpcoming =
    upcomingLive.reduce((s, b: any) => s + Number(b.total_price || 0), 0) +
    upcomingMigrated.reduce((s, b: any) => s + Number(b.total_price || 0), 0);

  const projectedIncome = receivedSoFar + confirmedUpcoming;

  const dateAware = calcDateAwareExpenses(recurringQ.data ?? [], today, today);
  const billsPaidRecurring = dateAware.paidTotal;
  const billsUpcomingRecurring = dateAware.upcomingTotal;
  const billsPaidOneOff = (oneOffPaidQ.data ?? []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
  const billsUpcomingOneOff = (oneOffUpcomingQ.data ?? []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
  const billsPaid = billsPaidRecurring + billsPaidOneOff;
  const billsStillToPay = billsUpcomingRecurring + billsUpcomingOneOff;

  const groomerPayEarned = (commissionsQ.data ?? []).reduce(
    (s, c: any) => s + Number(c.groomer_pay || 0),
    0,
  );
  const groomerPayProjected = confirmedUpcoming * 0.42;

  const projectedOutgoings = billsPaid + billsStillToPay + groomerPayEarned + groomerPayProjected;

  const bottomLine = projectedIncome - projectedOutgoings;
  const bottomLineKind: "good" | "tight" | "bad" =
    bottomLine >= 0 ? "good" : bottomLine >= -200 ? "tight" : "bad";

  // This week alert
  const bankBalance = Number(bankQ.data?.balance ?? 0);
  const billsDueThisWeekOneOff = (billsThisWeekQ.data ?? []).reduce(
    (s, e: any) => s + Number(e.amount || 0),
    0,
  );
  // Recurring bills falling due this week (approx by recurring_start_date day-of-month)
  const billsDueThisWeekRecurring = (recurringQ.data ?? []).reduce((s, e: any) => {
    if ((e.frequency || "monthly") !== "monthly") return s;
    const startD = e.recurring_start_date as string | null;
    const endD = e.recurring_end_date as string | null;
    if (startD && parseISO(startD) > monthEnd) return s;
    if (endD && parseISO(endD) < monthStart) return s;
    const dueDay = startD ? parseISO(startD).getDate() : 1;
    const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (dueThisMonth >= todayStart && dueThisMonth <= weekEnd) {
      return s + Number(e.amount || 0);
    }
    return s;
  }, 0);
  const billsDueThisWeek = billsDueThisWeekOneOff + billsDueThisWeekRecurring;
  const afterBills = bankBalance - billsDueThisWeek;

  // Next month preview
  const nextMonthBookings = (nextMonthLiveQ.data ?? []).length + (nextMonthMigratedQ.data ?? []).length;
  const nextMonthValue =
    (nextMonthLiveQ.data ?? []).reduce((s, b: any) => s + Number(b.total_price || 0), 0) +
    (nextMonthMigratedQ.data ?? []).reduce((s, b: any) => s + Number(b.total_price || 0), 0);
  const nextMonthHealthy = nextMonthBookings >= 20;

  const lastUpdated = cashFlowQ.dataUpdatedAt ? new Date(cashFlowQ.dataUpdatedAt) : null;

  return (
    <Card className="rounded-xl border-2 border-orange-200 bg-orange-50/40 dark:bg-orange-950/10">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              📊 {monthName} at a Glance
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Your salon in plain numbers</p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[11px] text-muted-foreground">
                Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* MONEY IN */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Money in
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>💳 Received so far</span>
                <span className="font-semibold">{fmt0(receivedSoFar)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>📅 Confirmed upcoming appointments</span>
                <span className="font-semibold">{fmt0(confirmedUpcoming)}</span>
              </div>
              <div className="border-t pt-1.5 flex items-center justify-between text-sm font-semibold">
                <span>💰 Total projected income this month</span>
                <span className="text-green-600">{fmt0(projectedIncome)}</span>
              </div>
            </div>
          </div>

          {/* MONEY OUT */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Money out
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>✅ Bills paid this month</span>
                <span className="font-semibold">{fmt0(billsPaid)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>📋 Bills still to pay this month</span>
                <span className="font-semibold">{fmt0(billsStillToPay)}</span>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span>👩‍💼 Groomer pay earned so far</span>
                  <span className="font-semibold">{fmt0(groomerPayEarned)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-6">Based on completed appointments</p>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span>👩‍💼 Groomer pay projected by month end</span>
                  <span className="font-semibold">{fmt0(groomerPayProjected)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-6">
                  Estimated — actual depends on bookings completed
                </p>
              </div>
              <div className="border-t pt-1.5 flex items-center justify-between text-sm font-semibold">
                <span>💸 Total projected outgoings</span>
                <span className="text-destructive">{fmt0(projectedOutgoings)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM LINE */}
        <div
          className={cn(
            "rounded-lg p-4 text-center",
            bottomLineKind === "good" && "bg-green-100/60 dark:bg-green-900/20 border border-green-200",
            bottomLineKind === "tight" && "bg-amber-100/60 dark:bg-amber-900/20 border border-amber-200",
            bottomLineKind === "bad" && "bg-red-100/60 dark:bg-red-900/20 border border-red-200",
          )}
        >
          <p
            className={cn(
              "text-2xl font-bold",
              bottomLineKind === "good" && "text-green-700 dark:text-green-400",
              bottomLineKind === "tight" && "text-amber-700 dark:text-amber-400",
              bottomLineKind === "bad" && "text-red-700 dark:text-red-400",
            )}
          >
            {bottomLineKind === "good"
              ? `🟢 Projected month end: +${fmt0(bottomLine)}`
              : bottomLineKind === "tight"
              ? `🟡 Projected month end: -${fmt0(Math.abs(bottomLine))}`
              : `🔴 Projected month end: -${fmt0(Math.abs(bottomLine))}`}
          </p>
          <p className="text-sm mt-1 text-muted-foreground">
            {bottomLineKind === "good"
              ? "The salon is on track this month"
              : bottomLineKind === "tight"
              ? "Very tight this month — chase outstanding customer balances to close the gap"
              : "Action needed — income may not cover outgoings this month"}
          </p>
        </div>

        {/* THIS WEEK ALERT */}
        <div className="rounded-md bg-card border p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>🏦 Bank balance: <strong>{fmt0(bankBalance)}</strong></span>
          <span className="text-muted-foreground">|</span>
          <span>Bills due this week: <strong>{fmt0(billsDueThisWeek)}</strong></span>
          <span className="text-muted-foreground">|</span>
          <span>
            After bills:{" "}
            <strong className={cn(afterBills < 0 ? "text-red-600" : "text-green-600")}>
              {afterBills < 0 ? `-${fmt0(Math.abs(afterBills))}` : fmt0(afterBills)}
            </strong>
          </span>
        </div>

        {/* NEXT MONTH PREVIEW */}
        <div className="rounded-md bg-muted/40 border p-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Next Month Preview
          </p>
          <p className="text-sm">
            📅 {nextMonthName} bookings already confirmed:{" "}
            <strong>{nextMonthBookings} appointment{nextMonthBookings === 1 ? "" : "s"}</strong>{" "}
            worth <strong>{fmt0(nextMonthValue)}</strong>
          </p>
          <p className="text-sm">
            💡 You already have <strong>{fmt0(nextMonthValue)}</strong> of next month's income secured.
          </p>
          <p className={cn("text-sm", nextMonthHealthy ? "text-green-700" : "text-amber-700")}>
            {nextMonthHealthy
              ? "✅ Next month is looking healthy"
              : "⚠️ Next month looks quiet — consider sending a marketing campaign to fill the calendar"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalonSummaryCard;
