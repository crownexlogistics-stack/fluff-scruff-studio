import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { RefreshCw, CreditCard, Monitor, Banknote, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashFlowResponse {
  month_start: string;
  month_end: string;
  stripe: { total: number; count: number; error: string | null };
  worldpay: { card: number; cash: number; has_data: boolean };
  salon_cash_collected: number;
  total_cash: number;
  revenue: number;
  difference: number;
  bills_due_this_month: number;
  last_updated: string;
}

const fmt = (n: number) =>
  `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CashFlowCard = () => {
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const monthName = format(today, "MMMM yyyy");
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading, dataUpdatedAt } = useQuery<CashFlowResponse>({
    queryKey: ["cash-flow", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cash-flow", {
        body: { month_start: monthStart, month_end: monthEnd },
      });
      if (error) throw error;
      return data as CashFlowResponse;
    },
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const stripeTotal = data?.stripe.total ?? 0;
  const worldpayCard = data?.worldpay.card ?? 0;
  const cashCollected = (data?.worldpay.cash ?? 0) + (data?.salon_cash_collected ?? 0);
  const totalCash = data?.total_cash ?? 0;
  const revenue = data?.revenue ?? 0;
  const difference = data?.difference ?? 0;
  const billsDue = data?.bills_due_this_month ?? 0;

  const cashLessThanBills = totalCash > 0 && billsDue > 0 && totalCash < billsDue;

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border-2 border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                💰 Cash Received — {monthName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Actual money collected this month across all payment methods
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (refreshing || isLoading) && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          {isLoading && !data ? (
            <p className="text-sm text-muted-foreground">Loading cash data…</p>
          ) : (
            <>
              {/* Breakdown */}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                    Online (Stripe)
                    {data?.stripe.error && (
                      <span className="text-[10px] text-destructive ml-1">({data.stripe.error})</span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(stripeTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-purple-500" />
                    Card machine (Worldpay)
                    {!data?.worldpay.has_data && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        (upload CSV in Finance › Reconciliation)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(worldpayCard)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5 text-green-600" />
                    Cash collected
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(cashCollected)}</span>
                </div>
                <div className="border-t pt-2 mt-1 flex items-center justify-between text-base font-bold">
                  <span>💰 Total cash this month</span>
                  <span className="tabular-nums text-green-600">{fmt(totalCash)}</span>
                </div>
              </div>

              {/* Comparison */}
              <div className="space-y-1 pt-2 border-t text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>vs Revenue this month</span>
                  <span className="tabular-nums">{fmt(revenue)}</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Difference</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      difference < 0 ? "text-amber-600" : "text-green-600",
                    )}
                  >
                    {difference >= 0 ? "+" : ""}
                    {fmt(difference)}
                  </span>
                </div>
                {revenue > 0 && difference < 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    ⚠️ {fmt(Math.abs(difference))} less collected than revenue — some appointments
                    were pre-paid in previous months or balances still outstanding.
                  </p>
                )}
                {revenue > 0 && difference > 0 && (
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-start gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    More cash collected than revenue this month — includes advance payments for
                    future bookings.
                  </p>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground pt-1">
                Last updated:{" "}
                {dataUpdatedAt
                  ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })
                  : "—"}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {cashLessThanBills && (
        <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                🚨 Cash collected ({fmt(totalCash)}) is less than bills due this month (
                {fmt(billsDue)}).
              </p>
              <p className="text-destructive/90 mt-1">
                Gap: {fmt(billsDue - totalCash)}. Check bank balance and upcoming commitments.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlowCard;