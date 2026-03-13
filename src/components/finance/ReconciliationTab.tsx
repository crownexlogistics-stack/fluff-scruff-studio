import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ChevronDown, Download, CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

interface CsvRow {
  date: string;
  time: string;
  orderId: string;
  orderNo: string;
  seller: string;
  amount: number;
  type: string; // "worldpay-tripos" | "cash"
}

interface MatchedRow extends CsvRow {
  status: "matched" | "mismatch" | "unmatched";
  bookingMatch: string;
  expectedAmount?: number;
}

interface VoidPair {
  date: string;
  time: string;
  seller: string;
  amount: number;
  voidTime: string;
}

function parseCsvRows(text: string): CsvRow[] {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return (result.data as Record<string, string>[]).map(row => ({
    date: (row["Date"] || "").trim(),
    time: (row["Time"] || "").trim(),
    orderId: (row["Order ID"] || "").trim(),
    orderNo: (row["Order No"] || "").trim(),
    seller: (row["Seller"] || "").trim(),
    amount: parseFloat((row["Amount"] || "0").trim()) || 0,
    type: (row["Type"] || "").trim(),
  }));
}

export default function ReconciliationTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [voidPairs, setVoidPairs] = useState<VoidPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [processed, setProcessed] = useState(false);

  // Filters
  const [sellerFilter, setSellerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();

  const sellers = useMemo(() => {
    const s = new Set(matchedRows.map(r => r.seller).filter(Boolean));
    return Array.from(s).sort();
  }, [matchedRows]);

  const positiveRows = useMemo(() => allRows.filter(r => r.amount > 0), [allRows]);
  const negativeRows = useMemo(() => allRows.filter(r => r.amount < 0), [allRows]);

  const totalCard = useMemo(() =>
    positiveRows.filter(r => r.type === "worldpay-tripos").reduce((s, r) => s + r.amount, 0),
  [positiveRows]);
  const totalCash = useMemo(() =>
    positiveRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0),
  [positiveRows]);

  const filteredRows = useMemo(() => {
    let rows = matchedRows;
    if (sellerFilter !== "all") rows = rows.filter(r => r.seller === sellerFilter);
    if (statusFilter !== "all") rows = rows.filter(r => r.status === statusFilter);
    if (dateFilter) {
      const ds = format(dateFilter, "yyyy-MM-dd");
      rows = rows.filter(r => r.date === ds);
    }
    return rows;
  }, [matchedRows, sellerFilter, statusFilter, dateFilter]);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const csvFiles = Array.from(newFiles).filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) return;
    setFiles(prev => [...prev, ...csvFiles]);
    setProcessed(false);
    setMatchedRows([]);
    setVoidPairs([]);

    const promises = csvFiles.map(f => f.text().then(parseCsvRows));
    Promise.all(promises).then(results => {
      const combined = results.flat();
      setAllRows(prev => [...prev, ...combined]);
    });
  }, []);

  const clearAll = () => {
    setFiles([]);
    setAllRows([]);
    setMatchedRows([]);
    setVoidPairs([]);
    setProcessed(false);
  };

  const reconcile = async () => {
    if (allRows.length === 0) return;
    setLoading(true);

    try {
      // Detect voids: same Order ID with positive + negative
      const orderGroups = new Map<string, CsvRow[]>();
      allRows.forEach(r => {
        if (!r.orderId) return;
        if (!orderGroups.has(r.orderId)) orderGroups.set(r.orderId, []);
        orderGroups.get(r.orderId)!.push(r);
      });

      const detectedVoids: VoidPair[] = [];
      const voidedOrderIds = new Set<string>();
      orderGroups.forEach((rows, orderId) => {
        if (rows.length >= 2) {
          const pos = rows.find(r => r.amount > 0);
          const neg = rows.find(r => r.amount < 0);
          if (pos && neg) {
            detectedVoids.push({
              date: pos.date,
              time: pos.time,
              seller: pos.seller,
              amount: pos.amount,
              voidTime: neg.time,
            });
            voidedOrderIds.add(orderId);
          }
        }
      });
      setVoidPairs(detectedVoids);

      // Only reconcile positive, non-voided rows
      const toReconcile = allRows.filter(r => r.amount > 0 && !voidedOrderIds.has(r.orderId));

      // Get unique dates
      const dates = [...new Set(toReconcile.map(r => r.date))];

      // Fetch bookings for those dates
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, booking_date, total_price, customer_name, staff_id, status, service_id, services:service_id(name), staff:staff_id(name)")
        .in("booking_date", dates)
        .in("status", ["Pending", "Confirmed", "Completed", "completed", "confirmed", "pending"]);

      const matched: MatchedRow[] = toReconcile.map(row => {
        // Find bookings matching date + seller
        const dateBookings = (bookings || []).filter((b: any) => b.booking_date === row.date);
        const sellerBookings = dateBookings.filter((b: any) => {
          const staffName = (b.staff?.name || "").toLowerCase();
          return staffName.includes(row.seller.toLowerCase());
        });

        // Try exact amount match
        const exactMatch = sellerBookings.find((b: any) => Math.abs(Number(b.total_price) - row.amount) < 0.01);
        if (exactMatch) {
          const serviceName = (exactMatch as any).services?.name || "Service";
          return {
            ...row,
            status: "matched" as const,
            bookingMatch: `${exactMatch.customer_name} — ${serviceName}`,
          };
        }

        // Seller match but wrong amount
        if (sellerBookings.length > 0) {
          // Find closest
          const closest = sellerBookings.reduce((best: any, b: any) => {
            const diff = Math.abs(Number(b.total_price) - row.amount);
            return diff < Math.abs(Number(best.total_price) - row.amount) ? b : best;
          }, sellerBookings[0]);
          return {
            ...row,
            status: "mismatch" as const,
            bookingMatch: `Expected £${Number(closest.total_price).toFixed(2)}, got £${row.amount.toFixed(2)}`,
            expectedAmount: Number(closest.total_price),
          };
        }

        return {
          ...row,
          status: "unmatched" as const,
          bookingMatch: "—",
        };
      });

      setMatchedRows(matched);
      setProcessed(true);

      // Save run to DB
      const matchedCount = matched.filter(r => r.status === "matched").length;
      const unmatchedCount = matched.filter(r => r.status !== "matched").length;
      await supabase.from("reconciliation_runs").insert({
        filename: files.map(f => f.name).join(", "),
        total_transactions: toReconcile.length,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        void_count: detectedVoids.length,
      } as any);

      toast.success(`Reconciliation complete: ${matchedCount} matched, ${unmatchedCount} unmatched, ${detectedVoids.length} voids`);
    } catch (err: any) {
      console.error(err);
      toast.error("Reconciliation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Date", "Time", "Seller", "Amount", "Type", "Order No", "Status", "Booking Match"];
    const csvRows = filteredRows.map(r => [
      r.date, r.time, r.seller, r.amount.toFixed(2), r.type, r.orderNo, r.status, r.bookingMatch,
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "matched":
        return <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Matched</Badge>;
      case "mismatch":
        return <Badge className="bg-amber-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>;
      case "unmatched":
        return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" />No Booking</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <label
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-[20px] border-2 border-dashed cursor-pointer transition-colors hover:border-primary hover:bg-accent/20"
        style={{ borderColor: files.length > 0 ? "hsl(var(--primary))" : undefined, backgroundColor: files.length > 0 ? "hsl(var(--accent) / 0.1)" : undefined }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium">
          {files.length > 0
            ? `${files.length} file(s) loaded — ${allRows.length} rows parsed`
            : "📂 Drop Worldpay CSV files here or click to browse"}
        </span>
        <input type="file" accept=".csv" multiple className="hidden" onChange={e => { if (e.target.files) handleFiles(e.target.files); }} />
      </label>

      {files.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {files.map((f, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1">
              <FileText className="h-3 w-3" /> {f.name}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
          {!processed && (
            <Button size="sm" onClick={reconcile} disabled={loading} className="ml-auto">
              {loading ? "Reconciling…" : "Reconcile"}
            </Button>
          )}
        </div>
      )}

      {/* Summary cards */}
      {processed && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Transactions</p><p className="text-2xl font-bold">{positiveRows.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Card Revenue</p><p className="text-2xl font-bold">£{totalCard.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Cash Revenue</p><p className="text-2xl font-bold">£{totalCash.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Voids / Refunds</p><p className="text-2xl font-bold text-amber-500">{negativeRows.length}</p></CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Seller" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sellers</SelectItem>
                {sellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="mismatch">Mismatched</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {dateFilter ? format(dateFilter, "dd MMM yyyy") : "Filter Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter(undefined)}>
                <X className="h-3 w-3 mr-1" /> Clear date
              </Button>
            )}

            <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export Report
            </Button>
          </div>

          {/* Main table */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booking Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No transactions to show</TableCell></TableRow>
                  ) : (
                    filteredRows.map((r, i) => (
                      <TableRow key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                        <TableCell className="text-sm">{r.date}</TableCell>
                        <TableCell className="text-sm">{r.time}</TableCell>
                        <TableCell className="text-sm">{r.seller}</TableCell>
                        <TableCell className="text-sm text-right font-medium">£{r.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.type === "worldpay-tripos" ? "Card" : r.type === "cash" ? "Cash" : r.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.orderNo}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{r.bookingMatch}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Void panel */}
          {voidPairs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-amber-600 border-amber-300 hover:bg-amber-50">
                  <span>⚠️ Voided Transactions ({voidPairs.length})</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2 border-amber-200">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Seller</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Voided At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {voidPairs.map((v, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{v.date}</TableCell>
                            <TableCell className="text-sm">{v.time}</TableCell>
                            <TableCell className="text-sm">{v.seller}</TableCell>
                            <TableCell className="text-sm text-right font-medium">£{v.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-amber-600">{v.voidTime}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
}
