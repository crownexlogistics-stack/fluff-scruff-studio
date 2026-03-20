import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Search, Loader2,
} from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_email: string | null;
  payment_method: string;
  description: string | null;
  metadata: Record<string, string>;
  matched: boolean;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: number;
  created: number;
}

interface StripeTransactionsTabProps {
  onInvestigate?: (message: string) => void;
}

type DateRange = "today" | "this_week" | "this_month" | "all";
type StatusFilter = "all" | "succeeded" | "refunded" | "failed";

export function StripeTransactionsTab({ onInvestigate }: StripeTransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const params = new URLSearchParams({ limit: "100" });

      const now = new Date();
      if (dateRange === "today") {
        params.set("created_gte", String(Math.floor(startOfDay(now).getTime() / 1000)));
      } else if (dateRange === "this_week") {
        params.set("created_gte", String(Math.floor(startOfWeek(now, { weekStartsOn: 1 }).getTime() / 1000)));
      } else if (dateRange === "this_month") {
        params.set("created_gte", String(Math.floor(startOfMonth(now).getTime() / 1000)));
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-transactions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!resp.ok) throw new Error("Failed to fetch");
      const data = await resp.json();
      setTransactions(data.transactions || []);
      setPayouts(data.payouts || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Failed to fetch Stripe transactions:", e);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = transactions.filter((t) => {
    if (statusFilter === "succeeded" && t.status !== "succeeded") return false;
    if (statusFilter === "refunded" && !t.status.includes("refund")) return false;
    if (statusFilter === "failed" && t.status !== "requires_payment_method" && t.status !== "canceled") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !t.customer_email?.toLowerCase().includes(q) &&
        !t.id.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const unmatchedSucceeded = transactions.filter(
    (t) => t.status === "succeeded" && !t.matched
  );

  const totalAmount = filtered
    .filter((t) => t.status === "succeeded")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthPayouts = payouts
    .filter((p) => p.status === "paid" || p.status === "in_transit")
    .reduce((sum, p) => sum + p.amount, 0);

  const statusBadge = (status: string) => {
    if (status === "succeeded") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">Succeeded</Badge>;
    if (status.includes("refund")) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">Refunded</Badge>;
    if (status === "canceled") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0">Cancelled</Badge>;
    if (status === "requires_payment_method") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0">Failed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Unmatched alert */}
      {unmatchedSucceeded.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm">
                  🚨 {unmatchedSucceeded.length} payment{unmatchedSucceeded.length !== 1 ? "s" : ""} received but not matched to a booking — review required
                </p>
                <div className="mt-2 space-y-1.5">
                  {unmatchedSucceeded.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">£{t.amount.toFixed(2)}</span>
                      <span className="text-muted-foreground">{t.customer_email || "No email"}</span>
                      <span className="text-muted-foreground">{format(new Date(t.created * 1000), "dd MMM HH:mm")}</span>
                      {onInvestigate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => onInvestigate(
                            `Investigate unmatched payment of £${t.amount.toFixed(2)} from ${t.customer_email || "unknown"} on ${format(new Date(t.created * 1000), "dd MMM yyyy")} — payment intent ${t.id}`
                          )}
                        >
                          Investigate
                        </Button>
                      )}
                    </div>
                  ))}
                  {unmatchedSucceeded.length > 5 && (
                    <p className="text-xs text-muted-foreground">...and {unmatchedSucceeded.length - 5} more</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search email or payment ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          £{totalAmount.toFixed(2)} across {filtered.length} transactions
          · Updated {format(lastRefresh, "HH:mm")}
        </span>
      </div>

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0">
          {loading && transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date & Time</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Payment Method</TableHead>
                  <TableHead className="text-xs">Customer Email</TableHead>
                  <TableHead className="text-xs">Payment Intent</TableHead>
                  <TableHead className="text-xs text-center">Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(t.created * 1000), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm font-medium tabular-nums">
                        £{t.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell className="text-xs">{t.payment_method}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {t.customer_email || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <code className="text-[10px] text-muted-foreground font-mono">
                          {t.id.slice(0, 20)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-center">
                        {t.status === "succeeded" ? (
                          t.matched ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payouts section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Payouts to Bank</CardTitle>
            <span className="text-xs text-muted-foreground">
              £{monthPayouts.toFixed(2)} total in recent payouts
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">
                    No payouts found
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">
                      {format(new Date(p.arrival_date * 1000), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">
                      £{p.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-xs">
                        {p.status === "paid" ? "Paid" : p.status === "in_transit" ? "In Transit" : p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
