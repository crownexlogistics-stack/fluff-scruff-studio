import { useState, useRef, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, TrendingUp, ShieldCheck, FolderOpen, Calendar, Users } from "lucide-react";
import GapFillSection from "@/components/wix-migration/GapFillSection";
import { toast } from "sonner";
import Papa from "papaparse";
import { format } from "date-fns";

// ─── CSV Parsing helpers ───

function parseWixDate(raw: string): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const [, month, day, year, hourStr, min, ampm] = match;
    let hour = parseInt(hourStr, 10);
    if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, parseInt(min));
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parsePrice(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[£$,]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

function extractFormFields(row: any) {
  const result = { dog_name: null as string | null, dog_breed: null as string | null, dog_age: null as string | null, referral_source: null as string | null };
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i].toLowerCase();
    const val = (row[keys[i]] || "").trim();
    if (!val) continue;
    if (key.includes("dog name") || key.includes("dog's name") || key.includes("pet name")) result.dog_name = val;
    else if (key.includes("dog breed") || key.includes("breed")) result.dog_breed = val;
    else if (key.includes("dog age") || key.includes("age")) result.dog_age = val;
    else if (key.includes("referral") || key.includes("how did you hear") || key.includes("how did you find")) result.referral_source = val;
  }
  return result;
}

interface ParsedWixRow {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  price_charged: number;
  payment_status: string;
  service_name: string;
  service_type: string | null;
  appointment_date: string | null;
  appointment_end: string | null;
  booking_status: string;
  groomer_name: string | null;
  wix_order_number: string | null;
  duration_text: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  dog_age: string | null;
  referral_source: string | null;
  excluded_from_revenue: boolean;
  revenue_recognised: boolean;
}

function parseRow(row: any): ParsedWixRow {
  const firstName = (row["First Name"] || "").trim();
  const lastName = (row["Last Name"] || "").trim();
  const customerName = `${firstName} ${lastName}`.trim();
  const bookingStatus = (row["Booking Status"] || "Confirmed").trim();
  const paymentStatus = (row["Payment Status"] || "Not Paid").trim();
  const isCanceled = bookingStatus.toLowerCase().includes("cancel");
  const isPaid = paymentStatus.toLowerCase() === "paid" || paymentStatus.toLowerCase().includes("partial");
  const startDate = parseWixDate(row["Booking Start Time"] || "");
  const endDate = parseWixDate(row["Booking End Time"] || "");
  const formFields = extractFormFields(row);

  return {
    customer_name: customerName,
    customer_email: (row["Email"] || "").trim().toLowerCase() || null,
    customer_phone: (row["Phone"] || "").trim() || null,
    price_charged: parsePrice(row["Order Total"] || ""),
    payment_status: paymentStatus,
    service_name: (row["Service Name"] || "").trim(),
    service_type: (row["Service Type"] || "").trim() || null,
    appointment_date: startDate ? startDate.toISOString() : null,
    appointment_end: endDate ? endDate.toISOString() : null,
    booking_status: bookingStatus,
    groomer_name: (row["Staff Member"] || "").trim() || null,
    wix_order_number: (row["Order Number"] || "").trim() || null,
    duration_text: (row["Duration"] || "").trim() || null,
    ...formFields,
    excluded_from_revenue: isCanceled,
    revenue_recognised: isPaid && !isCanceled,
  };
}

// ─── Import Section ───

