import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  formatDistanceToNow, addMonths, addDays, startOfMonth, endOfMonth,
  differenceInDays, parseISO, getDate, isBefore, isAfter, isSameMonth,
  nextSaturday, isSaturday, format, startOfWeek,
} from "date-fns";

interface CashHealthSectionProps {
  upcomingRevenue: number;
}

interface UpcomingBill {
  name: string;
  amount: number;
  dueDate: Date;
  daysUntilDue: number;
  category: string;
}

/** Calculate upcoming bills from recurring expenses within next 35 days */
function getUpcomingBills(expenses: any[], today: Date): UpcomingBill[] {
  const horizon = addDays(today, 35);
  const bills: UpcomingBill[] = [];

  for (const exp of expenses) {
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
        const monthStart = startOfMonth(refMonth);
        const monthEnd2 = endOfMonth(refMonth);
        if (startDate && isAfter(startDate, monthEnd2)) continue;
        if (endDate && isBefore(endDate, monthStart)) continue;
        const lastDayOfMonth = getDate(monthEnd2);
        const actualDay = Math.min(dueDay, lastDayOfMonth);
        const dueDate = new Date(refMonth.getFullYear(), refMonth.getMonth(), actualDay);
        if (dueDate >= today && dueDate <= horizon) {
          bills.push({
            name: exp.name, amount, dueDate,
            daysUntilDue: differenceInDays(dueDate, today),
            category: exp.category || "other",
          });
        }
      }
    } else if (freq === "weekly") {
      let d = new Date(today);
      const targetDow = startDate ? startDate.getDay() : 1;
      while (d.getDay() !== targetDow) d = addDays(d, 1);
      while (d <= horizon) {
        if (startDate && isBefore(d, startDate)) { d = addDays(d, 7); continue; }
        if (endDate && isAfter(d, endDate)) break;
        bills.push({
          name: exp.name, amount, dueDate: d,
          daysUntilDue: differenceInDays(d, today),
          category: exp.category || "other",
        });
        d = addDays(d, 7);
      }
    } else if (freq === "annual") {
      if (!startDate) continue;
      for (let yearOff = 0; yearOff <= 1; yearOff++) {
        const annDate = new Date(today.getFullYear() + yearOff, startDate.getMonth(), getDate(startDate));
        if (annDate >= today && annDate <= horizon) {
          bills.push({
            name: exp.name, amount, dueDate: annDate,
            daysUntilDue: differenceInDays(annDate, today),
            category: exp.category || "other",
          });
        }
      }
    }
  }

  return bills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

