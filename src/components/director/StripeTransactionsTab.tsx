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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Search, Loader2, Copy, Link2, ExternalLink,
} from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { toast } from "sonner";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_email: string | null;
  customer_name: string | null;
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

interface TransactionDetail {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
  metadata: Record<string, string>;
  customer_email: string | null;
  customer_name: string | null;
  charge_id: string | null;
  payment_method: {
    type: string;
    card: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
      funding: string;
      issuer: string | null;
      three_d_secure: string | null;
      cvc_check: string | null;
    } | null;
  } | null;
  refunded: boolean;
  amount_refunded: number;
  stripe_fee: number;
  net_amount: number;
  matched_booking: {
    id: string;
    customer_name: string;
    dog_name: string;
    booking_date: string;
    booking_time: string;
    status: string;
    total_price: number;
    deposit_paid: number;
    groomer_name: string | null;
  } | null;
}

interface MatchBooking {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  staff_id: string | null;
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

  // Detail panel
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Match dialog
  const [matchTx, setMatchTx] = useState<Transaction | null>(null);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchResults, setMatchResults] = useState<MatchBooking[]>([]);
  const [matchSearching, setMatchSearching] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

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
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch detail
  const fetchDetail = useCallback(async (piId: string) => {
    setDetailLoading(true);
    setTxDetail(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-transactions?action=detail&payment_intent_id=${piId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setTxDetail(data.detail);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load transaction details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleRowClick = (tx: Transaction) => {
    setSelectedTxId(tx.id);
    fetchDetail(tx.id);
  };

  // Match booking search
  const searchBookings = useCallback(async (query: string) => {
    if (!query.trim()) { setMatchResults([]); return; }
    setMatchSearching(true);
    try {
      const q = query.trim().toLowerCase();
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, dog_name, booking_date, booking_time, status, total_price, deposit_paid, staff_id")
        .or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%`)
        .order("booking_date", { ascending: false })
        .limit(20);
      setMatchResults((data as MatchBooking[]) || []);
    } catch {
      setMatchResults([]);
    } finally {
      setMatchSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (matchSearch) searchBookings(matchSearch); }, 300);
    return () => clearTimeout(timer);
  }, [matchSearch, searchBookings]);

  const handleMatchConfirm = async () => {
    if (!matchTx || !selectedBookingId) return;
    setMatching(true);
    try {
      const booking = matchResults.find(b => b.id === selectedBookingId);
      if (!booking) throw new Error("Booking not found");

      const newDeposit = matchTx.amount;
      const newStatus = newDeposit >= booking.total_price ? "Confirmed" : "Confirmed";

      const { error } = await supabase
        .from("bookings")
        .update({
          stripe_payment_id: matchTx.id,
          deposit_paid: newDeposit,
          status: newStatus,
        } as any)
        .eq("id", selectedBookingId);

      if (error) throw error;

      // Audit log
      await (supabase.from("booking_audit_log" as any) as any).insert({
        booking_id: selectedBookingId,
        event_type: "payment_matched",
        note: `Payment ${matchTx.id} of £${matchTx.amount.toFixed(2)} manually matched by director on ${format(new Date(), "dd MMM yyyy")}. Previously unmatched in Stripe.`,
        performed_by: "director",
      });

      await (supabase.from("audit_logs" as any) as any).insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "PAYMENT_MANUALLY_MATCHED",
        details: `Payment ${matchTx.id} of £${matchTx.amount.toFixed(2)} matched to booking ${selectedBookingId} (${booking.customer_name}). Deposit updated to £${newDeposit.toFixed(2)}.`,
      });

      toast.success("Payment matched — booking updated ✅");
      setMatchTx(null);
      setSelectedBookingId(null);
      setMatchSearch("");
      setMatchResults([]);
      fetchData(); // Refresh to show updated match status
    } catch (e: any) {
      toast.error(e.message || "Failed to match payment");
    } finally {
      setMatching(false);
    }
  };

  const filtered = transactions.filter((t) => {
    if (statusFilter === "succeeded" && t.status !== "succeeded") return false;
    if (statusFilter === "refunded" && !t.status.includes("refund")) return false;
    if (statusFilter === "failed" && t.status !== "requires_payment_method" && t.status !== "canceled") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.customer_email?.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q) && !t.customer_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unmatchedSucceeded = transactions.filter((t) => t.status === "succeeded" && !t.matched);
  const totalAmount = filtered.filter((t) => t.status === "succeeded").reduce((sum, t) => sum + t.amount, 0);
  const monthPayouts = payouts.filter((p) => p.status === "paid" || p.status === "in_transit").reduce((sum, p) => sum + p.amount, 0);

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
                    <div key={t.id} className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-medium">£{t.amount.toFixed(2)}</span>
                      <span className="text-muted-foreground">{t.customer_email || "No email"}</span>
                      <span className="text-muted-foreground">{format(new Date(t.created * 1000), "dd MMM HH:mm")}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => { setMatchTx(t); setMatchSearch(t.customer_email || ""); }}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Match to Booking
                      </Button>
                      {onInvestigate && (
                        <Button
                          variant="ghost"
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
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
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
            placeholder="Search email, name or payment ID..."
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
          £{totalAmount.toFixed(2)} across {filtered.length} transactions · Updated {format(lastRefresh, "HH:mm")}
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
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Payment Intent</TableHead>
                  <TableHead className="text-xs text-center">Matched</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(t)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(t.created * 1000), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm font-medium tabular-nums">
                        £{t.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell className="text-xs">{t.payment_method}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {t.customer_name || t.customer_email || <span className="text-muted-foreground">—</span>}
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
                      <TableCell>
                        {t.status === "succeeded" && !t.matched && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={(e) => { e.stopPropagation(); setMatchTx(t); setMatchSearch(t.customer_email || ""); }}
                          >
                            Match
                          </Button>
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

      {/* Payouts */}
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
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">No payouts found</TableCell>
                </TableRow>
              ) : (
                payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{format(new Date(p.arrival_date * 1000), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">£{p.amount.toFixed(2)}</TableCell>
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

      {/* Transaction Detail Sheet */}
      <Sheet open={!!selectedTxId} onOpenChange={(open) => { if (!open) { setSelectedTxId(null); setTxDetail(null); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">Transaction Details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : txDetail ? (
            <div className="space-y-5 mt-4">
              {/* Amount & Status */}
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">£{txDetail.amount.toFixed(2)}</span>
                {statusBadge(txDetail.refunded ? "refunded" : txDetail.status)}
              </div>

              {/* Customer */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Customer</h4>
                <p className="text-sm">{txDetail.customer_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{txDetail.customer_email || "No email"}</p>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Date & Time</h4>
                <p className="text-sm">{format(new Date(txDetail.created * 1000), "dd MMMM yyyy 'at' HH:mm")}</p>
              </div>

              {/* Payment Method */}
              {txDetail.payment_method?.card && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Payment Method</h4>
                  <div className="text-sm space-y-0.5">
                    <p className="capitalize">{txDetail.payment_method.card.brand} •••• {txDetail.payment_method.card.last4}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {txDetail.payment_method.card.exp_month}/{txDetail.payment_method.card.exp_year}
                      {txDetail.payment_method.card.funding && ` · ${txDetail.payment_method.card.funding}`}
                    </p>
                    {txDetail.payment_method.card.three_d_secure && (
                      <p className="text-xs text-muted-foreground">3D Secure: {txDetail.payment_method.card.three_d_secure}</p>
                    )}
                    {txDetail.payment_method.card.cvc_check && (
                      <p className="text-xs text-muted-foreground">CVC: {txDetail.payment_method.card.cvc_check}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Fees */}
              {txDetail.stripe_fee != null && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Payment Breakdown</h4>
                  <div className="text-sm space-y-0.5">
                    <div className="flex justify-between"><span>Amount</span><span>£{txDetail.amount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Stripe fee</span><span>-£{txDetail.stripe_fee.toFixed(2)}</span></div>
                    <div className="flex justify-between font-medium border-t pt-1"><span>Net</span><span>£{txDetail.net_amount.toFixed(2)}</span></div>
                  </div>
                </div>
              )}

              {/* IDs */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Reference IDs</h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{txDetail.id}</code>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(txDetail.id); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  {txDetail.charge_id && (
                    <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded block">{txDetail.charge_id}</code>
                  )}
                </div>
              </div>

              {/* Matched booking */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Matched Booking</h4>
                {txDetail.matched_booking ? (
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-3 text-sm space-y-0.5">
                      <p className="font-medium">{txDetail.matched_booking.customer_name} — {txDetail.matched_booking.dog_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(txDetail.matched_booking.booking_date), "dd MMM yyyy")} at {txDetail.matched_booking.booking_time}
                      </p>
                      <p className="text-xs">
                        £{txDetail.matched_booking.total_price} · Deposit: £{txDetail.matched_booking.deposit_paid}
                        {txDetail.matched_booking.groomer_name && ` · ${txDetail.matched_booking.groomer_name}`}
                      </p>
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] mt-1">{txDetail.matched_booking.status}</Badge>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>No matching booking found</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() => {
                          setSelectedTxId(null);
                          setTxDetail(null);
                          const tx = transactions.find(t => t.id === txDetail.id);
                          if (tx) { setMatchTx(tx); setMatchSearch(tx.customer_email || ""); }
                        }}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Match to Booking
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(txDetail.id); toast.success("Copied"); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy Payment ID
                </Button>
                {!txDetail.matched_booking && txDetail.status === "succeeded" && !txDetail.refunded && (
                  <Button variant="outline" size="sm" onClick={() => {
                    setSelectedTxId(null);
                    setTxDetail(null);
                    const tx = transactions.find(t => t.id === txDetail.id);
                    if (tx) { setMatchTx(tx); setMatchSearch(tx.customer_email || ""); }
                  }}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    Match to Booking
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Failed to load details</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Match to Booking Dialog */}
      <Dialog open={!!matchTx} onOpenChange={(open) => { if (!open) { setMatchTx(null); setSelectedBookingId(null); setMatchSearch(""); setMatchResults([]); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Match Payment to Booking</DialogTitle>
          </DialogHeader>

          {matchTx && (
            <div className="space-y-4">
              {/* Payment info */}
              <Card className="bg-muted/50">
                <CardContent className="p-3 text-sm space-y-0.5">
                  <p className="font-medium">£{matchTx.amount.toFixed(2)} — {matchTx.customer_email || "No email"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(matchTx.created * 1000), "dd MMM yyyy HH:mm")} · {matchTx.id.slice(0, 25)}...
                  </p>
                </CardContent>
              </Card>

              {/* Search */}
              <div>
                <label className="text-xs font-medium mb-1 block">Search customer by name or email</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>

              {/* Results */}
              {matchSearching && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
              {matchResults.length > 0 && (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {matchResults.map((b) => (
                    <Card
                      key={b.id}
                      className={`cursor-pointer transition-colors ${selectedBookingId === b.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => setSelectedBookingId(b.id)}
                    >
                      <CardContent className="p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{b.customer_name} — {b.dog_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(b.booking_date), "dd MMM yyyy")} at {b.booking_time}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">£{b.total_price}</p>
                            <p className="text-xs text-muted-foreground">Deposit: £{b.deposit_paid}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="mt-1 text-[10px]">{b.status}</Badge>
                        {selectedBookingId === b.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary absolute top-3 right-3" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {matchSearch && !matchSearching && matchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No bookings found</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchTx(null)}>Cancel</Button>
            <Button onClick={handleMatchConfirm} disabled={!selectedBookingId || matching}>
              {matching ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirm Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
