import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceExplainerButton } from "./FinanceExplainerDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcDateAwareExpenses } from "@/lib/expenseCalc";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth,
  isBefore,
  isAfter,
  parseISO,
  getDate,
} from "date-fns";
import { cn } from "@/lib/utils";

const MonthForecastCard = () => {
  const [forecastMonth, setForecastMonth] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const monthStart = startOfMonth(forecastMonth);
  const monthEnd = endOfMonth(forecastMonth);
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const isCurrentMonth = isSameMonth(forecastMonth, today);
  const isPastMonth = isBefore(monthEnd, today) && !isCurrentMonth;
  const isFutureMonth = isAfter(monthStart, today) && !isCurrentMonth;

  // ── Queries ──────────────────────────────────
  const queryOpts = { refetchInterval: 60000 };

  // Wix historical bookings for past months (pre-platform launch)
  const { data: wixHistorical = [], refetch: r9 } = useQuery({
    queryKey: ["forecast-wix-historical", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("wix_historical_bookings")
        .select("price_charged, revenue_recognised, appointment_date")
        .gte("appointment_date", `${startStr}T00:00:00`)
        .lte("appointment_date", `${endStr}T23:59:59`)
        .eq("revenue_recognised", true);
      return (data ?? []) as any[];
    },
    enabled: isPastMonth,
    ...queryOpts,
  });

  // Past bookings this month (earned revenue) — includes all statuses except cancelled/refunded
  const { data: completedBookings = [], refetch: r1 } = useQuery({
    queryKey: ["forecast-completed", startStr, endStr, todayStr],
    queryFn: async () => {
      const cutoff = isPastMonth ? endStr : todayStr;
      const { data } = await supabase
        .from("bookings")
        .select("id, total_price, deposit_paid, staff_id, is_groomers_own_customer, status")
        .gte("booking_date", startStr)
        .lte("booking_date", cutoff)
        .not("status", "in", '("Cancelled","No Show","Refunded")');
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  // Upcoming confirmed bookings this month (future dates only)
  const { data: upcomingBookings = [], refetch: r2 } = useQuery({
    queryKey: ["forecast-upcoming", startStr, endStr, todayStr],
    queryFn: async () => {
      if (isPastMonth) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, total_price, deposit_paid, staff_id, is_groomers_own_customer, status, booking_date")
        .gt("booking_date", isCurrentMonth ? todayStr : startStr)
        .lte("booking_date", endStr)
        .not("status", "in", '("Cancelled","No Show","Refunded")');
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  // Migrated bookings this month
  const { data: migratedCompleted = [], refetch: r3 } = useQuery({
    queryKey: ["forecast-migrated-completed", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("migrated_bookings")
        .select("total_price, booking_date")
        .gte("booking_date", startStr)
        .lte("booking_date", isCurrentMonth ? todayStr : endStr);
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  const { data: migratedUpcoming = [], refetch: r4 } = useQuery({
    queryKey: ["forecast-migrated-upcoming", startStr, endStr, todayStr],
    queryFn: async () => {
      if (isPastMonth) return [];
      const { data } = await supabase
        .from("migrated_bookings")
        .select("total_price, booking_date")
        .gt("booking_date", isCurrentMonth ? todayStr : startStr)
        .lte("booking_date", endStr)
        .eq("is_future_booking", true);
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  // Commission records this month
  const { data: commissions = [], refetch: r5 } = useQuery({
    queryKey: ["forecast-commissions", startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("groomer_pay, booking_id, created_at")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`);
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  // Recurring expenses
  const { data: recurringExpenses = [], refetch: r6 } = useQuery({
    queryKey: ["forecast-recurring"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  // One-off expenses in this month (paid)
  const { data: oneOffPaid = [], refetch: r7 } = useQuery({
    queryKey: ["forecast-oneoff-paid", startStr, endStr],
    queryFn: async () => {
      const cutoff = isPastMonth ? endStr : isCurrentMonth ? todayStr : startStr;
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", startStr)
        .lte("expense_date", cutoff);
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  // One-off expenses in this month (upcoming)
  const { data: oneOffUpcoming = [], refetch: r8 } = useQuery({
    queryKey: ["forecast-oneoff-upcoming", startStr, endStr],
    queryFn: async () => {
      if (isPastMonth) return [];
      const afterDate = isCurrentMonth ? todayStr : startStr;
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gt("expense_date", afterDate)
        .lte("expense_date", endStr);
      return (data ?? []) as any[];
    },
    ...queryOpts,
  });

  const handleRefresh = useCallback(() => {
    r1(); r2(); r3(); r4(); r5(); r6(); r7(); r8(); if (isPastMonth) r9();
    setLastRefresh(new Date());
  }, [r1, r2, r3, r4, r5, r6, r7, r8, r9, isPastMonth]);

  // ── Calculations ─────────────────────────────
  const wixHistoricalRevenue = wixHistorical.reduce((s: number, b: any) => s + Number(b.price_charged || 0), 0);

  const earnedRevenue = completedBookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0)
    + migratedCompleted.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  const upcomingRevenue = upcomingBookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0)
    + migratedUpcoming.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);

  const totalProjectedIncome = earnedRevenue + upcomingRevenue;

  const confirmedCount = completedBookings.length + upcomingBookings.length
    + migratedCompleted.length + migratedUpcoming.length;

  // Groomer pay from commission records (already checked out)
  const commissionBookingIds = useMemo(() => new Set(commissions.map((c: any) => c.booking_id).filter(Boolean)), [commissions]);
  const groomerPayPaid = commissions.reduce((s: number, c: any) => s + Number(c.groomer_pay || 0), 0);

  // Estimate groomer pay for past bookings that have NO commission record yet
  const groomerPayCompletedEstimate = useMemo(() => {
    return completedBookings
      .filter((b: any) => !commissionBookingIds.has(b.id))
      .reduce((s: number, b: any) => {
        const rate = b.is_groomers_own_customer ? 0.5 : 0.4;
        return s + Number(b.total_price || 0) * rate;
      }, 0);
  }, [completedBookings, commissionBookingIds]);

  // Estimate groomer pay on upcoming bookings (both main + migrated)
  const groomerPayUpcoming = useMemo(() => {
    const mainPay = upcomingBookings.reduce((s: number, b: any) => {
      const rate = b.is_groomers_own_customer ? 0.5 : 0.4;
      return s + Number(b.total_price || 0) * rate;
    }, 0);
    // Migrated bookings don't have is_groomers_own_customer, default to 40%
    const migratedPay = migratedUpcoming.reduce((s: number, b: any) => {
      return s + Number(b.total_price || 0) * 0.4;
    }, 0);
    return mainPay + migratedPay;
  }, [upcomingBookings, migratedUpcoming]);

  // Expenses
  const dateAware = calcDateAwareExpenses(recurringExpenses, forecastMonth, today);
  const billsPaid = (isPastMonth ? dateAware.fullMonthTotal : dateAware.paidTotal)
    + oneOffPaid.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const billsUpcoming = (isPastMonth ? 0 : dateAware.upcomingTotal)
    + oneOffUpcoming.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  const totalGroomerPay = groomerPayPaid + groomerPayCompletedEstimate + groomerPayUpcoming;
  const totalProjectedCosts = totalGroomerPay + billsPaid + billsUpcoming;
  const projectedProfit = totalProjectedIncome - totalProjectedCosts;
  const isProfitable = projectedProfit >= 0;

  // Breakeven
  const breakevenTarget = totalProjectedCosts;
  const breakevenProgress = breakevenTarget > 0 ? Math.min(100, Math.round((earnedRevenue / breakevenTarget) * 100)) : 100;
  const breakevenReached = earnedRevenue >= breakevenTarget;
  const breakevenColor = breakevenProgress >= 100
    ? "bg-green-500"
    : breakevenProgress >= 80
    ? "bg-green-500"
    : breakevenProgress >= 50
    ? "bg-amber-500"
    : "bg-destructive";

  return (
    <Card className={cn(
      "rounded-xl border-2",
      isProfitable ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10"
    )}>
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              📊 Month Forecast — {format(forecastMonth, "MMMM yyyy")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {isFutureMonth
                ? "Projection only — no bookings confirmed yet"
                : `Based on ${confirmedCount} confirmed appointment${confirmedCount !== 1 ? "s" : ""}. Updates automatically.`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setForecastMonth(m => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3"
              onClick={() => setForecastMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setForecastMonth(m => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-5">
        {/* INCOME */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Income</h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Earned so far</span>
              <span className="font-semibold">£{Math.round(earnedRevenue).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-blue-500" /> Confirmed upcoming</span>
              <span className="font-semibold">£{Math.round(upcomingRevenue).toLocaleString()}</span>
            </div>
            <div className="border-t pt-1.5 flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">💰 Total projected</span>
              <span className="text-green-600">£{Math.round(totalProjectedIncome).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* COSTS */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Costs</h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Groomer pay paid</span>
              <span className="font-semibold">£{Math.round(groomerPayPaid + groomerPayCompletedEstimate).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-blue-500" /> Groomer pay upcoming</span>
              <span className="font-semibold">£{Math.round(groomerPayUpcoming).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Bills paid</span>
              <span className="font-semibold">£{Math.round(billsPaid).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-blue-500" /> Bills still to pay</span>
              <span className="font-semibold">£{Math.round(billsUpcoming).toLocaleString()}</span>
            </div>
            <div className="border-t pt-1.5 flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">💸 Total projected costs</span>
              <span className="text-destructive">£{Math.round(totalProjectedCosts).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* PROFIT / LOSS */}
        <div className={cn(
          "rounded-lg p-4 text-center",
          isProfitable ? "bg-green-100/60 dark:bg-green-900/20" : "bg-amber-100/60 dark:bg-amber-900/20"
        )}>
          <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
            If nothing changes
          </p>
          <p className={cn(
            "text-3xl font-bold font-heading",
            isProfitable ? "text-green-600" : "text-destructive"
          )}>
            {isProfitable ? "🟢" : "🔴"} {isProfitable ? "PROFIT" : "LOSS"}: £{Math.abs(Math.round(projectedProfit)).toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {isProfitable
              ? "You are on track for a profitable month 🎉"
              : `You need £${Math.abs(Math.round(projectedProfit)).toLocaleString()} more in revenue to break even this month ⚠️`}
          </p>
        </div>

        {/* BREAKEVEN BAR */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Progress to breakeven this month
          </p>
          <div className="relative">
            <div className="h-4 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", breakevenColor)}
                style={{ width: `${breakevenProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>£0</span>
              <span>£{Math.round(breakevenTarget).toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {breakevenReached
              ? "✅ Break even reached! Every appointment from here is profit."
              : `£${Math.round(earnedRevenue).toLocaleString()} earned of £${Math.round(breakevenTarget).toLocaleString()} needed to break even`}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
            <FinanceExplainerButton forecastData={{
              month: format(forecastMonth, "MMMM yyyy"),
              total_appointments: confirmedCount,
              earned_so_far: Math.round(earnedRevenue),
              confirmed_upcoming: Math.round(upcomingRevenue),
              total_projected_income: Math.round(totalProjectedIncome),
              groomer_pay_paid: Math.round(groomerPayPaid + groomerPayCompletedEstimate),
              groomer_pay_upcoming: Math.round(groomerPayUpcoming),
              bills_paid: Math.round(billsPaid),
              bills_still_to_pay: Math.round(billsUpcoming),
              total_projected_costs: Math.round(totalProjectedCosts),
              projected_result: Math.round(projectedProfit),
              breakeven_gap: isProfitable ? 0 : Math.abs(Math.round(projectedProfit)),
            }} />
          </div>
          <span className="text-[10px] text-muted-foreground">
            Last updated: {format(lastRefresh, "HH:mm")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthForecastCard;
