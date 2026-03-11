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
  nextSaturday, isSaturday, format,
} from "date-fns";

interface CashHealthSectionProps {
  upcomingRevenue: number;
}

/** Count Saturdays remaining in the current month from today (inclusive if today is Saturday) */
function countSaturdaysRemaining(today: Date): number {
  const monthEnd = endOfMonth(today);
  let count = 0;
  let d = new Date(today);
  if (isSaturday(d)) count++;
  d = nextSaturday(d);
  while (d <= monthEnd) {
    count++;
    d = nextSaturday(d);
  }
  return count;
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
      // Check this month and next month
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
            name: exp.name,
            amount,
            dueDate,
            daysUntilDue: differenceInDays(dueDate, today),
            category: exp.category || "other",
          });
        }
      }
    } else if (freq === "weekly") {
      // Find all weekly due dates in the next 35 days
      let d = new Date(today);
      // Weekly expenses: use start_date day-of-week or default to Monday
      const targetDow = startDate ? startDate.getDay() : 1;
      // Find next occurrence of that day
      while (d.getDay() !== targetDow) d = addDays(d, 1);
      while (d <= horizon) {
        if (startDate && isBefore(d, startDate)) { d = addDays(d, 7); continue; }
        if (endDate && isAfter(d, endDate)) break;
        bills.push({
          name: exp.name,
          amount,
          dueDate: d,
          daysUntilDue: differenceInDays(d, today),
          category: exp.category || "other",
        });
        d = addDays(d, 7);
      }
    } else if (freq === "annual") {
      if (!startDate) continue;
      // Check if anniversary falls within next 35 days
      for (let yearOff = 0; yearOff <= 1; yearOff++) {
        const annDate = new Date(today.getFullYear() + yearOff, startDate.getMonth(), getDate(startDate));
        if (annDate >= today && annDate <= horizon) {
          bills.push({
            name: exp.name,
            amount,
            dueDate: annDate,
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

  // Fetch one-off expenses due in next 35 days
  const today = new Date();
  const horizonStr = format(addDays(today, 35), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

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

  // Fetch groomer payout history (last 28 days)
  const fourWeeksAgo = format(addDays(today, -28), "yyyy-MM-dd");
  const { data: recentPayouts = [] } = useQuery({
    queryKey: ["cash-health-recent-payouts", fourWeeksAgo],
    queryFn: async () => {
      const { data } = await supabase
        .from("groomer_payout_history")
        .select("payout_amount, paid_at")
        .gte("paid_at", `${fourWeeksAgo}T00:00:00`);
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

  // Calculate upcoming bills from expenses
  const upcomingBills = useMemo(() => {
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

  const totalBills = upcomingBills.reduce((s, b) => s + b.amount, 0);

  // Groomer payouts calculation
  const saturdaysRemaining = countSaturdaysRemaining(today);
  const avgWeeklyPayout = useMemo(() => {
    if (recentPayouts.length === 0) return 0;
    const totalPaid = recentPayouts.reduce((s: number, p: any) => s + Number(p.payout_amount || 0), 0);
    return totalPaid / 4;
  }, [recentPayouts]);

  const groomerPayoutsThisMonth = avgWeeklyPayout * saturdaysRemaining;

  // Health check totals
  const hasBalance = !!latestBalance;
  const currentBalance = hasBalance ? Number(latestBalance.balance) : 0;
  const totalCommitments = totalBills + groomerPayoutsThisMonth;

  // FIX: Deduct 40% groomer commission from projected income
  const groomerCostOfRemainingIncome = upcomingRevenue * 0.40;
  const ownerNetRemaining = upcomingRevenue - groomerCostOfRemainingIncome;
  const projectedEndBalance = currentBalance + ownerNetRemaining;
  const showHealthCheck = hasBalance && totalCommitments > 0;

  const nextFirst = today.getDate() === 1
    ? startOfMonth(addMonths(today, 2))
    : startOfMonth(addMonths(today, 1));
  const daysUntil1st = differenceInDays(nextFirst, today);

  const shortfall = totalCommitments - projectedEndBalance;
  const isCovered = projectedEndBalance >= totalCommitments;
  const surplus = Math.abs(shortfall);

  // Determine at-risk bills
  const comfortMargin = projectedEndBalance - totalCommitments;
  const allCoveredComfortably = comfortMargin > 50;

  const billsWithRisk = useMemo(() => {
    let running = projectedEndBalance;
    return upcomingBills.map(b => {
      const atRisk = currentBalance < b.amount || running < b.amount;
      running -= b.amount;
      return { ...b, atRisk };
    });
  }, [upcomingBills, projectedEndBalance, currentBalance]);

  const atRiskBills = billsWithRisk.filter(b => b.atRisk);
  const coveredBills = billsWithRisk.filter(b => !b.atRisk);

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
        {upcomingBills.length === 0 && avgWeeklyPayout === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming expenses found</p>
        ) : (
          <div className="space-y-1 text-sm">
            {allCoveredComfortably && !showAllBills ? (
              <p className="text-sm text-green-700 font-medium">✅ All £{Math.round(totalBills).toLocaleString()} in upcoming bills are covered</p>
            ) : (
              <>
                {/* Show at-risk bills (always) */}
                {atRiskBills.map((b, i) => (
                  <div key={`risk-${i}`} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      🔴 {b.name}
                      <span className="text-muted-foreground text-xs">
                        {b.daysUntilDue === 0 ? "Today" : `in ${b.daysUntilDue}d`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">£{Math.round(b.amount).toLocaleString()}</span>
                      <span className="text-destructive text-xs font-medium">⚠️ AT RISK</span>
                    </span>
                  </div>
                ))}
                {/* Show covered bills only when toggled */}
                {showAllBills && coveredBills.map((b, i) => (
                  <div key={`cov-${i}`} className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      ✅ {b.name}
                      <span className="text-xs">
                        {b.daysUntilDue === 0 ? "Today" : `in ${b.daysUntilDue}d`}
                      </span>
                    </span>
                    <span className="font-semibold">£{Math.round(b.amount).toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
            {/* Toggle link */}
            {coveredBills.length > 0 && (
              <button
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllBills(v => !v)}
              >
                {showAllBills ? "Hide covered bills" : `Show all bills (${coveredBills.length} covered)`}
              </button>
            )}
            {avgWeeklyPayout > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Groomer Payouts
                  <span className="text-muted-foreground text-xs">{saturdaysRemaining} Sat{saturdaysRemaining !== 1 ? "s" : ""} left</span>
                </span>
                <span className="font-semibold">£{Math.round(groomerPayoutsThisMonth).toLocaleString()}</span>
              </div>
            )}
            <div className="border-t pt-1 flex items-center justify-between font-semibold">
              <span>Total commitments</span>
              <span>£{Math.round(totalCommitments).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION C: CASH HEALTH CHECK */}
      {showHealthCheck && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💊 Cash Health Check</h3>

          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Projected balance on 1st (after groomer pay)</p>
              <p className={`text-lg font-bold ${isCovered ? "text-green-600" : "text-destructive"}`}>
                £{Math.round(projectedEndBalance).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total commitments due</p>
              <p className="text-lg font-bold" style={{ color: "#2D1B0E" }}>
                £{Math.round(totalCommitments).toLocaleString()}
              </p>
            </div>
          </div>

          {isCovered ? (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#f0fdf4", borderColor: "#43a047" }}>
              <p className="text-sm font-medium text-green-700">
                ✅ You're covered — £{Math.round(surplus).toLocaleString()} to spare after commitments
              </p>
            </div>
          ) : daysUntil1st > 14 ? (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#fff8e7", borderColor: "#f59e0b" }}>
              <p className="text-sm font-medium text-amber-700">
                ⚠️ Currently £{Math.round(surplus).toLocaleString()} short — but {daysUntil1st} days to go, keep taking bookings
              </p>
            </div>
          ) : daysUntil1st > 7 ? (
            <div className="rounded-xl p-3" style={{ backgroundColor: "#FF6B35", color: "white" }}>
              <p className="text-sm font-medium">
                🔶 {daysUntil1st} days until commitments — £{Math.round(surplus).toLocaleString()} short. You need {Math.ceil(surplus / 52)} more bookings to cover this.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-3 border" style={{ backgroundColor: "#fee2e2", borderColor: "#ef4444" }}>
              <p className="text-sm font-bold text-red-700">
                🚨 {daysUntil1st} days left — £{Math.round(surplus).toLocaleString()} short of covering commitments. Consider whether you need a buffer.
              </p>
            </div>
          )}

          {/* Breakdown */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Show breakdown <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {/* Group 1: Upcoming Bills */}
              {upcomingBills.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">📋 Upcoming Bills (from Expenses)</p>
                  {upcomingBills.map((b, i) => {
                    const covered = projectedEndBalance >= b.amount;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs border-b pb-1">
                        <span className="flex-1">{b.name}</span>
                        <span className="text-muted-foreground w-20 text-center">{format(b.dueDate, "dd MMM")}</span>
                        <span className="text-muted-foreground w-16 text-center">{b.daysUntilDue === 0 ? "Today" : `${b.daysUntilDue}d`}</span>
                        <span className="font-medium w-16 text-right">£{Math.round(b.amount).toLocaleString()}</span>
                        <span className="w-20 text-right">{covered ? "✅ Covered" : "🔴 At risk"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Group 2: Groomer Payouts */}
              {avgWeeklyPayout > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">👥 Groomer Payouts</p>
                  <div className="flex items-center justify-between text-xs border-b pb-1">
                    <span>Groomer Payouts — ~£{Math.round(avgWeeklyPayout).toLocaleString()} × {saturdaysRemaining} Saturday{saturdaysRemaining !== 1 ? "s" : ""} = £{Math.round(groomerPayoutsThisMonth).toLocaleString()}</span>
                    <span>{projectedEndBalance >= groomerPayoutsThisMonth ? "✅ Covered" : "🔴 At risk"}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">(based on recent 4-week average)</p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <p className="text-[10px] text-muted-foreground">
            Based on £{Math.round(currentBalance).toLocaleString()} in bank + £{Math.round(upcomingRevenue).toLocaleString()} projected income (after ~40% groomer pay = £{Math.round(ownerNetRemaining).toLocaleString()} owner net)
          </p>
        </div>
      )}
    </>
  );
};

export default CashHealthSection;
