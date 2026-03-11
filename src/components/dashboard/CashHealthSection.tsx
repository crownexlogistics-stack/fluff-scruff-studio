import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, X, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, addMonths, startOfMonth, endOfMonth, differenceInDays, nextSaturday, isSaturday, eachWeekOfInterval, addDays } from "date-fns";

interface CashHealthSectionProps {
  upcomingRevenue: number;
}

/** Count Saturdays remaining in the current month from today (inclusive of today if Saturday) */
function countSaturdaysRemaining(today: Date): number {
  const monthEnd = endOfMonth(today);
  let count = 0;
  let d = new Date(today);
  // If today is Saturday, count it
  if (isSaturday(d)) count++;
  // Move to next Saturday
  d = nextSaturday(d);
  while (d <= monthEnd) {
    count++;
    d = nextSaturday(d);
  }
  return count;
}

const CashHealthSection = ({ upcomingRevenue }: CashHealthSectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [balanceInput, setBalanceInput] = useState<number>(0);
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commitmentForm, setCommitmentForm] = useState({ name: "", amount: 0, due_day: 1, category: "other", frequency: "monthly" });

  // Fetch latest bank balance
  const { data: latestBalance, refetch: refetchBalance } = useQuery({
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

  // Fetch monthly commitments
  const { data: commitments = [], refetch: refetchCommitments } = useQuery({
    queryKey: ["monthly-commitments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_commitments")
        .select("*")
        .eq("is_active", true)
        .order("due_day", { ascending: true });
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

  // Add/update commitment mutation
  const saveCommitmentMutation = useMutation({
    mutationFn: async (form: typeof commitmentForm & { id?: string }) => {
      const payload: any = {
        name: form.name, amount: form.amount, due_day: form.due_day, category: form.category, frequency: form.frequency,
      };
      if (form.id) {
        const { error } = await supabase.from("monthly_commitments").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_commitments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-commitments"] });
      setShowAddCommitment(false);
      setEditingId(null);
      setCommitmentForm({ name: "", amount: 0, due_day: 1, category: "other", frequency: "monthly" });
      toast({ title: "✅ Commitment saved" });
    },
  });

  // Delete commitment mutation
  const deleteCommitmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_commitments").update({ is_active: false } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-commitments"] });
      toast({ title: "✅ Commitment removed" });
    },
  });

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setCommitmentForm({ name: c.name, amount: Number(c.amount), due_day: c.due_day, category: c.category || "other", frequency: c.frequency || "monthly" });
    setShowAddCommitment(false);
  };

  const today = new Date();
  const saturdaysRemaining = countSaturdaysRemaining(today);

  // Cash Health Check calculations
  const hasBalance = !!latestBalance;
  const activeCommitmentsWithAmount = commitments.filter((c: any) => Number(c.amount) > 0);
  const showHealthCheck = hasBalance && activeCommitmentsWithAmount.length > 0;

  const currentBalance = hasBalance ? Number(latestBalance.balance) : 0;

  // Total commitments this month: monthly amounts + (weekly amount × saturdays remaining)
  const totalCommitments = useMemo(() => {
    return activeCommitmentsWithAmount.reduce((s: number, c: any) => {
      const amt = Number(c.amount);
      if ((c.frequency || "monthly") === "weekly") {
        return s + amt * saturdaysRemaining;
      }
      return s + amt;
    }, 0);
  }, [activeCommitmentsWithAmount, saturdaysRemaining]);

  const projectedEndBalance = currentBalance + upcomingRevenue;

  const nextFirst = today.getDate() === 1
    ? startOfMonth(addMonths(today, 2))
    : startOfMonth(addMonths(today, 1));
  const daysUntil1st = differenceInDays(nextFirst, today);

  const shortfall = totalCommitments - projectedEndBalance;
  const isCovered = projectedEndBalance >= totalCommitments;
  const surplus = Math.abs(shortfall);

  const isWeekly = commitmentForm.frequency === "weekly";

  const commitmentFormUI = (
    <div className="flex flex-wrap gap-2 items-end mt-2">
      <div className="flex-1 min-w-[120px]">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input value={commitmentForm.name} onChange={e => setCommitmentForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rent" className="h-8 text-sm" />
      </div>
      <div className="w-24">
        <label className="text-xs text-muted-foreground">Amount £</label>
        <NumericInput value={commitmentForm.amount} onValueChange={v => setCommitmentForm(f => ({ ...f, amount: v }))} className="h-8 text-sm" />
      </div>
      {/* Frequency toggle */}
      <div className="w-48">
        <label className="text-xs text-muted-foreground">Frequency</label>
        <Select value={commitmentForm.frequency} onValueChange={v => setCommitmentForm(f => ({ ...f, frequency: v }))}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly (fixed date)</SelectItem>
            <SelectItem value="weekly">Weekly (every Saturday)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!isWeekly && (
        <div className="w-20">
          <label className="text-xs text-muted-foreground">Due day</label>
          <NumericInput value={commitmentForm.due_day} onValueChange={v => setCommitmentForm(f => ({ ...f, due_day: Math.max(1, Math.min(31, v)) }))} allowDecimals={false} className="h-8 text-sm" />
        </div>
      )}
      <div className="w-32">
        <label className="text-xs text-muted-foreground">Category</label>
        <Select value={commitmentForm.category} onValueChange={v => setCommitmentForm(f => ({ ...f, category: v }))}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rent">Rent</SelectItem>
            <SelectItem value="wages">Wages</SelectItem>
            <SelectItem value="software">Software</SelectItem>
            <SelectItem value="card_fees">Card Fees</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" className="h-8 text-xs" style={{ backgroundColor: "#FF6B35", color: "white" }} onClick={() => saveCommitmentMutation.mutate({ ...commitmentForm, id: editingId || undefined })} disabled={!commitmentForm.name || saveCommitmentMutation.isPending}>
        {editingId ? "Save" : "Add"}
      </Button>
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowAddCommitment(false); setEditingId(null); setCommitmentForm({ name: "", amount: 0, due_day: 1, category: "other", frequency: "monthly" }); }}>
        Cancel
      </Button>
    </div>
  );

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

      {/* SECTION B: MONTHLY COMMITMENTS */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📅 Monthly Commitments</h3>
        <div className="space-y-1">
          {commitments.map((c: any) => {
            const freq = c.frequency || "monthly";
            return (
              <div key={c.id} className="flex items-center justify-between text-sm">
                {editingId === c.id ? commitmentFormUI : (
                  <>
                    <span className="flex items-center gap-2">
                      {c.name}
                      <span className="text-muted-foreground text-xs">
                        {freq === "weekly" ? "Every Saturday" : `Day ${c.due_day}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {Number(c.amount) === 0 ? (
                        <span className="text-amber-600 text-xs">⚠️ Amount not set</span>
                      ) : (
                        <span className="font-semibold">
                          £{Math.round(Number(c.amount)).toLocaleString()}
                          {freq === "weekly" && <span className="text-muted-foreground text-xs font-normal"> /wk</span>}
                        </span>
                      )}
                      <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteCommitmentMutation.mutate(c.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {showAddCommitment && !editingId && commitmentFormUI}
        {!showAddCommitment && !editingId && (
          <button className="text-xs font-medium" style={{ color: "#FF6B35" }} onClick={() => { setShowAddCommitment(true); setCommitmentForm({ name: "", amount: 0, due_day: 1, category: "other", frequency: "monthly" }); }}>
            + Add Commitment
          </button>
        )}
      </div>

      {/* SECTION C: CASH HEALTH CHECK */}
      {showHealthCheck && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💊 Cash Health Check</h3>

          {/* Row 1 — two figures */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Projected balance on 1st</p>
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

          {/* Row 2 — Status Banner */}
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

          {/* Row 3 — breakdown table (collapsible) */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Show breakdown <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-1">
                {activeCommitmentsWithAmount.map((c: any) => {
                  const freq = c.frequency || "monthly";
                  const amt = Number(c.amount);
                  const totalForMonth = freq === "weekly" ? amt * saturdaysRemaining : amt;
                  const covered = projectedEndBalance >= totalForMonth;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-xs border-b pb-1">
                      <span>
                        {freq === "weekly"
                          ? `${c.name} — ${saturdaysRemaining} Saturday${saturdaysRemaining !== 1 ? "s" : ""} remaining`
                          : c.name}
                      </span>
                      <span className="text-muted-foreground">
                        {freq === "weekly" ? "Every Saturday" : `Day ${c.due_day}`}
                      </span>
                      <span className="font-medium">
                        {freq === "weekly"
                          ? `£${Math.round(amt).toLocaleString()} × ${saturdaysRemaining} = £${Math.round(totalForMonth).toLocaleString()}`
                          : `£${Math.round(totalForMonth).toLocaleString()}`}
                      </span>
                      <span>{covered ? "✅ Covered" : "🔴 At risk"}</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Row 4 — small muted text */}
          <p className="text-[10px] text-muted-foreground">
            Based on bank balance of £{Math.round(currentBalance).toLocaleString()} updated {formatDistanceToNow(new Date(latestBalance.noted_at), { addSuffix: true })} + £{Math.round(upcomingRevenue).toLocaleString()} projected income remaining this month
          </p>
        </div>
      )}
    </>
  );
};

export default CashHealthSection;
