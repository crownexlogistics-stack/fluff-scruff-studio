import { useState, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Search, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { format } from "date-fns";

// ─── Types ───

interface ParsedGapRow {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_name: string;
  groomer_name: string | null;
  appointment_date: string | null;
  appointment_end: string | null;
  duration_text: string | null;
  duration_minutes: number;
  price: number;
  booking_status: string;
  payment_status: string;
  wix_order_number: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  dog_age: string | null;
}

interface AnalysedRow extends ParsedGapRow {
  status: "missing" | "exists";
  matchedIn?: string;
  selected: boolean;
  editablePrice: number;
}

// ─── CSV Parsing ───

function parseWixDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const d = new Date(raw.trim());
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function findFormField(row: Record<string, string>, ...patterns: string[]): string {
  for (const key of Object.keys(row)) {
    const lk = key.toLowerCase().trim();
    for (const p of patterns) {
      if (lk.includes(p.toLowerCase())) return (row[key] || "").trim();
    }
  }
  return "";
}

function parseDurationMinutes(durationText: string | null): number {
  if (!durationText) return 60;
  const match = durationText.match(/(\d+)\s*(?:hr|hour)/i);
  const minMatch = durationText.match(/(\d+)\s*min/i);
  let total = 0;
  if (match) total += parseInt(match[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1]);
  return total || 60;
}

function parseCSVRow(row: Record<string, string>): ParsedGapRow {
  const firstName = (row["First Name"] || "").trim();
  const lastName = (row["Last Name"] || "").trim();
  const email = (row["Email"] || "").trim().toLowerCase() || null;
  const phone = (row["Phone"] || "").trim() || null;
  const serviceName = (row["Service Name"] || "").trim();
  const priceOption = (row["Price Option "] || row["Price Option"] || "").trim();
  const groomer = (row["Staff Member"] || "").trim() || null;
  const bookingStart = parseWixDate(row["Booking Start Time"]);
  const bookingEnd = parseWixDate(row["Booking End Time"]);
  const duration = (row["Duration"] || "").trim() || null;
  const bookingStatus = (row["Booking Status"] || "").trim();
  const paymentStatus = (row["Payment Status"] || "").trim();
  const orderNumber = (row["Order Number"] || "").trim() || null;

  const rawTotal = (row["Order Total"] || "0").replace(/£/g, "").replace(/,/g, "").trim();
  const orderTotal = parseFloat(rawTotal) || 0;

  const dogName = findFormField(row, "dog name", "dog's name", "pet name");
  const dogBreed = findFormField(row, "breed", "dog breed");
  const dogAge = findFormField(row, "dog age", "age");

  return {
    customer_name: `${firstName} ${lastName}`.trim(),
    customer_email: email,
    customer_phone: phone,
    service_name: serviceName,
    groomer_name: groomer,
    appointment_date: bookingStart,
    appointment_end: bookingEnd,
    duration_text: duration,
    duration_minutes: parseDurationMinutes(duration),
    price: orderTotal,
    booking_status: bookingStatus,
    payment_status: paymentStatus,
    wix_order_number: orderNumber,
    dog_name: dogName || null,
    dog_breed: dogBreed || null,
    dog_age: dogAge || null,
  };
}

// ─── Component ───

export default function GapFillSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"upload" | "analysing" | "results" | "importing" | "done">("upload");
  const [analysedRows, setAnalysedRows] = useState<AnalysedRow[]>([]);
  const [totalCSV, setTotalCSV] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    bookingsImported: number;
    customersCreated: number;
    skipped: number;
  } | null>(null);

  const missingRows = useMemo(() => analysedRows.filter(r => r.status === "missing"), [analysedRows]);
  const existsCount = useMemo(() => analysedRows.filter(r => r.status === "exists").length, [analysedRows]);
  const selectedMissing = useMemo(() => missingRows.filter(r => r.selected), [missingRows]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    setPhase("analysing");
    setAnalysedRows([]);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const parsed = (res.data as Record<string, string>[])
            .map(parseCSVRow)
            .filter(r => r.customer_name && r.service_name);

          setTotalCSV(parsed.length);

          // Fetch all three data sources in parallel
          const [bookingsRes, migratedRes, historicalRes] = await Promise.all([
            supabase.from("bookings").select("customer_email, booking_date"),
            supabase.from("migrated_bookings").select("id, migrated_customer_id, booking_date"),
            supabase.from("wix_historical_bookings").select("wix_order_number"),
          ]);

          // Also fetch migrated_customers to map IDs to emails
          const { data: migratedCustomers } = await supabase
            .from("migrated_customers")
            .select("id, email");

          const mcEmailMap = new Map<string, string>();
          (migratedCustomers || []).forEach((mc: any) => {
            if (mc.email) mcEmailMap.set(mc.id, mc.email.toLowerCase());
          });

          // Build lookup sets
          // 1. bookings: email+date
          const bookingKeys = new Set<string>();
          (bookingsRes.data || []).forEach((b: any) => {
            if (b.customer_email && b.booking_date) {
              bookingKeys.add(`${b.customer_email.toLowerCase()}|${b.booking_date}`);
            }
          });

          // 2. migrated_bookings: email+date (via customer id lookup)
          const migratedKeys = new Set<string>();
          (migratedRes.data || []).forEach((mb: any) => {
            const email = mcEmailMap.get(mb.migrated_customer_id);
            if (email && mb.booking_date) {
              migratedKeys.add(`${email}|${mb.booking_date}`);
            }
          });

          // 3. wix_historical_bookings: order number
          const historicalOrders = new Set<string>();
          (historicalRes.data || []).forEach((h: any) => {
            if (h.wix_order_number) historicalOrders.add(h.wix_order_number);
          });

          // Analyse each row
          const analysed: AnalysedRow[] = parsed.map(row => {
            const dateOnly = row.appointment_date
              ? row.appointment_date.slice(0, 10)
              : null;
            const emailLower = row.customer_email?.toLowerCase() || null;

            // Check wix_historical by order number
            if (row.wix_order_number && historicalOrders.has(row.wix_order_number)) {
              return { ...row, status: "exists" as const, matchedIn: "wix_historical_bookings", selected: false, editablePrice: row.price };
            }

            // Check bookings by email+date
            if (emailLower && dateOnly && bookingKeys.has(`${emailLower}|${dateOnly}`)) {
              return { ...row, status: "exists" as const, matchedIn: "bookings", selected: false, editablePrice: row.price };
            }

            // Check migrated_bookings by email+date
            if (emailLower && dateOnly && migratedKeys.has(`${emailLower}|${dateOnly}`)) {
              return { ...row, status: "exists" as const, matchedIn: "migrated_bookings", selected: false, editablePrice: row.price };
            }

            // Missing
            return { ...row, status: "missing" as const, selected: true, editablePrice: row.price };
          });

          setAnalysedRows(analysed);
          setPhase("results");
        } catch (err: any) {
          toast.error("Analysis failed: " + (err.message || "Unknown error"));
          setPhase("upload");
        }
      },
      error: () => {
        toast.error("Failed to parse CSV file");
        setPhase("upload");
      },
    });
  }, []);

  const toggleRow = (idx: number) => {
    setAnalysedRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, selected: !r.selected };
    }));
  };

  const updatePrice = (idx: number, value: string) => {
    const num = parseFloat(value) || 0;
    setAnalysedRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, editablePrice: num };
    }));
  };

  const toggleAll = (checked: boolean) => {
    setAnalysedRows(prev => prev.map(r => r.status === "missing" ? { ...r, selected: checked } : r));
  };

  const confirmImport = async () => {
    if (selectedMissing.length === 0) return;
    setPhase("importing");
    setImportProgress(0);

    try {
      // 1. Ensure migrated_customers exist for all emails
      const uniqueEmails = new Map<string, { name: string; phone: string | null }>();
      selectedMissing.forEach(r => {
        if (r.customer_email && !uniqueEmails.has(r.customer_email)) {
          uniqueEmails.set(r.customer_email, { name: r.customer_name, phone: r.customer_phone });
        }
      });

      // Check which emails already exist in profiles or migrated_customers
      const emailList = Array.from(uniqueEmails.keys());

      const [profilesRes, mcRes] = await Promise.all([
        supabase.rpc("get_user_id_by_email", { _email: emailList[0] || "" }),
        supabase.from("migrated_customers").select("id, email").in("email", emailList),
      ]);

      // Build set of existing emails in migrated_customers
      const existingMcEmails = new Set<string>();
      (mcRes.data || []).forEach((mc: any) => {
        if (mc.email) existingMcEmails.add(mc.email.toLowerCase());
      });

      // Insert new migrated_customers
      const newCustomers: { full_name: string; email: string; phone: string | null; status: string }[] = [];
      for (const [email, info] of uniqueEmails) {
        if (!existingMcEmails.has(email.toLowerCase())) {
          newCustomers.push({
            full_name: info.name,
            email: email,
            phone: info.phone,
            status: "pending",
          });
        }
      }

      if (newCustomers.length > 0) {
        const { error: insertErr } = await supabase
          .from("migrated_customers")
          .insert(newCustomers);
        if (insertErr) throw insertErr;
      }

      // Re-fetch all migrated customers to get IDs
      const { data: allMc, error: mcFetchErr } = await supabase
        .from("migrated_customers")
        .select("id, email")
        .in("email", emailList);
      if (mcFetchErr) throw mcFetchErr;

      const emailToMcId = new Map<string, string>();
      (allMc || []).forEach((mc: any) => {
        if (mc.email) emailToMcId.set(mc.email.toLowerCase(), mc.id);
      });

      // 2. Build migrated_bookings rows
      const bookingRows = selectedMissing
        .filter(r => r.customer_email && emailToMcId.has(r.customer_email.toLowerCase()))
        .map(r => {
          const dateOnly = r.appointment_date ? r.appointment_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
          const timeOnly = r.appointment_date
            ? new Date(r.appointment_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
            : null;

          return {
            migrated_customer_id: emailToMcId.get(r.customer_email!.toLowerCase())!,
            service_name: r.service_name,
            staff_name: r.groomer_name || null,
            booking_date: dateOnly,
            booking_time: timeOnly,
            duration_minutes: r.duration_minutes,
            total_price: r.editablePrice,
            payment_status: r.payment_status || null,
            dog_name: r.dog_name || null,
            dog_breed: r.dog_breed || null,
            dog_age: r.dog_age || null,
            is_future_booking: r.appointment_date ? new Date(r.appointment_date) > new Date() : false,
            notes: "booking_source: wix_gap_fill",
          };
        });

      // Also handle rows without email — skip them
      const skippedNoEmail = selectedMissing.filter(r => !r.customer_email).length;

      // 3. Insert in batches
      let inserted = 0;
      for (let i = 0; i < bookingRows.length; i += 200) {
        const batch = bookingRows.slice(i, i + 200);
        const { error: bErr } = await supabase.from("migrated_bookings").insert(batch);
        if (bErr) throw bErr;
        inserted += batch.length;
        setImportProgress(Math.round((inserted / bookingRows.length) * 100));
      }

      setImportResult({
        bookingsImported: inserted,
        customersCreated: newCustomers.length,
        skipped: existsCount + skippedNoEmail,
      });
      setPhase("done");
      toast.success(`Gap fill complete — ${inserted} bookings imported`);
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
      setPhase("results");
    }
  };

  const reset = () => {
    setPhase("upload");
    setAnalysedRows([]);
    setTotalCSV(0);
    setImportResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          🔄 Gap Fill — Missing Bookings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a Wix CSV to find bookings that were missed during the original migration. The system cross-references against live bookings, migrated bookings, and the historical archive — then lets you import only the missing ones.
        </p>

        {/* Upload Phase */}
        {phase === "upload" && (
          <div>
            <Label>Select Wix CSV file</Label>
            <Input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="mt-1" />
          </div>
        )}

        {/* Analysing Phase */}
        {phase === "analysing" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Search className="h-5 w-5 animate-pulse text-primary" />
            <p className="text-sm font-medium">Analysing CSV and cross-referencing against all booking tables…</p>
          </div>
        )}

        {/* Results Phase */}
        {phase === "results" && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-muted/40">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total in CSV</p>
                  <p className="text-xl font-bold">{totalCSV}</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/40">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Already Exists (skip)</p>
                  <p className="text-xl font-bold text-muted-foreground">{existsCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/40">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Missing (to import)</p>
                  <p className="text-xl font-bold text-primary">{missingRows.length}</p>
                </CardContent>
              </Card>
            </div>

            {missingRows.length === 0 ? (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-700">No missing bookings found — all CSV records already exist in the system.</p>
              </div>
            ) : (
              <>
                {/* Missing Bookings Table */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Missing Bookings ({missingRows.length})</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={missingRows.every(r => r.selected)}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                    <span className="text-xs text-muted-foreground">Select all</span>
                  </div>
                </div>

                <div className="overflow-auto max-h-[400px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Groomer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Price (£)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingRows.map((row, _) => {
                        // Find the original index in analysedRows
                        const idx = analysedRows.indexOf(row);
                        return (
                          <TableRow key={idx} className={!row.selected ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={row.selected}
                                onCheckedChange={() => toggleRow(idx)}
                              />
                            </TableCell>
                            <TableCell className="text-sm font-medium">{row.customer_name}</TableCell>
                            <TableCell className="text-sm">
                              {row.customer_email || (
                                <Badge variant="outline" className="text-xs text-amber-600">No email</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{row.customer_phone || "—"}</TableCell>
                            <TableCell className="text-sm">{row.service_name}</TableCell>
                            <TableCell className="text-sm">{row.groomer_name || "—"}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {row.appointment_date
                                ? format(new Date(row.appointment_date), "dd MMM yyyy HH:mm")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">{row.duration_text || `${row.duration_minutes}m`}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.editablePrice}
                                onChange={(e) => updatePrice(idx, e.target.value)}
                                className="w-20 h-8 text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* No-email warning */}
                {missingRows.some(r => !r.customer_email && r.selected) && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Rows without an email address will be skipped — a customer email is required to link the booking.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={confirmImport} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Import {selectedMissing.filter(r => r.customer_email).length} Missing Bookings
                  </Button>
                  <Button variant="outline" onClick={reset}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Importing Phase */}
        {phase === "importing" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Importing missing bookings…</p>
            <Progress value={importProgress} className="h-2" />
          </div>
        )}

        {/* Done Phase */}
        {phase === "done" && importResult && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 space-y-1">
              <p className="font-medium text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Gap Fill Complete
              </p>
              <p className="text-sm text-green-600">{importResult.bookingsImported} bookings imported</p>
              <p className="text-sm text-green-600">{importResult.customersCreated} new customers created</p>
              <p className="text-sm text-green-600">{importResult.skipped} records skipped (already existed or no email)</p>
            </div>
            <Button variant="outline" onClick={reset}>Run Another Gap Fill</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
