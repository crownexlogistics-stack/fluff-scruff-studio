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
  getDate,
  isAfter,
  isBefore,
  differenceInDays,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcDateAwareExpenses } from "@/lib/expenseCalc";

interface CashFlowResponse {
  total_cash: number;
}

const fmt0 = (n: number) =>
  `£${Math.round(Number(n) || 0).toLocaleString("en-GB")}`;

/**
 * Expand recurring + one-off expenses into individual due-date entries within
 * the next 35 days. Mirrors the logic in CashHealthSection so the two cards
 * always agree on "bills due this week".
 */
function expandUpcomingBills(
  recurring: any[],
  oneOff: any[],
  today: Date,
): { dueDate: Date; amount: number; daysUntilDue: number }[] {
  const horizon = addDays(today, 35);
  const out: { dueDate: Date; amount: number; daysUntilDue: number }[] = [];

  for (const exp of recurring) {
    const freq = exp.frequency || "monthly";
    const amount = Number(exp.amount || 0);
    if (amount <= 0) continue;

    const startDate = exp.recurring_start_date ? parseISO(exp.recurring_start_date) : null;
    const endDate = exp.recurring_end_date ? parseISO(exp.recurring_end_date) : null;
    if (endDate && isBefore(endDate, today)) continue;

    if (freq === "monthly") {
      const dueDay = startDate ? getDate(startDate) : 1;
      for (let offset = 0; offset <= 1; offset++) {
        const refMonth = addMonths(today, offset);
        const ms = startOfMonth(refMonth);
        const me = endOfMonth(refMonth);
        if (startDate && isAfter(startDate, me)) continue;
        if (endDate && isBefore(endDate, ms)) continue;
        const lastDay = getDate(me);
        const actualDay = Math.min(dueDay, lastDay);
        const dueDate = new Date(refMonth.getFullYear(), refMonth.getMonth(), actualDay);
        if (dueDate >= today && dueDate <= horizon) {
          out.push({ dueDate, amount, daysUntilDue: differenceInDays(dueDate, today) });
        }
      }
    } else if (freq === "weekly") {
      let d = new Date(today);
      const targetDow = startDate ? startDate.getDay() : 1;
      while (d.getDay() !== targetDow) d = addDays(d, 1);
      while (d <= horizon) {
        if (startDate && isBefore(d, startDate)) { d = addDays(d, 7); continue; }
        if (endDate && isAfter(d, endDate)) break;
        out.push({ dueDate: new Date(d), amount, daysUntilDue: differenceInDays(d, today) });
        d = addDays(d, 7);
      }
    } else if (freq === "annual") {
      if (!startDate) continue;
      for (let yearOff = 0; yearOff <= 1; yearOff++) {
        const annDate = new Date(today.getFullYear() + yearOff, startDate.getMonth(), getDate(startDate));
        if (annDate >= today && annDate <= horizon) {
          out.push({ dueDate: annDate, amount, daysUntilDue: differenceInDays(annDate, today) });
        }
      }
    }
  }

  for (const e of oneOff) {
    const amount = Number(e.amount || 0);
    if (amount <= 0 || !e.expense_date) continue;
    const dueDate = parseISO(e.expense_date);
    if (dueDate >= today && dueDate <= addDays(today, 35)) {
      out.push({ dueDate, amount, daysUntilDue: differenceInDays(dueDate, today) });
    }
  }

  return out;
}

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

  // 8. One-off expenses in the next 35 days — filtered client-side to match
  //    CashHealthSection's <= 7 day "due this week" window exactly.
  const horizonStr = format(addDays(todayStart, 35), "yyyy-MM-dd");
  const billsThisWeekQ = useQuery({
    queryKey: ["salon-summary-week-bills", todayStr, horizonStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .eq("expense_type", "one_off")
        .gte("expense_date", todayStr)
        .lte("expense_date", horizonStr);
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

  // This week alert — match CashHealthSection's logic exactly so the two
  // cards always display the same "Bills due this week" figure.
  // CashHealthSection filters expanded bills with `daysUntilDue <= 7` and
  // sums their amounts, covering recurring (monthly/weekly/annual) plus
  // one-off expenses.
  const bankBalance = Number(bankQ.data?.balance ?? 0);
  const billsDueThisWeek = useMemo(() => {
    const expanded = expandUpcomingBills(
      recurringQ.data ?? [],
      billsThisWeekQ.data ?? [],
      todayStart,
    );
    return expanded
      .filter((b) => b.daysUntilDue <= 7)
      .reduce((s, b) => s + b.amount, 0);
  }, [recurringQ.data, billsThisWeekQ.data, todayStart]);
  const afterBills = bankBalance - billsDueThisWeek;

  // Next month preview
  const nextMonthBookings = (nextMonthLiveQ.data ?? []).length + (nextMonthMigratedQ.data ?? []).length;
  const nextMonthValue =
    (nextMonthLiveQ.data ?? []).reduce((s, b: any) => s + Number(b.total_price || 0), 0) +
    (nextMonthMigratedQ.data ?? []).reduce((s, b: any) => s + Number(b.total_price || 0), 0);
  const nextMonthHealthy = nextMonthBookings >= 20;

  const lastUpdated = cashFlowQ.dataUpdatedAt ? new Date(cashFlowQ.dataUpdatedAt) : null;

  // ── First of Month Cover (only shown in last 10 days of month) ──
  const showFirstOfMonth = today.getDate() >= 20;
  const firstOfMonthBillsList = useMemo(() => {
    if (!showFirstOfMonth) return [] as { name: string; amount: number }[];
    return (recurringQ.data ?? [])
      .filter((e: any) => {
        const freq = e.frequency || "monthly";
        if (freq !== "monthly") return false;
        const startD = e.recurring_start_date as string | null;
        if (!startD) return false;
        if (parseISO(startD).getDate() !== 1) return false;
        const endD = e.recurring_end_date as string | null;
        if (endD && parseISO(endD) < nextMonthStart) return false;
        return Number(e.amount || 0) > 0;
      })
      .map((e: any) => ({ name: e.name as string, amount: Number(e.amount || 0) }))
      .sort((a, b) => b.amount - a.amount);
  }, [recurringQ.data, showFirstOfMonth, nextMonthStart]);
  const firstOfMonthBillsTotal = firstOfMonthBillsList.reduce((s, b) => s + b.amount, 0);
  const estimatedBalanceOn1st =
    bankBalance + confirmedUpcoming - groomerPayProjected - billsStillToPay;
  const firstOfMonthGap = firstOfMonthBillsTotal - estimatedBalanceOn1st;
  const suggestedLoan = firstOfMonthGap > 0 ? Math.ceil(firstOfMonthGap / 100) * 100 : 0;
  const nextMonthDay1Label = format(nextMonthStart, "d MMMM");

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
        <div
          className={cn(
            "rounded-md border p-3 text-sm",
            afterBills < 0
              ? "bg-red-50 border-red-300 dark:bg-red-950/20"
              : "bg-card",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>🏦 Bank balance: <strong>{fmt0(bankBalance)}</strong></span>
            <span className="text-muted-foreground">|</span>
            <span>Bills due this week: <strong>{fmt0(billsDueThisWeek)}</strong></span>
            <span className="text-muted-foreground">|</span>
            <span>
              After bills:{" "}
              <strong className={cn(afterBills < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                {afterBills < 0 ? `-${fmt0(Math.abs(afterBills))}` : fmt0(afterBills)}
              </strong>
            </span>
          </div>
          {afterBills < 0 && (
            <p className="mt-2 flex items-start gap-2 text-xs font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                ⚠️ Bank balance won't cover bills due this week — short by{" "}
                {fmt0(Math.abs(afterBills))}. Chase outstanding customer balances or
                delay non-essential spending.
              </span>
            </p>
          )}
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
