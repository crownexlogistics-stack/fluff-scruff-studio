import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Download, X, Info } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, addDays, isBefore, isAfter } from "date-fns";
import Papa from "papaparse";

/* ─── Types ─── */

interface CsvRow {
  date: string;
  time: string;
  orderId: string;
  orderNo: string;
  seller: string;
  amount: number;
  type: string; // "worldpay-tripos" | "cash"
}

/** After grouping by Order ID — a single logical transaction */
interface GroupedTransaction {
  orderId: string;
  date: string;
  time: string;
  seller: string;
  cardAmount: number;
  cashAmount: number;
  total: number;
  orderNo: string;
  isVoid: boolean;
}

interface VoidPair {
  date: string;
  time: string;
  seller: string;
  amount: number;
  voidTime: string;
}

/* ─── CSV parsing ─── */

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

/**
 * Group CSV rows by Order ID.
 * Same Order ID with positive amounts → split payment (card + cash combined).
 * Same Order ID with positive + negative → void pair.
 */
function groupTransactions(rows: CsvRow[]): { transactions: GroupedTransaction[]; voidPairs: VoidPair[] } {
  const groups = new Map<string, CsvRow[]>();
  rows.forEach(r => {
    if (!r.orderId) return;
    if (!groups.has(r.orderId)) groups.set(r.orderId, []);
    groups.get(r.orderId)!.push(r);
  });

  const transactions: GroupedTransaction[] = [];
  const voidPairs: VoidPair[] = [];

  groups.forEach((grp, orderId) => {
    const positives = grp.filter(r => r.amount > 0);
    const negatives = grp.filter(r => r.amount < 0);

    // Void detection: positive + negative pair
    if (positives.length > 0 && negatives.length > 0) {
      const pos = positives[0];
      const neg = negatives[0];
      voidPairs.push({ date: pos.date, time: pos.time, seller: pos.seller, amount: pos.amount, voidTime: neg.time });
      return; // skip voided transactions from totals
    }

    if (positives.length === 0) return;

    // Split payment or single payment
    let cardAmt = 0, cashAmt = 0;
    positives.forEach(r => {
      if (r.type === "cash") cashAmt += r.amount;
      else cardAmt += r.amount;
    });

    const first = positives[0];
    transactions.push({
      orderId,
      date: first.date,
      time: first.time,
      seller: first.seller,
      cardAmount: cardAmt,
      cashAmount: cashAmt,
      total: cardAmt + cashAmt,
      orderNo: first.orderNo,
      isVoid: false,
    });
  });

  return { transactions, voidPairs };
}

/* ─── Main component ─── */

