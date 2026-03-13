import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Download, X } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import Papa from "papaparse";

interface CsvRow {
  date: string;
  time: string;
  orderId: string;
  orderNo: string;
  seller: string;
  amount: number;
  type: string;
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [expandedGroomer, setExpandedGroomer] = useState<string | null>(null);

  const now = new Date();
  const weekStart = useMemo(() => startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 }), [weekOffset]);
  const weekEnd = useMemo(() => endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 }), [weekOffset]);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Fetch staff
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

  // Filter CSV rows to selected week
  const weekRows = useMemo(() => {
    return allRows.filter(r => r.date >= weekStartStr && r.date <= weekEndStr);
  }, [allRows, weekStartStr, weekEndStr]);

  // Detect voids
  const { positiveRows, voidPairs, voidedIds } = useMemo(() => {
    const orderGroups = new Map<string, CsvRow[]>();
    weekRows.forEach(r => {
      if (!r.orderId) return;
      if (!orderGroups.has(r.orderId)) orderGroups.set(r.orderId, []);
      orderGroups.get(r.orderId)!.push(r);
    });
    const voids: VoidPair[] = [];
    const voided = new Set<string>();
    orderGroups.forEach((rows, id) => {
      if (rows.length >= 2) {
        const pos = rows.find(r => r.amount > 0);
        const neg = rows.find(r => r.amount < 0);
        if (pos && neg) {
          voids.push({ date: pos.date, time: pos.time, seller: pos.seller, amount: pos.amount, voidTime: neg.time });
          voided.add(id);
        }
      }
    });
    const positive = weekRows.filter(r => r.amount > 0 && !voided.has(r.orderId));
    return { positiveRows: positive, voidPairs: voids, voidedIds: voided };
  }, [weekRows]);

  // Per-groomer summary
  const groomerSummaries = useMemo(() => {
    return staff.map(s => {
      const firstName = s.name.split(" ")[0].toLowerCase();

      // Bookings for this groomer this week
      const groomerBookings = bookings.filter(b => b.staff_id === s.id);
      const bookingCount = groomerBookings.length;
      // Expected = balance due (total_price - deposit_paid) for each booking
      const expected = groomerBookings.reduce((sum, b) => {
        const balance = Math.max(0, Number(b.total_price) - Number(b.deposit_paid));
        return sum + balance;
      }, 0);

      // CSV rows for this groomer
      const csvRows = positiveRows.filter(r => r.seller.toLowerCase() === firstName);
      const collected = csvRows.reduce((sum, r) => sum + r.amount, 0);

      const difference = collected - expected;

      return {
        staffId: s.id,
        name: s.name,
        firstName,
        bookingCount,
        expected,
        collected,
        difference,
        groomerBookings,
        csvRows,
      };
    }).filter(s => s.bookingCount > 0 || s.collected > 0);
  }, [staff, bookings, positiveRows]);

  // Unmatched CSV sellers (not matching any groomer)
  const unmatchedCsvRows = useMemo(() => {
    const groomerFirstNames = new Set(staff.map(s => s.name.split(" ")[0].toLowerCase()));
    return positiveRows.filter(r => !groomerFirstNames.has(r.seller.toLowerCase()));
  }, [positiveRows, staff]);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const csvFiles = Array.from(newFiles).filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) return;
    setFiles(prev => [...prev, ...csvFiles]);
    const promises = csvFiles.map(f => f.text().then(parseCsvRows));
    Promise.all(promises).then(results => {
      setAllRows(prev => [...prev, ...results.flat()]);
    });
  }, []);

  const clearAll = () => {
    setFiles([]);
    setAllRows([]);
    setExpandedGroomer(null);
  };

  const exportCsv = () => {
    const headers = ["Groomer", "Bookings", "Expected", "Collected", "Difference", "Status"];
    const rows = groomerSummaries.map(g => [
      g.name, g.bookingCount, g.expected.toFixed(2), g.collected.toFixed(2),
      g.difference.toFixed(2),
      g.difference === 0 ? "Balanced" : g.difference > 0 ? `Over by £${g.difference.toFixed(2)}` : `Short by £${Math.abs(g.difference).toFixed(2)}`,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${weekStartStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = files.length > 0;
  const weekTransactionCount = weekRows.filter(r => r.amount > 0).length;

  // Overall summary for the week
  const totalExpected = groomerSummaries.reduce((s, g) => s + g.expected, 0);
  const totalCollected = groomerSummaries.reduce((s, g) => s + g.collected, 0);
  const totalDiff = totalCollected - totalExpected;
  const totalBookings = groomerSummaries.reduce((s, g) => s + g.bookingCount, 0);

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
        style={{ borderColor: hasData ? "hsl(var(--primary))" : undefined, backgroundColor: hasData ? "hsl(var(--accent) / 0.1)" : undefined }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium">
          {hasData
            ? `${files.length} file(s) loaded — ${weekTransactionCount} transactions found for week of ${format(weekStart, "dd MMM")}–${format(weekEnd, "dd MMM")}`
            : "📂 Drop Worldpay CSV files here or click to browse"}
        </span>
        <input type="file" accept=".csv" multiple className="hidden" onChange={e => { if (e.target.files) handleFiles(e.target.files); }} />
      </label>

      {hasData && (
        <div className="flex items-center gap-2 flex-wrap">
          {files.map((f, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1">
              <FileText className="h-3 w-3" /> {f.name}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Export Report
          </Button>
        </div>
      )}

      {/* Summary card */}
      {hasData && groomerSummaries.length > 0 && (
        <Card className={totalDiff === 0 ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : totalDiff < 0 ? "border-destructive/30 bg-destructive/5" : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"}>
          <CardContent className="p-5">
            <p className="text-sm font-medium">
              Week of {format(weekStart, "dd MMM")}–{format(weekEnd, "dd MMM")}: Collected{" "}
              <span className="font-bold">£{totalCollected.toFixed(2)}</span> against{" "}
              <span className="font-bold">£{totalExpected.toFixed(2)}</span> expected across{" "}
              <span className="font-bold">{totalBookings}</span> bookings —{" "}
              {totalDiff === 0 ? (
                <span className="text-emerald-600 font-bold">✅ Balanced</span>
              ) : totalDiff > 0 ? (
                <span className="text-amber-600 font-bold">⚠️ Over by £{totalDiff.toFixed(2)}</span>
              ) : (
                <span className="text-destructive font-bold">🔴 Short by £{Math.abs(totalDiff).toFixed(2)}</span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Per-groomer summary table */}
      {hasData && groomerSummaries.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Groomer</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
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
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedGroomer(isExpanded ? null : g.staffId)}
                      voidPairs={voidPairs.filter(v => v.seller.toLowerCase() === g.firstName)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Unmatched CSV sellers */}
      {hasData && unmatchedCsvRows.length > 0 && (
        <Card className="border-amber-300">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-600 mb-2">
              ⚠️ {unmatchedCsvRows.length} transaction(s) from unrecognised sellers
            </p>
            <div className="flex flex-wrap gap-2">
              {[...new Set(unmatchedCsvRows.map(r => r.seller))].map(s => (
                <Badge key={s} variant="outline" className="text-xs">{s} — £{unmatchedCsvRows.filter(r => r.seller === s).reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
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

      {hasData && groomerSummaries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">No bookings or transactions found for this week</p>
          <p className="text-xs mt-1">Try selecting a different week or uploading the correct CSV files</p>
        </div>
      )}
    </div>
  );
}

/* ─── Drill-down row component ─── */
function GroomerRow({ summary, isExpanded, onToggle, voidPairs }: {
  summary: {
    staffId: string; name: string; firstName: string;
    bookingCount: number; expected: number; collected: number; difference: number;
    groomerBookings: any[]; csvRows: CsvRow[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  voidPairs: VoidPair[];
}) {
  const g = summary;
  const statusBadge = g.difference === 0 ? (
    <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Balanced</Badge>
  ) : g.difference > 0 ? (
    <Badge className="bg-amber-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Over by £{g.difference.toFixed(2)}</Badge>
  ) : (
    <Badge className="bg-destructive text-white"><XCircle className="h-3 w-3 mr-1" />Short by £{Math.abs(g.difference).toFixed(2)}</Badge>
  );

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 px-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">{g.name}</TableCell>
        <TableCell className="text-right">{g.bookingCount}</TableCell>
        <TableCell className="text-right">£{g.expected.toFixed(2)}</TableCell>
        <TableCell className="text-right font-medium">£{g.collected.toFixed(2)}</TableCell>
        <TableCell className={`text-right font-bold ${g.difference === 0 ? "text-emerald-600" : g.difference > 0 ? "text-amber-600" : "text-destructive"}`}>
          {g.difference >= 0 ? "+" : ""}£{g.difference.toFixed(2)}
        </TableCell>
        <TableCell>{statusBadge}</TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="p-0 bg-muted/20">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* LEFT: Bookings */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">What bookings expected</p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date/Time</TableHead>
                          <TableHead className="text-xs">Customer</TableHead>
                          <TableHead className="text-xs">Service</TableHead>
                          <TableHead className="text-xs text-right">Balance Due</TableHead>
                          <TableHead className="text-xs text-right">Charged</TableHead>
                          <TableHead className="text-xs">Match?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.groomerBookings.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-4">No bookings</TableCell></TableRow>
                        ) : (
                          g.groomerBookings
                            .sort((a: any, b: any) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`))
                            .map((b: any) => {
                              const balance = Math.max(0, Number(b.total_price) - Number(b.deposit_paid));
                              const charged = b.final_charge != null ? Number(b.final_charge) : null;
                              const match = charged != null ? Math.abs(charged - balance) < 0.01 : null;
                              return (
                                <TableRow key={b.id}>
                                  <TableCell className="text-xs">{format(new Date(b.booking_date + "T00:00:00"), "dd MMM")} {b.booking_time?.slice(0, 5)}</TableCell>
                                  <TableCell className="text-xs">{b.customer_name}</TableCell>
                                  <TableCell className="text-xs">{(b as any).services?.name || "—"}</TableCell>
                                  <TableCell className="text-xs text-right">£{balance.toFixed(2)}</TableCell>
                                  <TableCell className="text-xs text-right">{charged != null ? `£${charged.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}</TableCell>
                                  <TableCell className="text-xs">
                                    {match === null ? "—" : match ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* RIGHT: CSV transactions */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">What card reader recorded</p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date/Time</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Order No</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.csvRows.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">No CSV transactions</TableCell></TableRow>
                        ) : (
                          g.csvRows
                            .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
                            .map((r, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs">{r.date} {r.time}</TableCell>
                                <TableCell className="text-xs text-right font-medium">£{r.amount.toFixed(2)}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px]">{r.type === "worldpay-tripos" ? "Card" : r.type === "cash" ? "Cash" : r.type}</Badge></TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.orderNo}</TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Totals bar */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
                <span>Bookings total: <span className="font-bold">£{g.expected.toFixed(2)}</span></span>
                <span>Card reader total: <span className="font-bold">£{g.collected.toFixed(2)}</span></span>
                <span className={`font-bold ${g.difference === 0 ? "text-emerald-600" : g.difference < 0 ? "text-destructive" : "text-amber-600"}`}>
                  Gap: £{Math.abs(g.difference).toFixed(2)} {g.difference === 0 ? "✅" : g.difference > 0 ? "⚠️" : "🔴"}
                </span>
              </div>

              {/* Void alerts for this groomer */}
              {voidPairs.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <p className="text-xs font-semibold text-amber-600 mb-1">⚠️ {voidPairs.length} voided transaction(s)</p>
                  {voidPairs.map((v, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      {v.date} {v.time} — £{v.amount.toFixed(2)} voided at {v.voidTime}
                    </p>
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