function ImportSection() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedWixRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; cancelled: number } | null>(null);

  const summary = useMemo(() => {
    if (!parsed.length) return null;
    const cancelled = parsed.filter(r => r.excluded_from_revenue).length;
    const orderNumbers = parsed.map(r => r.wix_order_number).filter(Boolean);
    return { total: parsed.length, toImport: parsed.length, cancelled, orderNumbers };
  }, [parsed]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.map((r: any) => parseRow(r)).filter(r => r.customer_name && r.service_name);
        setParsed(rows);
        toast.success(`Parsed ${rows.length} rows from CSV`);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!parsed.length) return;
    setImporting(true);
    try {
      const orderNumbers = parsed.map(r => r.wix_order_number).filter(Boolean) as string[];
      let existingOrders = new Set<string>();
      if (orderNumbers.length > 0) {
        const { data } = await supabase
          .from("wix_historical_bookings")
          .select("wix_order_number")
          .in("wix_order_number", orderNumbers);
        existingOrders = new Set((data || []).map((d: any) => d.wix_order_number));
      }

      const toInsert = parsed.filter(r => !r.wix_order_number || !existingOrders.has(r.wix_order_number));
      const skipped = parsed.length - toInsert.length;

      let imported = 0;
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error } = await supabase.from("wix_historical_bookings").insert(batch as any[]);
        if (error) throw error;
        imported += batch.length;
      }

      const cancelled = toInsert.filter(r => r.excluded_from_revenue).length;
      setResult({ imported, skipped, cancelled });
      setParsed([]);
      queryClient.invalidateQueries({ queryKey: ["wix-historical"] });
      queryClient.invalidateQueries({ queryKey: ["wix-archive-stats"] });
      toast.success(`Imported ${imported} bookings, ${skipped} duplicates skipped`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" /> Import Wix Bookings CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a CSV exported from Wix Bookings. Duplicate order numbers are automatically skipped — existing records are never overwritten.
        </p>
        <div>
          <Label>Select CSV file</Label>
          <Input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="mt-1" />
        </div>

        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total Rows</p><p className="text-xl font-bold">{summary.total}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">To Import</p><p className="text-xl font-bold text-green-600">{summary.toImport}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Cancelled</p><p className="text-xl font-bold text-destructive">{summary.cancelled}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Order Numbers</p><p className="text-xl font-bold">{summary.orderNumbers.length}</p></CardContent></Card>
            </div>

            <p className="text-sm font-medium">Preview (first 10 rows)</p>
            <div className="overflow-auto max-h-80 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Groomer</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.customer_name}</TableCell>
                      <TableCell className="text-sm">{r.service_name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.appointment_date ? format(new Date(r.appointment_date), "dd MMM yyyy HH:mm") : "—"}</TableCell>
                      <TableCell className="text-sm">{r.groomer_name || "—"}</TableCell>
                      <TableCell className="text-sm">£{r.price_charged.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={r.payment_status === "Paid" ? "default" : "secondary"} className="text-xs">{r.payment_status}</Badge></TableCell>
                      <TableCell><Badge variant={r.excluded_from_revenue ? "destructive" : "outline"} className="text-xs">{r.booking_status}</Badge></TableCell>
                      <TableCell className="text-sm">{r.dog_name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={confirmImport} disabled={importing} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {importing ? "Importing…" : `Import ${summary.toImport} Bookings`}
            </Button>
          </>
        )}

        {result && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 space-y-1">
            <p className="font-medium text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Import Complete</p>
            <p className="text-sm text-green-600">{result.imported} bookings imported</p>
            <p className="text-sm text-green-600">{result.skipped} duplicates skipped</p>
            <p className="text-sm text-green-600">{result.cancelled} cancelled (excluded from revenue)</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Archive Section ───

function ArchiveSection() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groomerFilter, setGroomerFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch archive stats (all records)
  const { data: archiveStats } = useQuery({
    queryKey: ["wix-archive-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wix_historical_bookings")
        .select("appointment_date, price_charged, revenue_recognised, groomer_name");
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const totalRecords = data.length;
      const totalRevenue = data.filter((d: any) => d.revenue_recognised).reduce((s: number, d: any) => s + Number(d.price_charged || 0), 0);

      const dates = data.map((d: any) => d.appointment_date).filter(Boolean).sort();
      const earliest = dates[0];
      const latest = dates[dates.length - 1];

      // Year breakdown
      const yearMap: Record<string, { count: number; revenue: number }> = {};
      data.forEach((d: any) => {
        if (!d.appointment_date) return;
        const year = new Date(d.appointment_date).getFullYear().toString();
        if (!yearMap[year]) yearMap[year] = { count: 0, revenue: 0 };
        yearMap[year].count++;
        if (d.revenue_recognised) yearMap[year].revenue += Number(d.price_charged || 0);
      });

      // Groomer breakdown
      const groomerMap: Record<string, { count: number; revenue: number }> = {};
      data.forEach((d: any) => {
        const name = d.groomer_name || "Unassigned";
        if (!groomerMap[name]) groomerMap[name] = { count: 0, revenue: 0 };
        groomerMap[name].count++;
        if (d.revenue_recognised) groomerMap[name].revenue += Number(d.price_charged || 0);
      });

      return { totalRecords, totalRevenue, earliest, latest, yearMap, groomerMap };
    },
  });

  // Filtered browse query
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["wix-historical", dateFrom, dateTo, groomerFilter, paymentFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("wix_historical_bookings")
        .select("*")
        .order("appointment_date", { ascending: false })
        .limit(500);

      if (dateFrom) q = q.gte("appointment_date", new Date(dateFrom).toISOString());
      if (dateTo) q = q.lte("appointment_date", new Date(dateTo + "T23:59:59").toISOString());
      if (groomerFilter !== "all") q = q.eq("groomer_name", groomerFilter);
      if (paymentFilter !== "all") q = q.eq("payment_status", paymentFilter);
      if (statusFilter !== "all") q = q.eq("booking_status", statusFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: groomers = [] } = useQuery({
    queryKey: ["wix-historical-groomers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wix_historical_bookings")
        .select("groomer_name")
        .not("groomer_name", "is", null);
      const unique = [...new Set((data || []).map((d: any) => d.groomer_name).filter(Boolean))];
      return unique.sort();
    },
  });

  const filteredRevenue = useMemo(() => {
    return bookings.filter((b: any) => b.revenue_recognised).reduce((s: number, b: any) => s + Number(b.price_charged || 0), 0);
  }, [bookings]);

  const hasData = archiveStats && archiveStats.totalRecords > 0;

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {hasData ? (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium text-emerald-700 dark:text-emerald-400">🟢 Archive intact — {archiveStats.totalRecords.toLocaleString()} records protected</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Historical data — for records, analysis and comparison only. This data does not affect live bookings.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400">🟡 No historical data yet — upload your Wix CSV to begin</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">Use the Import tab to upload your Wix Bookings CSV export.</p>
          </div>
        </div>
      )}

      {/* Archive Stats */}
      {hasData && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/40">
              <CardContent className="p-4 text-center">
                <FolderOpen className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{archiveStats.totalRecords.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/40">
              <CardContent className="p-4 text-center">
                <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Date Range</p>
                <p className="text-sm font-bold">
                  {archiveStats.earliest ? format(new Date(archiveStats.earliest), "MMM yyyy") : "—"}
                  {" → "}
                  {archiveStats.latest ? format(new Date(archiveStats.latest), "MMM yyyy") : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/40">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-600" />
                <p className="text-xs text-muted-foreground">Revenue Recognised</p>
                <p className="text-2xl font-bold text-green-600">£{archiveStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/40">
              <CardContent className="p-4 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Groomers</p>
                <p className="text-2xl font-bold">{Object.keys(archiveStats.groomerMap).length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Year breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">📅 Breakdown by Year</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(archiveStats.yearMap).sort(([a], [b]) => a.localeCompare(b)).map(([year, stats]) => (
                  <div key={year} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{year}</span>
                    <span className="text-muted-foreground">
                      {stats.count} bookings · <span className="text-green-600 font-medium">£{stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">✂️ Breakdown by Groomer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(archiveStats.groomerMap).sort(([, a], [, b]) => b.revenue - a.revenue).map(([name, stats]) => (
                  <div key={name} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">
                      {stats.count} bookings · <span className="text-green-600 font-medium">£{stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Browse table */}
      <Card className="bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            📋 Browse Records <Badge variant="outline" className="text-xs">Read-only</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 flex-wrap">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Revenue Recognised (filtered)</p>
                  <p className="text-2xl font-bold text-green-600">£{filteredRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Groomer</Label>
              <Select value={groomerFilter} onValueChange={setGroomerFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {groomers.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Not Paid">Not Paid</SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Canceled">Canceled</SelectItem>
                  <SelectItem value="Checked-In">Checked-In</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Dog</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Groomer</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
                ) : (
                  bookings.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm whitespace-nowrap">{b.appointment_date ? format(new Date(b.appointment_date), "dd MMM yyyy HH:mm") : "—"}</TableCell>
                      <TableCell className="text-sm">{b.customer_name}</TableCell>
                      <TableCell className="text-sm">{b.dog_name || "—"}</TableCell>
                      <TableCell className="text-sm">{b.service_name}</TableCell>
                      <TableCell className="text-sm">{b.groomer_name || "—"}</TableCell>
                      <TableCell className="text-sm">£{Number(b.price_charged).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={b.payment_status === "Paid" ? "default" : "secondary"} className="text-xs">{b.payment_status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.excluded_from_revenue ? "destructive" : "outline"} className="text-xs">{b.booking_status}</Badge>
                      </TableCell>
                      <TableCell>
                        {b.revenue_recognised ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : b.excluded_from_revenue ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Showing up to 500 records. Use filters to narrow results.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ───

const WixMigrationPage = () => {
  const [activeTab, setActiveTab] = useState("archive");

  return (
    <AppLayout>
      <div className="space-y-4 max-w-6xl">
        <div>
          <h1 className="text-2xl font-heading font-bold">Wix Historical Bookings</h1>
          <p className="text-sm text-muted-foreground">Import and browse historical booking data from Wix for revenue analysis</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="archive">📂 Wix Historical Archive</TabsTrigger>
            <TabsTrigger value="import">Import CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="archive" className="mt-4">
            <ArchiveSection />
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <ImportSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default WixMigrationPage;
