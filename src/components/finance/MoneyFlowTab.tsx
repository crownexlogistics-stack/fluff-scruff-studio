import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format,
} from "date-fns";
import { Banknote, CreditCard, TrendingUp, TrendingDown, Wallet } from "lucide-react";

type Period = "weekly" | "monthly" | "yearly";

export default function MoneyFlowTab() {
  const [period, setPeriod] = useState<Period>("monthly");

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (period === "weekly") return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    if (period === "monthly") return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: startOfYear(now), end: endOfYear(now) };
  }, [period]);

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { data: completedBookings = [] } = useQuery({
    queryKey: ["money-flow-bookings", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, staff_id, total_price, deposit_paid, final_charge, cash_collected, card_collected, payment_method, status, booking_date, staff:staff_id(name)")
        .eq("status", "Completed")
        .gte("booking_date", startStr)
        .lte("booking_date", endStr);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: depositBookings = [] } = useQuery({
    queryKey: ["money-flow-deposits", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, deposit_paid, booking_date, status")
        .gt("deposit_paid", 0)
        .gte("booking_date", startStr)
        .lte("booking_date", endStr)
        .neq("status", "Cancelled");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: payLinks = [] } = useQuery({
    queryKey: ["money-flow-pay-links", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pay_links")
        .select("amount, paid_at, status")
        .eq("status", "paid")
        .gte("paid_at", `${startStr}T00:00:00`)
        .lte("paid_at", `${endStr}T23:59:59`);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["money-flow-payouts", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groomer_payout_history")
        .select("groomer_name, payout_amount, payment_method, paid_at")
        .gte("paid_at", startStr)
        .lte("paid_at", endStr);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Aggregates
  const totals = useMemo(() => {
    let cashIn = 0;
    let cardIn = 0;
    for (const b of completedBookings) {
      const cash = b.cash_collected != null ? Number(b.cash_collected) : 0;
      const card = b.card_collected != null ? Number(b.card_collected) : (b.final_charge != null ? Number(b.final_charge) : 0);
      cashIn += cash;
      cardIn += card;
    }
    const depositsTotal = depositBookings.reduce((s, b) => s + Number(b.deposit_paid || 0), 0)
      + payLinks.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cashPayouts = payouts.filter(p => p.payment_method === "cash").reduce((s, p) => s + Number(p.payout_amount || 0), 0);
    const transferPayouts = payouts.filter(p => p.payment_method !== "cash").reduce((s, p) => s + Number(p.payout_amount || 0), 0);
    return {
      cashIn, cardIn, depositsTotal,
      totalIn: cashIn + cardIn + depositsTotal,
      cashPayouts, transferPayouts,
      totalOut: cashPayouts + transferPayouts,
      cashShouldHold: cashIn - cashPayouts,
    };
  }, [completedBookings, depositBookings, payLinks, payouts]);

  // Per-groomer cash breakdown
  const perGroomer = useMemo(() => {
    const map = new Map<string, { name: string; cashCollected: number; cashPaidOut: number }>();
    for (const b of completedBookings) {
      const name = (b.staff as any)?.name || "Unassigned";
      const cash = b.cash_collected != null ? Number(b.cash_collected) : 0;
      if (cash <= 0 && !map.has(name)) continue;
      const cur = map.get(name) || { name, cashCollected: 0, cashPaidOut: 0 };
      cur.cashCollected += cash;
      map.set(name, cur);
    }
    for (const p of payouts) {
      if (p.payment_method !== "cash") continue;
      const name = p.groomer_name || "Unknown";
      const cur = map.get(name) || { name, cashCollected: 0, cashPaidOut: 0 };
      cur.cashPaidOut += Number(p.payout_amount || 0);
      map.set(name, cur);
    }
    return Array.from(map.values())
      .filter(g => g.cashCollected > 0 || g.cashPaidOut > 0)
      .sort((a, b) => b.cashCollected - a.cashCollected);
  }, [completedBookings, payouts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Showing</p>
          <p className="text-sm font-medium">{format(start, "dd MMM yyyy")} — {format(end, "dd MMM yyyy")}</p>
        </div>
        <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* MONEY IN */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm">Money In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Deposits (online card)" value={totals.depositsTotal} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <Row label="Card balances" value={totals.cardIn} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <Row label="Cash balances" value={totals.cashIn} icon={<Banknote className="h-3.5 w-3.5" />} />
            <div className="border-t pt-1.5 flex items-center justify-between font-semibold">
              <span>Total in</span>
              <span className="text-emerald-700">£{totals.totalIn.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* MONEY OUT */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-600" />
            <CardTitle className="text-sm">Money Out (Payouts)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Bank transfer payouts" value={totals.transferPayouts} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <Row label="Cash payouts" value={totals.cashPayouts} icon={<Banknote className="h-3.5 w-3.5" />} />
            <div className="border-t pt-1.5 flex items-center justify-between font-semibold">
              <span>Total out</span>
              <span className="text-rose-700">£{totals.totalOut.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* CASH ON HAND */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm">Cash on Hand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Cash collected" value={totals.cashIn} />
            <Row label="− Paid out in cash" value={-totals.cashPayouts} />
            <div className="border-t pt-1.5 flex items-center justify-between font-semibold">
              <span>Should be holding</span>
              <span className={totals.cashShouldHold >= 0 ? "text-emerald-700" : "text-rose-700"}>
                £{totals.cashShouldHold.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground italic pt-1">
              Net cash the salon should currently be holding for this period.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period summary line */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">Net for period:</span>
          <Badge className={totals.totalIn - totals.totalOut >= 0 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
            £{(totals.totalIn - totals.totalOut).toFixed(2)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            (Money in £{totals.totalIn.toFixed(2)} − Payouts £{totals.totalOut.toFixed(2)})
          </span>
        </CardContent>
      </Card>

      {/* Per-groomer cash */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Cash by Groomer</CardTitle></CardHeader>
        <CardContent className="p-0">
          {perGroomer.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No cash recorded in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Groomer</th>
                  <th className="px-4 py-2 font-medium text-right">Cash collected</th>
                  <th className="px-4 py-2 font-medium text-right">Cash paid out</th>
                  <th className="px-4 py-2 font-medium text-right">Net cash held</th>
                </tr>
              </thead>
              <tbody>
                {perGroomer.map(g => {
                  const net = g.cashCollected - g.cashPaidOut;
                  return (
                    <tr key={g.name} className="border-t">
                      <td className="px-4 py-2">{g.name}</td>
                      <td className="px-4 py-2 text-right">£{g.cashCollected.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">£{g.cashPaidOut.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${net > 0 ? "text-amber-700" : net < 0 ? "text-rose-700" : ""}`}>
                        £{net.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        💡 All figures backfill automatically from existing bookings, deposits, pay links and payout history.
        Legacy completed bookings (before split tracking) are treated as 100% card.
      </p>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-medium">£{value.toFixed(2)}</span>
    </div>
  );
}