export default function ReconciliationTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [expandedGroomer, setExpandedGroomer] = useState<string | null>(null);

  const now = new Date();
  const weekStart = useMemo(() => startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 }), [weekOffset]);
  const weekEnd = useMemo(() => endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 }), [weekOffset]);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Fetch staff (groomers)
  const { data: staff = [] } = useQuery({
    queryKey: ["recon-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role").eq("role", "Groomer").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings for the week
  const { data: bookings = [] } = useQuery({
    queryKey: ["recon-bookings", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, total_price, deposit_paid, customer_name, staff_id, status, service_id, services:service_id(name), final_charge")
        .gte("booking_date", weekStartStr)
        .lte("booking_date", weekEndStr)
        .in("status", ["Pending", "Confirmed", "Completed", "completed", "confirmed", "pending"]);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch commission records for matching bookings
  const bookingIds = useMemo(() => bookings.map(b => b.id), [bookings]);
  const { data: commissionRecords = [] } = useQuery({
    queryKey: ["recon-commissions", bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("commission_records")
        .select("booking_id, final_charge, total_price, deposit_paid")
        .in("booking_id", bookingIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: bookingIds.length > 0,
  });

  // Build commission lookup by booking_id
  const commissionByBooking = useMemo(() => {
    const map = new Map<string, any>();
    commissionRecords.forEach(c => { if (c.booking_id) map.set(c.booking_id, c); });
    return map;
  }, [commissionRecords]);

  // Filter CSV rows to selected week, then group
  const { weekTransactions, voidPairs } = useMemo(() => {
    const weekRows = allRows.filter(r => r.date >= weekStartStr && r.date <= weekEndStr);
    const { transactions, voidPairs } = groupTransactions(weekRows);
    return { weekTransactions: transactions, voidPairs };
  }, [allRows, weekStartStr, weekEndStr]);

  // Compute CSV coverage: which of the 5 working days (Mon–Fri) have data
  const { workingDays, coveredDays, missingDays, isFullCoverage } = useMemo(() => {
    const days: { date: Date; str: string; label: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const d = addDays(weekStart, i);
      days.push({ date: d, str: format(d, "yyyy-MM-dd"), label: format(d, "EEE dd MMM") });
    }
    const csvDates = new Set(allRows.filter(r => r.date >= weekStartStr && r.date <= weekEndStr).map(r => r.date));
    const covered = days.filter(d => csvDates.has(d.str));
    const missing = days.filter(d => !csvDates.has(d.str));
    return { workingDays: days, coveredDays: covered, missingDays: missing, isFullCoverage: missing.length === 0 };
  }, [allRows, weekStart, weekStartStr, weekEndStr]);

  // Per-groomer summaries
  const groomerSummaries = useMemo(() => {
    return staff.map(s => {
      const firstName = s.name.split(" ")[0].toLowerCase();

      const groomerBookings = bookings.filter(b => b.staff_id === s.id);
      const bookingCount = groomerBookings.length;

      // Balance Due = total_price - deposit_paid for each booking
      const totalBalanceDue = groomerBookings.reduce((sum, b) => {
        return sum + Math.max(0, Number(b.total_price) - Number(b.deposit_paid));
      }, 0);

      // Groomer Typed = final_charge from commission_records (or booking.final_charge fallback)
      const totalGroomerTyped = groomerBookings.reduce((sum, b) => {
        const comm = commissionByBooking.get(b.id);
        const typed = comm?.final_charge ?? b.final_charge;
        return sum + (typed != null ? Number(typed) : 0);
      }, 0);
      const hasAnyTyped = groomerBookings.some(b => {
        const comm = commissionByBooking.get(b.id);
        return (comm?.final_charge ?? b.final_charge) != null;
      });

      // Card Machine = CSV transactions for this groomer
      const csvTxns = weekTransactions.filter(t => t.seller.toLowerCase() === firstName);
      const totalCardMachine = csvTxns.reduce((sum, t) => sum + t.total, 0);

      return {
        staffId: s.id,
        name: s.name,
        firstName,
        bookingCount,
        totalBalanceDue,
        totalGroomerTyped,
        hasAnyTyped,
        totalCardMachine,
        groomerBookings,
        csvTxns,
      };
    }).filter(s => s.bookingCount > 0 || s.csvTxns.length > 0);
  }, [staff, bookings, commissionByBooking, weekTransactions]);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const csvFiles = Array.from(newFiles).filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) return;
    setFiles(prev => [...prev, ...csvFiles]);
    Promise.all(csvFiles.map(f => f.text().then(parseCsvRows))).then(results => {
      setAllRows(prev => [...prev, ...results.flat()]);
    });
  }, []);

  const clearAll = () => { setFiles([]); setAllRows([]); setExpandedGroomer(null); };

  const exportCsv = () => {
    const headers = ["Groomer", "Bookings", "Balance Due", "Groomer Typed", "Card Machine", "Status"];
    const rows = groomerSummaries.map(g => [
      g.name, g.bookingCount, g.totalBalanceDue.toFixed(2), g.totalGroomerTyped.toFixed(2),
      g.totalCardMachine.toFixed(2), getStatus(g).label,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reconciliation-${weekStartStr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = files.length > 0;
  const weekTxnCount = weekTransactions.length;

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o - 1)}>← Previous</Button>
        <p className="text-sm font-medium">{format(weekStart, "dd MMM yyyy")} — {format(weekEnd, "dd MMM yyyy")}</p>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>Next →</Button>
      </div>

      {/* Upload area */}
      <label
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-[20px] border-2 border-dashed cursor-pointer transition-colors hover:border-primary hover:bg-accent/20"
        style={hasData ? { borderColor: "hsl(var(--primary))", backgroundColor: "hsl(var(--accent) / 0.1)" } : undefined}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium">
          {hasData
            ? `${files.length} file(s) loaded — ${weekTxnCount} transactions found for week of ${format(weekStart, "dd MMM")}–${format(weekEnd, "dd MMM")}`
            : "📂 Drop Worldpay CSV files here or click to browse"}
        </span>
        <input type="file" accept=".csv" multiple className="hidden" onChange={e => { if (e.target.files) handleFiles(e.target.files); }} />
      </label>

      {hasData && (
        <div className="flex items-center gap-2 flex-wrap">
          {files.map((f, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1"><FileText className="h-3 w-3" /> {f.name}</Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs"><X className="h-3 w-3 mr-1" /> Clear</Button>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export Report</Button>
        </div>
      )}

      {/* Per-groomer summary table */}
      {groomerSummaries.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Groomer</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead className="text-right">Groomer Typed</TableHead>
                  <TableHead className="text-right">Card Machine</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groomerSummaries.map(g => {
                  const isExpanded = expandedGroomer === g.staffId;
                  return (
                    <GroomerRow
                      key={g.staffId}
                      summary={g}
                      commissionByBooking={commissionByBooking}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedGroomer(isExpanded ? null : g.staffId)}
                      voidPairs={voidPairs.filter(v => v.seller.toLowerCase() === g.firstName)}
                      hasData={hasData}
                      coveredDays={coveredDays.length}
                      missingDays={missingDays}
                      isFullCoverage={isFullCoverage}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {groomerSummaries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">No bookings found for this week</p>
          <p className="text-xs mt-1">Try selecting a different week</p>
        </div>
      )}

      {/* Global void panel */}
      {hasData && voidPairs.length > 0 && (
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
    </div>
  );
}

/* ─── Status logic ─── */

function getStatus(g: { totalBalanceDue: number; totalGroomerTyped: number; totalCardMachine: number; hasAnyTyped: boolean; csvTxns: any[] }): { label: string; color: string; icon: React.ReactNode } {
  const hasCsv = g.csvTxns.length > 0;

  if (!hasCsv) {
    return { label: "No CSV data yet", color: "text-blue-600", icon: <Info className="h-3 w-3 mr-1" /> };
  }

  const balMatch = Math.abs(g.totalCardMachine - g.totalBalanceDue) < 0.01;
  const typedMatch = Math.abs(g.totalGroomerTyped - g.totalBalanceDue) < 0.01;
  const cardTypedMatch = Math.abs(g.totalCardMachine - g.totalGroomerTyped) < 0.01;

  if (balMatch && typedMatch) {
    return { label: "Balanced", color: "text-white", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> };
  }

  if (balMatch && !typedMatch) {
    return { label: "Typing discrepancy", color: "text-white", icon: <AlertTriangle className="h-3 w-3 mr-1" /> };
  }

  const gap = g.totalCardMachine - g.totalBalanceDue;
  return { label: `Card machine gap — £${Math.abs(gap).toFixed(2)}`, color: "text-white", icon: <XCircle className="h-3 w-3 mr-1" /> };
}

function getStatusBadge(g: Parameters<typeof getStatus>[0]) {
  const status = getStatus(g);
  const hasCsv = g.csvTxns.length > 0;

  if (!hasCsv) {
    return <Badge variant="outline" className="text-blue-600 border-blue-300">{status.icon}{status.label}</Badge>;
  }

  const balMatch = Math.abs(g.totalCardMachine - g.totalBalanceDue) < 0.01;
  const typedMatch = Math.abs(g.totalGroomerTyped - g.totalBalanceDue) < 0.01;

  if (balMatch && typedMatch) {
    return <Badge className="bg-emerald-600 text-white">{status.icon}{status.label}</Badge>;
  }
  if (balMatch) {
    return <Badge className="bg-amber-500 text-white">{status.icon}{status.label}</Badge>;
  }
  return <Badge className="bg-destructive text-white">{status.icon}{status.label}</Badge>;
}

/* ─── Groomer drill-down row ─── */

function GroomerRow({ summary: g, commissionByBooking, isExpanded, onToggle, voidPairs, hasData, coveredDays, missingDays, isFullCoverage }: {
  summary: ReturnType<typeof Object>; // groomer summary object
  commissionByBooking: Map<string, any>;
  isExpanded: boolean;
  onToggle: () => void;
  voidPairs: VoidPair[];
  hasData: boolean;
  coveredDays: number;
  missingDays: { date: Date; str: string; label: string }[];
  isFullCoverage: boolean;
}) {
  const s: any = g;
  const coverageColor = !hasData ? "text-muted-foreground" : coveredDays >= 5 ? "text-emerald-600" : coveredDays >= 3 ? "text-amber-600" : "text-destructive";
  const coveragePct = hasData ? (coveredDays / 5) * 100 : 0;
  const coverageBarColor = !hasData ? "bg-muted" : coveredDays >= 5 ? "bg-emerald-500" : coveredDays >= 3 ? "bg-amber-500" : "bg-destructive";

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 px-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">{s.name}</TableCell>
        <TableCell className="text-right">{s.bookingCount}</TableCell>
        <TableCell className="text-right">£{s.totalBalanceDue.toFixed(2)}</TableCell>
        <TableCell className="text-right">
          {s.hasAnyTyped ? `£${s.totalGroomerTyped.toFixed(2)}` : <span className="text-amber-600 italic text-xs">Not entered</span>}
        </TableCell>
        <TableCell className="text-right font-medium">
          {!hasData
            ? <span className="text-muted-foreground text-xs">—</span>
            : !isFullCoverage
              ? <span className="text-blue-600 text-xs italic">Cannot verify — {missingDays.length} day{missingDays.length !== 1 ? "s" : ""} missing</span>
              : `£${s.totalCardMachine.toFixed(2)}`}
        </TableCell>
        <TableCell>
          {hasData ? (
            <div className="flex items-center gap-1.5 min-w-[100px]">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${coverageBarColor}`} style={{ width: `${coveragePct}%` }} />
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${coverageColor}`}>{coveredDays}/5</span>
            </div>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
        <TableCell>
          {!hasData || !isFullCoverage
            ? (!hasData
              ? <Badge variant="outline" className="text-blue-600 border-blue-300"><Info className="h-3 w-3 mr-1" />No CSV data yet</Badge>
              : <Badge variant="outline" className="text-blue-600 border-blue-300"><Info className="h-3 w-3 mr-1" />Incomplete data ({missingDays.length} days missing)</Badge>)
            : getStatusBadge(s)}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="p-0 bg-muted/20">
            <div className="p-4 space-y-4">
              {/* Missing CSV days warning */}
              {hasData && missingDays.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">⚠️ Missing CSV data for: {missingDays.map(d => d.label).join(", ")}</p>
                    <p className="mt-0.5">Upload these files to complete the reconciliation. Card Machine column is incomplete until all dates are uploaded.</p>
                  </AlertDescription>
                </Alert>
              )}
              {/* Appointment drill-down */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Service</TableHead>
                      <TableHead className="text-xs text-right">Balance Due</TableHead>
                      <TableHead className="text-xs text-right">Groomer Typed</TableHead>
                      <TableHead className="text-xs text-right">Card Machine</TableHead>
                      <TableHead className="text-xs text-right">Difference</TableHead>
                      <TableHead className="text-xs">Flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.groomerBookings.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-4">No bookings</TableCell></TableRow>
                    ) : (
                      s.groomerBookings
                        .sort((a: any, b: any) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`))
                        .map((b: any) => {
                          const balanceDue = Math.max(0, Number(b.total_price) - Number(b.deposit_paid));
                          const comm = commissionByBooking.get(b.id);
                          const groomerTyped: number | null = comm?.final_charge ?? b.final_charge ?? null;
                          const typedVal = groomerTyped != null ? Number(groomerTyped) : null;

                          // Try to match CSV transaction: same date, closest amount to balance due
                          const dateTxns = s.csvTxns.filter((t: GroupedTransaction) => t.date === b.booking_date);
                          let csvMatch: GroupedTransaction | null = null;
                          if (dateTxns.length > 0) {
                            // Find closest match by amount
                            csvMatch = dateTxns.reduce((best: GroupedTransaction | null, t: GroupedTransaction) => {
                              if (!best) return t;
                              return Math.abs(t.total - balanceDue) < Math.abs(best.total - balanceDue) ? t : best;
                            }, null);
                          }
                          const cardMachineVal = csvMatch ? csvMatch.total : null;

                          // Flag logic
                          const flag = getRowFlag(balanceDue, typedVal, cardMachineVal, hasData);

                          return (
                            <TableRow key={b.id}>
                              <TableCell className="text-xs">{format(new Date(b.booking_date + "T00:00:00"), "dd MMM")} {b.booking_time?.slice(0, 5)}</TableCell>
                              <TableCell className="text-xs">{b.customer_name}</TableCell>
                              <TableCell className="text-xs">{(b as any).services?.name || "—"}</TableCell>
                              <TableCell className="text-xs text-right">£{balanceDue.toFixed(2)}</TableCell>
                              <TableCell className="text-xs text-right">
                                {typedVal != null
                                  ? `£${typedVal.toFixed(2)}`
                                  : <span className="text-amber-600 italic">Not entered yet</span>}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {csvMatch
                                  ? csvMatch.cashAmount > 0
                                    ? <span>£{csvMatch.cardAmount.toFixed(2)} card + £{csvMatch.cashAmount.toFixed(2)} cash = <strong>£{csvMatch.total.toFixed(2)}</strong></span>
                                    : `£${csvMatch.total.toFixed(2)}`
                                  : <span className="text-muted-foreground italic">—</span>}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {typedVal != null && cardMachineVal != null
                                  ? `£${Math.abs(cardMachineVal - balanceDue).toFixed(2)}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs">{flag}</TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer totals */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm flex-wrap gap-2">
                <span>Balance Due: <strong>£{s.totalBalanceDue.toFixed(2)}</strong></span>
                <span>Groomer Typed: <strong>£{s.totalGroomerTyped.toFixed(2)}</strong></span>
                {hasData && isFullCoverage
                  ? <span>Card Machine: <strong>£{s.totalCardMachine.toFixed(2)}</strong></span>
                  : hasData
                    ? <span className="text-blue-600 italic text-xs">Card Machine: Cannot verify — incomplete data ({missingDays.length} day{missingDays.length !== 1 ? "s" : ""} missing)</span>
                    : null}
              </div>

              {/* Commission impact callouts */}
              {Math.abs(s.totalGroomerTyped - s.totalBalanceDue) > 0.01 && s.hasAnyTyped && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs">
                  <p className="font-medium text-amber-700">
                    Commission is based on £{s.totalGroomerTyped.toFixed(2)} — £{Math.abs(s.totalGroomerTyped - s.totalBalanceDue).toFixed(2)}{" "}
                    {s.totalGroomerTyped > s.totalBalanceDue ? "over" : "under"} what was owed
                  </p>
                </div>
              )}

              {hasData && Math.abs(s.totalCardMachine - s.totalGroomerTyped) > 0.01 && s.hasAnyTyped && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                  <p className="font-medium text-destructive">
                    Card machine shows £{Math.abs(s.totalCardMachine - s.totalGroomerTyped).toFixed(2)}{" "}
                    {s.totalCardMachine > s.totalGroomerTyped ? "more" : "less"} than groomer entered
                  </p>
                </div>
              )}

              {/* Commission note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>{s.name}'s commission is calculated on <strong>Groomer Typed</strong> amounts, not Balance Due. Any difference directly affects their pay.</p>
              </div>

              {/* Void alerts */}
              {voidPairs.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <p className="text-xs font-semibold text-amber-600 mb-1">⚠️ {voidPairs.length} voided transaction(s)</p>
                  {voidPairs.map((v, i) => (
                    <p key={i} className="text-xs text-amber-700">{v.date} {v.time} — £{v.amount.toFixed(2)} voided at {v.voidTime}</p>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ─── Row flag logic ─── */

function getRowFlag(balanceDue: number, groomerTyped: number | null, cardMachine: number | null, hasData: boolean): React.ReactNode {
  // All three match
  if (groomerTyped != null && cardMachine != null) {
    const allMatch = Math.abs(balanceDue - groomerTyped) < 0.01 && Math.abs(balanceDue - cardMachine) < 0.01;
    if (allMatch) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;

    // Groomer typed more than owed
    if (groomerTyped > balanceDue + 0.01) {
      const diff = groomerTyped - balanceDue;
      return <span className="text-destructive font-medium">🔴 Overcharged +£{diff.toFixed(2)}</span>;
    }

    // Groomer typed less than owed
    if (groomerTyped < balanceDue - 0.01) {
      const diff = balanceDue - groomerTyped;
      return <span className="text-amber-600 font-medium">⚠️ Under -£{diff.toFixed(2)}</span>;
    }

    // Card/entry mismatch
    if (Math.abs(cardMachine - groomerTyped) > 0.01) {
      return <span className="text-destructive font-medium">🔴 Card ≠ entry</span>;
    }

    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  }

  if (groomerTyped == null) {
    return <span className="text-amber-600 italic">Not entered</span>;
  }

  if (cardMachine == null) {
    return <span className="text-blue-600 italic">Upload missing?</span>;
  }

  return null;
}