const CashHealthSection = ({ upcomingRevenue }: CashHealthSectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [balanceInput, setBalanceInput] = useState<number>(0);
  const [showAllBills, setShowAllBills] = useState(false);

  // Fetch latest bank balance
  const { data: latestBalance } = useQuery({
    queryKey: ["bank-balance-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_balance_snapshots")
        .select("*")
        .order("noted_at", { ascending: false })
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  // Fetch recurring expenses
  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ["cash-health-recurring-expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      return (data ?? []) as any[];
    },
  });

  // Date boundaries — week is Monday 00:00 to Saturday 23:59
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const horizonStr = format(addDays(today, 35), "yyyy-MM-dd");
  const weekMonday = startOfWeek(today, { weekStartsOn: 1 });
  const weekMondayStr = format(weekMonday, "yyyy-MM-dd");
  const nextSat = isSaturday(today) ? today : nextSaturday(today);
  const nextSatStr = format(nextSat, "yyyy-MM-dd");
  const daysUntilSaturday = differenceInDays(nextSat, today);

  // Fetch one-off expenses due in next 35 days
  const { data: oneOffExpenses = [] } = useQuery({
    queryKey: ["cash-health-oneoff-expenses", todayStr, horizonStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, name, category, amount, expense_date")
        .eq("expense_type", "one_off")
        .gte("expense_date", todayStr)
        .lte("expense_date", horizonStr);
      return (data ?? []) as any[];
    },
  });

  // Fetch ALL bookings Mon–Sat this week with staff info and booking_date
  const { data: weekGroomerBookings = [] } = useQuery({
    queryKey: ["cash-health-week-groomer", weekMondayStr, nextSatStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, total_price, is_groomers_own_customer, staff_id, deposit_paid, status, booking_date, staff(name)")
        .gte("booking_date", weekMondayStr)
        .lte("booking_date", nextSatStr)
        .not("staff_id", "is", null);
      return (data ?? []) as any[];
    },
  });

  // Fetch remaining bookings (today–Saturday) for owner revenue projection (includes bookings without staff)
  const { data: remainingWeekBookings = [] } = useQuery({
    queryKey: ["cash-health-remaining-week", todayStr, nextSatStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("total_price")
        .gte("booking_date", todayStr)
        .lte("booking_date", nextSatStr)
        .in("status", ["Confirmed", "Pending"]);
      return (data ?? []) as any[];
    },
  });

  // Check if groomers have already been paid for this week
  const { data: weekPaidPayouts = [] } = useQuery({
    queryKey: ["cash-health-week-paid", weekMondayStr, nextSatStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("groomer_payout_history")
        .select("groomer_id")
        .gte("period_end", weekMondayStr)
        .lte("period_start", nextSatStr);
      return (data ?? []) as any[];
    },
  });

  // Get user profile name
  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userName = profile?.full_name || user?.email || "Unknown";

  // Save balance mutation
  const saveBalanceMutation = useMutation({
    mutationFn: async (balance: number) => {
      const { error } = await supabase.from("bank_balance_snapshots").insert({
        balance,
        noted_by: userName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-balance-latest"] });
      setShowBalanceForm(false);
      setBalanceInput(0);
      toast({ title: "✅ Bank balance updated" });
    },
  });

  // ── EXPENSE BILLS ──
  const allBills35 = useMemo(() => {
    const recurringBills = getUpcomingBills(recurringExpenses, today);
    const oneOffBills: UpcomingBill[] = oneOffExpenses.map((e: any) => ({
      name: e.name,
      amount: Number(e.amount || 0),
      dueDate: parseISO(e.expense_date),
      daysUntilDue: differenceInDays(parseISO(e.expense_date), today),
      category: e.category || "other",
    }));
    return [...recurringBills, ...oneOffBills].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [recurringExpenses, oneOffExpenses, todayStr]);

  const expenseBills7Day = allBills35.filter(b => b.daysUntilDue <= 7);
  const billsBeyond7Day = allBills35.filter(b => b.daysUntilDue > 7);
  const expenseBills7DayTotal = expenseBills7Day.reduce((s, b) => s + b.amount, 0);

  // ── GROOMER PAYOUTS — FULL WEEK PROJECTION ──
  interface GroomerProjection {
    staffId: string;
    name: string;
    completedPay: number;
    projectedPay: number;
    remainingBookingsCount: number;
    totalPay: number;
  }

  const groomerProjections = useMemo((): GroomerProjection[] => {
    const paidGroomerIds = new Set(weekPaidPayouts.map((p: any) => p.groomer_id));
    const byGroomer: Record<string, { name: string; completedPay: number; projectedPay: number; remainingCount: number }> = {};

    for (const b of weekGroomerBookings) {
      if (!b.staff_id || paidGroomerIds.has(b.staff_id)) continue;
      const staffName = (b.staff as any)?.name || "Unknown";
      if (!byGroomer[b.staff_id]) {
        byGroomer[b.staff_id] = { name: staffName, completedPay: 0, projectedPay: 0, remainingCount: 0 };
      }

      const rate = b.is_groomers_own_customer ? 0.5 : 0.4;

      if (b.status === "Completed") {
        byGroomer[b.staff_id].completedPay += Number(b.total_price || 0) * rate;
      } else if (b.status === "No Show") {
        byGroomer[b.staff_id].completedPay += Number(b.deposit_paid || 0) * 0.5;
      } else if (["Confirmed", "Pending"].includes(b.status) && b.booking_date >= todayStr) {
        byGroomer[b.staff_id].projectedPay += Number(b.total_price || 0) * rate;
        byGroomer[b.staff_id].remainingCount += 1;
      }
    }

    return Object.entries(byGroomer)
      .map(([staffId, g]) => ({
        staffId,
        name: g.name,
        completedPay: Math.round(g.completedPay * 100) / 100,
        projectedPay: Math.round(g.projectedPay * 100) / 100,
        remainingBookingsCount: g.remainingCount,
        totalPay: Math.round((g.completedPay + g.projectedPay) * 100) / 100,
      }))
      .filter(g => g.totalPay > 0)
      .sort((a, b) => b.totalPay - a.totalPay);
  }, [weekGroomerBookings, weekPaidPayouts, todayStr]);

  const totalCompletedGroomerPay = groomerProjections.reduce((s, g) => s + g.completedPay, 0);
  const totalProjectedAdditionalGroomerPay = groomerProjections.reduce((s, g) => s + g.projectedPay, 0);
  const totalSaturdayPayout = totalCompletedGroomerPay + totalProjectedAdditionalGroomerPay;

  // ── REMAINING REVENUE (owner net) ──
  const remainingRevenue = remainingWeekBookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const ownerNetRemaining = remainingRevenue * 0.60;

  // ── TOTALS ──
  // bills_due_this_week = total_saturday_payout + expense_bills
  const totalBills7Day = totalSaturdayPayout + expenseBills7DayTotal;

  const hasBalance = !!latestBalance;
  const currentBalance = hasBalance ? Number(latestBalance.balance) : 0;

  // projected_7day_balance = bank + ownerNet - completedGroomerPay - expenseBills
  // (projected groomer pay is already excluded from ownerNet via the 0.60 factor)
  const finalBalance = currentBalance + ownerNetRemaining - totalCompletedGroomerPay - expenseBills7DayTotal;
  const showHealthCheck = hasBalance;

  // For banner: is everything covered?
  const isCovered7Day = finalBalance >= 0;
  const shortfall7Day = Math.max(0, -finalBalance);
  const surplus7Day = Math.max(0, finalBalance);

  const nextBillDaysAway = billsBeyond7Day.length > 0 ? billsBeyond7Day[0].daysUntilDue : null;
  const hasAnyCommitments = groomerProjections.length > 0 || expenseBills7Day.length > 0;

  // ── COMBINED COMMITMENTS WITH RISK ──
  const allCommitments7DayWithRisk = useMemo(() => {
    const items: { name: string; amount: number; dueLabel: string; type: "groomer" | "expense"; atRisk: boolean; detail?: string }[] = [];
    let running = currentBalance + ownerNetRemaining;

    // Add groomer payouts first
    for (const g of groomerProjections) {
      const atRisk = running < g.totalPay;
      running -= g.totalPay;
      const detail = g.remainingBookingsCount > 0
        ? `£${Math.round(g.completedPay).toLocaleString()} earned + ~£${Math.round(g.projectedPay).toLocaleString()} from ${g.remainingBookingsCount} remaining`
        : `£${Math.round(g.completedPay).toLocaleString()} earned`;
      items.push({
        name: `👤 ${g.name}`,
        amount: g.totalPay,
        dueLabel: "due Saturday",
        type: "groomer",
        atRisk,
        detail,
      });
    }

    // Add expense bills
    for (const b of expenseBills7Day) {
      const atRisk = running < b.amount;
      running -= b.amount;
      items.push({
        name: b.name,
        amount: b.amount,
        dueLabel: b.daysUntilDue === 0 ? "Today" : `in ${b.daysUntilDue}d`,
        type: "expense",
        atRisk,
      });
    }

    return items;
  }, [groomerProjections, expenseBills7Day, currentBalance, ownerNetRemaining]);

  const atRiskItems = allCommitments7DayWithRisk.filter(b => b.atRisk);
  const coveredItems = allCommitments7DayWithRisk.filter(b => !b.atRisk);

  return (
    <>
      {/* SECTION A: BANK BALANCE */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🏦 Bank Balance</h3>
        {hasBalance ? (
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xl font-bold" style={{ color: "#2D1B0E" }}>
                Current balance: £{Math.round(Number(latestBalance.balance)).toLocaleString()}
              </span>
              {!showBalanceForm && (
                <Button variant="outline" size="sm" className="h-7 text-xs" style={{ borderColor: "#FF6B35", color: "#FF6B35" }} onClick={() => { setShowBalanceForm(true); setBalanceInput(Number(latestBalance.balance)); }}>
                  Update Balance
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated: {formatDistanceToNow(new Date(latestBalance.noted_at), { addSuffix: true })} by {latestBalance.noted_by}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">No balance recorded yet</span>
            {!showBalanceForm && (
              <Button variant="outline" size="sm" className="h-7 text-xs" style={{ borderColor: "#FF6B35", color: "#FF6B35" }} onClick={() => setShowBalanceForm(true)}>
                Update Balance
              </Button>
            )}
          </div>
        )}
        {showBalanceForm && (
          <div className="flex items-end gap-2 mt-1">
            <div>
              <label className="text-xs text-muted-foreground">Enter current bank balance £</label>
              <NumericInput value={balanceInput} onValueChange={setBalanceInput} className="h-8 text-sm w-40" />
            </div>
            <Button size="sm" className="h-8 text-xs" style={{ backgroundColor: "#FF6B35", color: "white" }} onClick={() => saveBalanceMutation.mutate(balanceInput)} disabled={saveBalanceMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowBalanceForm(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* SECTION B: UPCOMING COMMITMENTS */}
      <div className="space-y-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📅 Upcoming Commitments</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pulled automatically from your Expenses section</p>
        </div>
        <div className="space-y-1 text-sm">
          {!hasAnyCommitments ? (
            <p className="text-sm text-green-700 font-medium">
              ✅ No bills due in the next 7 days
              {nextBillDaysAway !== null && <span className="text-muted-foreground font-normal text-xs ml-1">(next in {nextBillDaysAway} days)</span>}
            </p>
          ) : (
            <>
              {/* At-risk items */}
              {atRiskItems.map((b, i) => (
                <div key={`risk-${i}`} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      🔴 {b.name}
                      <span className="text-muted-foreground text-xs">{b.dueLabel}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">~£{Math.round(b.amount).toLocaleString()}</span>
                      <span className="text-destructive text-xs font-medium">⚠️ AT RISK</span>
                    </span>
                  </div>
                  {b.detail && (
                    <p className="text-[10px] text-muted-foreground ml-6">{b.detail}</p>
                  )}
                </div>
              ))}
              {/* Covered items */}
              {coveredItems.map((b, i) => (
                <div key={`cov-${i}`} className="space-y-0.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      ✅ {b.name}
                      <span className="text-xs">{b.dueLabel}</span>
                    </span>
                    <span className="font-semibold">{b.type === "groomer" ? "~" : ""}£{Math.round(b.amount).toLocaleString()}</span>
                  </div>
                  {b.detail && (
                    <p className="text-[10px] text-muted-foreground ml-6">{b.detail}</p>
                  )}
                </div>
              ))}

              {/* Groomer subtotal */}
              {groomerProjections.length > 0 && (
                <div className="pt-1">
                  <div className="text-xs font-medium">
                    Total groomer payouts Saturday: ~£{Math.round(totalSaturdayPayout).toLocaleString()}
                  </div>
                  <p className="text-[10px] text-muted-foreground">(includes completed + projected)</p>
                </div>
              )}
            </>
          )}

          {/* Show all toggle for 35-day view */}
          {billsBeyond7Day.length > 0 && (
            <button
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowAllBills(v => !v)}
            >
              {showAllBills ? "Hide future bills" : `Show all bills (${billsBeyond7Day.length} in next 35 days)`}
            </button>
          )}
          {showAllBills && billsBeyond7Day.map((b, i) => (
            <div key={`future-${i}`} className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-2">
                {b.name}
                <span className="text-xs">in {b.daysUntilDue}d</span>
              </span>
              <span className="font-semibold">£{Math.round(b.amount).toLocaleString()}</span>
            </div>
          ))}

          {hasAnyCommitments && (
            <div className="border-t pt-1 flex items-center justify-between font-semibold">
              <span>Total due this week</span>
              <span>~£{Math.round(totalBills7Day).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION C: CASH HEALTH CHECK */}
      {showHealthCheck && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💊 Cash Health Check</h3>

          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Balance after Saturday payout</p>
              <p className={`text-lg font-bold ${isCovered7Day ? "text-green-600" : "text-destructive"}`}>
                £{Math.round(finalBalance).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bills due this week</p>
              <p className={`text-lg font-bold ${totalBills7Day === 0 ? "text-green-600" : ""}`} style={totalBills7Day > 0 ? { color: "#2D1B0E" } : undefined}>
                ~£{Math.round(totalBills7Day).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Banner logic */}
          {!hasAnyCommitments ? (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#f0fdf4", borderColor: "#43a047" }}>
              <p className="text-sm font-medium text-green-700">
                ✅ Nothing due this week{nextBillDaysAway !== null ? ` — next bill in ${nextBillDaysAway} days` : ""}
              </p>
            </div>
          ) : isCovered7Day ? (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#f0fdf4", borderColor: "#43a047" }}>
              <p className="text-sm font-medium text-green-700">
                ✅ This week's bills are covered — £{Math.round(surplus7Day).toLocaleString()} to spare
              </p>
            </div>
          ) : (ownerNetRemaining > 0 && (currentBalance + ownerNetRemaining) >= (totalCompletedGroomerPay + expenseBills7DayTotal)) ? (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#fff8e7", borderColor: "#f59e0b" }}>
              <p className="text-sm font-medium text-amber-700">
                ⚠️ ~£{Math.round(shortfall7Day).toLocaleString()} short for this week's bills — but covered if all remaining appointments take place
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#fee2e2", borderColor: "#ef4444" }}>
              <p className="text-sm font-bold text-red-700">
                🚨 ~£{Math.round(shortfall7Day).toLocaleString()} short for this week's bills even with all upcoming appointments. Action needed.
              </p>
            </div>
          )}

          {/* Breakdown */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Show breakdown <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {groomerProjections.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">👥 Groomer Payouts — this Saturday</p>
                  {groomerProjections.map((g, i) => (
                    <div key={i} className="text-xs border-b pb-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="flex-1 font-medium">👤 {g.name}</span>
                        <span className="font-medium w-20 text-right">~£{Math.round(g.totalPay).toLocaleString()}</span>
                      </div>
                      <div className="text-muted-foreground pl-4">
                        £{g.completedPay.toFixed(2)} earned
                        {g.remainingBookingsCount > 0 && (
                          <> + ~£{Math.round(g.projectedPay).toLocaleString()} from {g.remainingBookingsCount} remaining booking{g.remainingBookingsCount !== 1 ? "s" : ""}</>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs font-semibold pt-0.5">
                    <span>Total Saturday payout</span>
                    <span>~£{Math.round(totalSaturdayPayout).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">(includes completed + projected from remaining bookings)</p>
                </div>
              )}

              {expenseBills7Day.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">📋 Bills due this week</p>
                  {expenseBills7Day.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b pb-1">
                      <span className="flex-1">{b.name}</span>
                      <span className="text-muted-foreground w-20 text-center">{format(b.dueDate, "dd MMM")}</span>
                      <span className="text-muted-foreground w-16 text-center">{b.daysUntilDue === 0 ? "Today" : `${b.daysUntilDue}d`}</span>
                      <span className="font-medium w-16 text-right">£{Math.round(b.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <p className="text-[10px] text-muted-foreground">
            £{Math.round(currentBalance).toLocaleString()} in bank + £{Math.round(ownerNetRemaining).toLocaleString()} owner net from remaining bookings this week − £{totalCompletedGroomerPay.toFixed(2)} groomer pay earned so far − ~£{Math.round(totalProjectedAdditionalGroomerPay).toLocaleString()} projected groomer pay from remaining bookings − £{Math.round(expenseBills7DayTotal).toLocaleString()} in bills due this week = £{Math.round(finalBalance).toLocaleString()} projected balance after Saturday payout
          </p>
        </div>
      )}
    </>
  );
};

export default CashHealthSection;
