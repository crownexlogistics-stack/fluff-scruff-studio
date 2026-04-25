import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { RefreshCw, CreditCard, Monitor, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashFlowResponse {
  month_start: string;
  month_end: string;
  stripe: { total: number; count: number; error: string | null };
  salon_card: number;
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
  const salonCard = data?.salon_card ?? 0;
  const totalCash = data?.total_cash ?? 0;
  const revenue = data?.revenue ?? 0;
  const difference = data?.difference ?? 0;
  const billsDue = data?.bills_due_this_month ?? 0;
  const gap = billsDue - totalCash;

  const showWarning = totalCash > 0 && billsDue > 0 && gap > 100;

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
                    Paid online (website &amp; app)
                    {data?.stripe.error && (
                      <span className="text-[10px] text-destructive ml-1">({data.stripe.error})</span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(stripeTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-purple-500" />
                    Paid in salon (card machine)
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(salonCard)}</span>
                </div>
                <div className="border-t pt-2 mt-1 flex items-center justify-between text-base font-bold">
                  <span>💰 Total received this month</span>
                  <span className="tabular-nums text-green-600">{fmt(totalCash)}</span>
                </div>
              </div>

              {/* Explanation */}
              <p className="text-xs text-muted-foreground pt-1">
                This is the actual money your salon received in {format(today, "MMMM")} — from customers paying online and paying by card in the salon.
              </p>

              {/* Comparison */}
              <div className="space-y-1 pt-2 border-t text-sm">
                {revenue > 0 && Math.abs(difference) <= 50 && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    ✅ Money collected matches appointments completed this month.
                  </p>
                )}
                {revenue > 0 && difference > 50 && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    ✅ You collected more money than you earned this month. The extra {fmt(difference)} came from customers paying deposits for future appointments — it will be used next month.
                  </p>
                )}
                {revenue > 0 && difference < -50 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ⚠️ You earned {fmt(revenue)} from appointments this month but only collected {fmt(totalCash)} so far. {fmt(Math.abs(difference))} is still owed by customers who have been seen but not fully paid.
                  </p>
                )}
              </div>

              {/* Rent timing note */}
              <p className="text-xs text-muted-foreground">
                💡 Note: Your biggest bills (rent etc.) are paid on the 1st of each month from the previous month&apos;s income. This month&apos;s cash will cover next month&apos;s rent.
              </p>

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

      {showWarning && (
        <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                ⚠️ This month&apos;s income ({fmt(totalCash)}) is {fmt(gap)} short of covering this month&apos;s bills ({fmt(billsDue)}).
              </p>
              <p className="text-destructive/90 mt-1">
                Collecting any outstanding customer balances this week will help cover it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlowCard;