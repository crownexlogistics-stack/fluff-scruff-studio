import { useState, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";
import { Upload, FileSpreadsheet, CheckCircle2, Users, Calendar, ChevronDown, ChevronRight, Pencil, Send, AlertCircle, ShieldCheck, Wrench, Link2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import Papa from "papaparse";
import { format } from "date-fns";

// ─── helpers ───
function convertDate(ddmmyyyy: string): string {
  const parts = ddmmyyyy?.trim().split("/");
  if (!parts || parts.length !== 3) return ddmmyyyy;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function ignoreUnknown(val?: string): string | null {
  if (!val || val.trim().toLowerCase() === "unknown") return null;
  return val.trim();
}

// ─── types ───
interface ParsedRow {
  full_name: string;
  email: string;
  phone: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  service_name: string;
  staff_name: string;
  payment_status: string;
  dog_name: string | null;
  dog_age: string | null;
  dog_breed: string | null;
  is_future_booking: boolean;
  notes?: string | null;
}

type BookingFilter = "all" | "future" | "past" | "not_paid" | "partly_paid";

// Add-on service names (case-insensitive match)
const ADD_ON_SERVICE_NAMES = new Set([
  "ultrasonic teeth cleaning",
  "nail trim",
  "nail trim & filing",
  "de-shedding",
  "bath and blow dry",
  "brush out",
  "teeth cleaning",
]);

function isAddOnService(serviceName: string, durationMinutes: number): boolean {
  return ADD_ON_SERVICE_NAMES.has(serviceName.toLowerCase()) || durationMinutes < 30;
}

/** Group parsed rows by email+date+time+staff and merge add-ons into main bookings */
function groupAddOns(rows: ParsedRow[]): ParsedRow[] {
  const groups = new Map<string, ParsedRow[]>();
  rows.forEach((r) => {
    const key = `${r.email}|${r.booking_date}|${r.booking_time}|${r.staff_name}`.toLowerCase();
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  });

  const result: ParsedRow[] = [];
  groups.forEach((group) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }

    // Check if all services are identical (multiple dogs)
    const uniqueServices = new Set(group.map((r) => r.service_name.toLowerCase()));
    if (uniqueServices.size === 1) {
      // Same service — multiple dogs, keep all with note
      group.forEach((r) => {
        result.push({ ...r, notes: "Multiple dogs — same time slot" });
      });
      return;
    }

    // Different services — find main vs add-ons
    const mainRows = group.filter((r) => !isAddOnService(r.service_name, r.duration_minutes));
    const addOnRows = group.filter((r) => isAddOnService(r.service_name, r.duration_minutes));

    // If no clear main service, pick longest duration
    if (mainRows.length === 0) {
      const sorted = [...group].sort((a, b) => b.duration_minutes - a.duration_minutes);
      mainRows.push(sorted[0]);
      addOnRows.length = 0;
      sorted.slice(1).forEach((r) => addOnRows.push(r));
    }

    // Use first main row, merge add-ons
    const main = { ...mainRows[0] };
    const addOnNames = addOnRows.map((r) => r.service_name);
    const totalDuration = group.reduce((sum, r) => sum + r.duration_minutes, 0);

    main.duration_minutes = totalDuration;
    if (addOnNames.length > 0) {
      const existing = main.notes || "";
      main.notes = (existing ? existing + " | " : "") + "Add-ons: " + addOnNames.join(", ");
    }
    result.push(main);

    // If there were extra main rows (rare), keep them too
    mainRows.slice(1).forEach((r) => result.push(r));
  });

  return result;
}

// Extend ParsedRow to include optional notes

interface SelectedFile {
  file: File;
  id: string;
}

interface ImportResult {
  filesProcessed: number;
  customersImported: number;
  customersSkipped: number;
  bookingsImported: number;
  duplicatesSkipped: number;
  futureBookings: number;
}

interface ImportProgress {
  phase: "parsing" | "customers" | "checking_existing" | "bookings" | "done";
  message: string;
  current: number;
  total: number;
}

function SyncProfilesCard() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-migrated-profiles");
      if (error) throw error;
      const r = data;
      setSyncResult(`✅ ${r.linked} profiles linked, ${r.alreadyLinked} already linked — total ${r.total} customers synced`);
      toast.success("Sync complete!");
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
      setSyncResult(null);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" /> Sync Customers to Profiles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Links migrated customers to auth profiles so they appear across the entire system. Run this after importing new data.
        </p>
        <Button
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          {syncing ? "Syncing…" : "🔗 Sync All Customers to Profiles"}
        </Button>
        {syncResult && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {syncResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImportTab({ onSwitchTab }: { onSwitchTab?: (tab: string) => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [importing, setImporting] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ groups: number; removed: number } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const summary = useMemo(() => {
    if (!parsed.length) return null;
    const emails = new Set(parsed.map((r) => r.email?.toLowerCase()).filter(Boolean));
    const future = parsed.filter((r) => r.is_future_booking).length;
    return { customers: emails.size, bookings: parsed.length, future };
  }, [parsed]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setResult(null);
    setParsed([]);
    setDuplicatesRemoved(0);

    const newFiles: SelectedFile[] = Array.from(files).map((f) => ({
      file: f,
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);

    // Parse all files (existing + new)
    const allFiles = [...selectedFiles.map((sf) => sf.file), ...Array.from(files)];
    parseAllFiles(allFiles);

    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseAllFiles = (files: File[]) => {
    const allRows: ParsedRow[] = [];
    let completed = 0;
    const today = new Date().toISOString().slice(0, 10);

    files.forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows: ParsedRow[] = res.data.map((row: any) => {
            const bookingDate = convertDate(row["Session date"] || "");
            return {
              full_name: (row["bookings.booking_contact_full_name_val"] || "").trim(),
              email: (row["bookings.booking_contact_email_val"] || "").trim().toLowerCase(),
              phone: (row["bookings.booking_contact_phone_val"] || "").trim(),
              booking_date: bookingDate,
              booking_time: (row["Start time"] || "").trim(),
              duration_minutes: parseInt(row["Minutes"] || "60", 10) || 60,
              service_name: (row["Service name"] || "").trim(),
              staff_name: (row["Staff name"] || "").trim().split(" ")[0],
              payment_status: (row["Payment status"] || "").trim(),
              dog_name: ignoreUnknown(row["Form answer 2"]),
              dog_age: ignoreUnknown(row["Form answer 3"]),
              dog_breed: ignoreUnknown(row["Form answer 4"]),
              is_future_booking: bookingDate >= today,
            };
          });
          allRows.push(...rows);
          completed++;

          if (completed === files.length) {
            // Deduplicate by email + date + time + service
            const seen = new Set<string>();
            const deduped: ParsedRow[] = [];
            allRows.forEach((r) => {
              const key = `${r.email}|${r.booking_date}|${r.booking_time}|${r.service_name}`.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                deduped.push(r);
              }
            });
            setDuplicatesRemoved(allRows.length - deduped.length);
            // Group add-ons into main bookings
            const grouped = groupAddOns(deduped);
            setParsed(grouped);
          }
        },
        error: () => toast.error(`Failed to parse ${file.name}`),
      });
    });
  };

  const removeFile = (id: string) => {
    const updated = selectedFiles.filter((sf) => sf.id !== id);
    setSelectedFiles(updated);
    if (updated.length === 0) {
      setParsed([]);
      setDuplicatesRemoved(0);
    } else {
      parseAllFiles(updated.map((sf) => sf.file));
    }
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setParsed([]);
    setDuplicatesRemoved(0);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!parsed.length) return;
    setImporting(true);
    setProgress({ phase: "customers", message: "Importing customers…", current: 0, total: 0 });
    try {
      // Deduplicate customers
      const customerMap = new Map<string, { full_name: string; email: string; phone: string }>();
      parsed.forEach((r) => {
        if (r.email && !customerMap.has(r.email)) {
          customerMap.set(r.email, { full_name: r.full_name, email: r.email, phone: r.phone });
        }
      });

      const customerRows = Array.from(customerMap.values());
      setProgress({ phase: "customers", message: `Importing customers… (${customerRows.length})`, current: 0, total: customerRows.length });

      const { error: custErr } = await supabase
        .from("migrated_customers")
        .upsert(customerRows, { onConflict: "email", ignoreDuplicates: true })
        .select("id, email");
      if (custErr) throw custErr;

      // Fetch all to get IDs and count skipped
      const { data: allCustomers, error: fetchErr } = await supabase
        .from("migrated_customers")
        .select("id, email");
      if (fetchErr) throw fetchErr;

      const emailToId = new Map<string, string>();
      (allCustomers || []).forEach((c: any) => emailToId.set(c.email, c.id));
      const customersSkipped = Math.max(0, customerRows.length - (allCustomers?.length || 0));

      // Check existing bookings for duplicate protection
      setProgress({ phase: "checking_existing", message: "Checking for already-imported bookings…", current: 0, total: 0 });

      // Fetch existing migrated bookings to check duplicates
      const { data: existingBookings, error: existErr } = await supabase
        .from("migrated_bookings")
        .select("migrated_customer_id, booking_date, booking_time, service_name");
      if (existErr) throw existErr;

      const existingKeys = new Set<string>();
      (existingBookings || []).forEach((b: any) => {
        // Look up email from customer id
        const email = Array.from(emailToId.entries()).find(([, id]) => id === b.migrated_customer_id)?.[0];
        if (email) {
          existingKeys.add(`${email}|${b.booking_date}|${b.booking_time}|${b.service_name}`.toLowerCase());
        }
      });

      // Prepare bookings, filtering out already-imported ones
      const allBookingRows = parsed
        .filter((r) => emailToId.has(r.email))
        .map((r) => ({
          key: `${r.email}|${r.booking_date}|${r.booking_time}|${r.service_name}`.toLowerCase(),
          row: {
            migrated_customer_id: emailToId.get(r.email)!,
            dog_name: r.dog_name,
            dog_age: r.dog_age,
            dog_breed: r.dog_breed,
            service_name: r.service_name,
            staff_name: r.staff_name,
            booking_date: r.booking_date,
            booking_time: r.booking_time,
            duration_minutes: r.duration_minutes,
            payment_status: r.payment_status,
            is_future_booking: r.is_future_booking,
            notes: r.notes || null,
          },
        }));

      const newBookings = allBookingRows.filter((b) => !existingKeys.has(b.key));
      const dbDuplicatesSkipped = allBookingRows.length - newBookings.length;
      const bookingRows = newBookings.map((b) => b.row);

      // Insert in batches of 500
      const totalBookings = bookingRows.length;
      let insertedCount = 0;
      for (let i = 0; i < bookingRows.length; i += 500) {
        const batch = bookingRows.slice(i, i + 500);
        setProgress({
          phase: "bookings",
          message: `Importing bookings… (${insertedCount} / ${totalBookings})`,
          current: insertedCount,
          total: totalBookings,
        });
        const { error: bookErr } = await supabase.from("migrated_bookings").insert(batch);
        if (bookErr) throw bookErr;
        insertedCount += batch.length;
      }

      const futureCount = parsed.filter((r) => r.is_future_booking).length;
      setResult({
        filesProcessed: selectedFiles.length,
        customersImported: customerRows.length,
        customersSkipped,
        bookingsImported: bookingRows.length,
        duplicatesSkipped: dbDuplicatesSkipped,
        futureBookings: futureCount,
      });
      setParsed([]);
      setSelectedFiles([]);
      setProgress({ phase: "done", message: "Complete", current: totalBookings, total: totalBookings });
      queryClient.invalidateQueries({ queryKey: ["migrated-customers"] });
      queryClient.invalidateQueries({ queryKey: ["migrated-bookings"] });
      toast.success("Import complete!");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const fixDuplicateSameTimeBookings = async () => {
    setFixing(true);
    setFixResult(null);
    try {
      // Fetch all migrated bookings
      const { data: allBookings, error } = await supabase
        .from("migrated_bookings")
        .select("id, migrated_customer_id, booking_date, booking_time, staff_name, service_name, duration_minutes, notes");
      if (error) throw error;

      // Group by customer + date + time + staff
      const groups = new Map<string, any[]>();
      (allBookings || []).forEach((b: any) => {
        const key = `${b.migrated_customer_id}|${b.booking_date}|${b.booking_time}|${(b.staff_name || "").toLowerCase()}`;
        const list = groups.get(key) || [];
        list.push(b);
        groups.set(key, list);
      });

      let fixedGroups = 0;
      let removedRows = 0;

      for (const [, group] of groups) {
        if (group.length < 2) continue;

        const uniqueServices = new Set(group.map((b: any) => (b.service_name || "").toLowerCase()));

        if (uniqueServices.size === 1) {
          // Same service — multiple dogs, just add note
          for (const b of group) {
            if (!b.notes?.includes("Multiple dogs")) {
              await supabase
                .from("migrated_bookings")
                .update({ notes: (b.notes ? b.notes + " | " : "") + "Multiple dogs — same time slot" })
                .eq("id", b.id);
            }
          }
          fixedGroups++;
          continue;
        }

        // Different services — find main vs add-ons
        const mainRows = group.filter((b: any) => !isAddOnService(b.service_name || "", b.duration_minutes || 60));
        const addOnRows = group.filter((b: any) => isAddOnService(b.service_name || "", b.duration_minutes || 60));

        if (mainRows.length === 0) {
          // No clear main — pick longest duration
          const sorted = [...group].sort((a: any, b: any) => (b.duration_minutes || 0) - (a.duration_minutes || 0));
          mainRows.push(sorted[0]);
          addOnRows.length = 0;
          sorted.slice(1).forEach((r: any) => addOnRows.push(r));
        }

        if (addOnRows.length === 0) continue;

        const main = mainRows[0];
        const addOnNames = addOnRows.map((b: any) => b.service_name);
        const totalDuration = group.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);

        const existingNotes = main.notes || "";
        const newNotes = (existingNotes ? existingNotes + " | " : "") + "Add-ons: " + addOnNames.join(", ");

        // Update main booking
        await supabase
          .from("migrated_bookings")
          .update({ notes: newNotes, duration_minutes: totalDuration })
          .eq("id", main.id);

        // Delete add-on rows
        const idsToDelete = addOnRows.map((b: any) => b.id);
        await supabase
          .from("migrated_bookings")
          .delete()
          .in("id", idsToDelete);

        fixedGroups++;
        removedRows += idsToDelete.length;
      }

      setFixResult({ groups: fixedGroups, removed: removedRows });
      queryClient.invalidateQueries({ queryKey: ["migrated-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["migrated-bookings-for-customers"] });
      toast.success(`Fixed ${fixedGroups} groups — ${removedRows} duplicate rows removed`);
    } catch (err: any) {
      toast.error(err.message || "Fix failed");
    } finally {
      setFixing(false);
    }
  };

  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" /> CSV Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Upload one or more Wix CSV export files</p>
            <p>You can select multiple files at once — we will merge them, remove duplicates and import everything together</p>
          </div>
          <div>
            <Input ref={fileRef} type="file" accept=".csv" multiple onChange={handleFiles} />
          </div>

          {/* File list preview */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected</p>
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-destructive hover:text-destructive">
                  Clear All
                </Button>
              </div>
              <div className="space-y-1">
                {selectedFiles.map((sf) => (
                  <div key={sf.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border text-sm">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{sf.file.name}</span>
                      <span className="text-muted-foreground text-xs">{(sf.file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFile(sf.id)}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {parsed.length > 0 && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary" className="gap-1"><FileSpreadsheet className="h-3 w-3" /> {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}</Badge>
              <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" /> {summary.bookings} bookings</Badge>
              {duplicatesRemoved > 0 && (
                <Badge className="gap-1 bg-orange-100 text-orange-700 border-0">
                  <AlertCircle className="h-3 w-3" /> {duplicatesRemoved} duplicates removed
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {summary.customers} unique customers</Badge>
              <Badge className="gap-1 bg-blue-100 text-blue-700 border-0">{summary.future} future bookings</Badge>
            </div>

            <div className="overflow-auto max-h-80 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Dog</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.full_name}</TableCell>
                      <TableCell className="text-xs">{r.email}</TableCell>
                      <TableCell className="text-xs">{r.booking_date}</TableCell>
                      <TableCell className="text-xs">{r.service_name}</TableCell>
                      <TableCell className="text-xs">{r.dog_name || "—"}</TableCell>
                      <TableCell className="text-xs">{r.payment_status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.length > 10 && (
              <p className="text-xs text-muted-foreground">Showing first 10 of {parsed.length} rows</p>
            )}

            {/* Progress bar during import */}
            {importing && progress && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{progress.message}</p>
                {progress.total > 0 && (
                  <Progress value={progressPercent} className="h-2" />
                )}
              </div>
            )}

            <Button onClick={confirmImport} disabled={importing} className="w-full">
              {importing ? "Importing…" : `Confirm Import (${summary.customers} customers, ${summary.bookings} bookings)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="py-6 space-y-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
              <p className="text-base font-semibold text-green-700">✅ Import complete</p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• {result.filesProcessed} file{result.filesProcessed !== 1 ? "s" : ""} processed</p>
              <p>• {result.customersImported} customers imported{result.customersSkipped > 0 ? ` (${result.customersSkipped} already existed, skipped)` : ""}</p>
              <p>• {result.bookingsImported} bookings imported</p>
              {result.duplicatesSkipped > 0 && (
                <p>• {result.duplicatesSkipped} bookings skipped — already imported</p>
              )}
              <p>• {result.futureBookings} future bookings found</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => {
                onSwitchTab?.("bookings");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}>
                Go to Bookings tab →
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                onSwitchTab?.("customers");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}>
                Go to Customers tab →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fix duplicate same-time bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" /> Fix Existing Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan already-imported bookings for same-time add-on duplicates (e.g. Teeth Cleaning booked as a separate row alongside a Full Groom).
            Merges add-ons into the main booking and removes duplicate rows.
          </p>
          <Button
            variant="outline"
            onClick={fixDuplicateSameTimeBookings}
            disabled={fixing}
            className="gap-2"
          >
            <Wrench className="h-4 w-4" />
            {fixing ? "Fixing…" : "🔧 Fix Duplicate Same-Time Bookings"}
          </Button>
          {fixResult && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
              Fixed {fixResult.groups} group{fixResult.groups !== 1 ? "s" : ""} — {fixResult.removed} duplicate row{fixResult.removed !== 1 ? "s" : ""} removed
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync to profiles */}
      <SyncProfilesCard />
    </div>
  );
}

// ─── Bookings Tab ───
function MigrationBookingsTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [editBooking, setEditBooking] = useState<any | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editDeposit, setEditDeposit] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["migrated-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("*, migrated_customers(full_name, email)")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    switch (filter) {
      case "future": return bookings.filter((b: any) => b.booking_date >= today);
      case "past": return bookings.filter((b: any) => b.booking_date < today);
      case "not_paid": return bookings.filter((b: any) => (b.payment_status || "").toLowerCase() === "not paid");
      case "partly_paid": return bookings.filter((b: any) => (b.payment_status || "").toLowerCase() === "partly paid");
      default: return bookings;
    }
  }, [bookings, filter]);

  const openEdit = (b: any) => {
    setEditBooking(b);
    setEditTotal(b.total_price?.toString() || "");
    setEditDeposit(b.deposit_paid?.toString() || "");
    setEditPaymentStatus(b.payment_status || "Not paid");
    setEditNotes(b.notes || "");
  };

  const amountDue = useMemo(() => {
    const total = parseFloat(editTotal) || 0;
    const deposit = parseFloat(editDeposit) || 0;
    return Math.max(0, total - deposit);
  }, [editTotal, editDeposit]);

  const saveEdit = async () => {
    if (!editBooking) return;
    setSaving(true);
    try {
      const total = parseFloat(editTotal) || null;
      const deposit = parseFloat(editDeposit) || null;
      const due = total != null && deposit != null ? Math.max(0, total - deposit) : null;
      const { error } = await supabase
        .from("migrated_bookings")
        .update({
          total_price: total,
          deposit_paid: deposit,
          amount_due: due,
          payment_status: editPaymentStatus,
          notes: editNotes || null,
        })
        .eq("id", editBooking.id);
      if (error) throw error;
      toast.success("Booking updated");
      setEditBooking(null);
      queryClient.invalidateQueries({ queryKey: ["migrated-bookings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "future", "past", "not_paid", "partly_paid"] as BookingFilter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs capitalize">
            {f.replace("_", " ")}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Dog</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total £</TableHead>
                <TableHead>Deposit £</TableHead>
                <TableHead>Due £</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="text-xs whitespace-nowrap">{b.booking_date}</TableCell>
                  <TableCell className="text-xs">{b.booking_time}</TableCell>
                  <TableCell className="text-xs">{b.migrated_customers?.full_name}</TableCell>
                  <TableCell className="text-xs">{b.migrated_customers?.email}</TableCell>
                  <TableCell className="text-xs">{b.dog_name || "—"}</TableCell>
                  <TableCell className="text-xs">{b.service_name}</TableCell>
                  <TableCell className="text-xs">{b.staff_name || "—"}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="secondary" className="text-[10px]">{b.payment_status || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{b.total_price != null ? `£${Number(b.total_price).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-xs">{b.deposit_paid != null ? `£${Number(b.deposit_paid).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-xs">{b.amount_due != null ? `£${Number(b.amount_due).toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(b)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-8">No bookings found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editBooking} onOpenChange={(open) => !open && setEditBooking(null)}>
        {editBooking && (
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Migrated Booking</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Read-only info */}
              <div className="space-y-1 text-sm bg-muted/50 rounded-lg p-3">
                <p><span className="text-muted-foreground">Customer:</span> {editBooking.migrated_customers?.full_name}</p>
                <p><span className="text-muted-foreground">Date:</span> {editBooking.booking_date} at {editBooking.booking_time}</p>
                <p><span className="text-muted-foreground">Service:</span> {editBooking.service_name}</p>
                <p><span className="text-muted-foreground">Staff:</span> {editBooking.staff_name || "—"}</p>
                <p><span className="text-muted-foreground">Dog:</span> {editBooking.dog_name || "—"} {editBooking.dog_breed ? `(${editBooking.dog_breed})` : ""}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Total Price £</Label>
                  <Input type="number" step="0.01" value={editTotal} onChange={(e) => setEditTotal(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deposit Paid £</Label>
                  <Input type="number" step="0.01" value={editDeposit} onChange={(e) => setEditDeposit(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                <span className="text-muted-foreground">Amount Due:</span>
                <span className="font-semibold">£{amountDue.toFixed(2)}</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payment Status</Label>
                <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Not paid">Not paid</SelectItem>
                    <SelectItem value="Partly paid">Partly paid</SelectItem>
                    <SelectItem value="Exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Migration notes…" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBooking(null)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// ─── Customers Tab ───
function MigrationCustomersTab() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["migrated-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_customers")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch staff emails + auth_user_id to detect staff members in the customer list
  const { data: staffRecords = [] } = useQuery({
    queryKey: ["staff-emails-for-migration"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("email, auth_user_id");
      if (error) throw error;
      return (data || []).filter((s: any) => s.email);
    },
  });

  const staffEmailMap = useMemo(() => {
    const map = new Map<string, string | null>();
    staffRecords.forEach((s: any) => {
      if (s.email) map.set(s.email.toLowerCase(), s.auth_user_id);
    });
    return map;
  }, [staffRecords]);

  const staffEmailSet = useMemo(() => new Set(staffEmailMap.keys()), [staffEmailMap]);

  const { data: allBookings = [] } = useQuery({
    queryKey: ["migrated-bookings-for-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migrated_bookings")
        .select("migrated_customer_id, id, service_name, booking_date, booking_time, is_future_booking")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const bookingsByCustomer = useMemo(() => {
    const map = new Map<string, any[]>();
    allBookings.forEach((b: any) => {
      const list = map.get(b.migrated_customer_id) || [];
      list.push(b);
      map.set(b.migrated_customer_id, list);
    });
    return map;
  }, [allBookings]);

  const activatedCount = customers.filter((c: any) => c.status === "activated" || c.status === "self_registered").length;
  const invitedCount = customers.filter((c: any) => c.status === "invited").length;
  const pendingCount = customers.filter((c: any) => c.status === "pending").length;
  const progress = customers.length > 0 ? (activatedCount / customers.length) * 100 : 0;

  const sendInvite = async (customer: any) => {
    setSendingId(customer.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-migration-invite", {
        body: { migrated_customer_id: customer.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["migrated-customers"] });
      toast.success(`Invite sent to ${customer.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    } finally {
      setSendingId(null);
    }
  };

  const linkStaffAccount = async (customer: any) => {
    const staffAuthId = staffEmailMap.get(customer.email?.toLowerCase());
    if (!staffAuthId) {
      toast.error("Staff account not found — please ensure staff member has signed up");
      return;
    }
    setSendingId(customer.id);
    try {
      const { error } = await supabase
        .from("migrated_customers")
        .update({ supabase_user_id: staffAuthId, status: "activated", activated_at: new Date().toISOString() })
        .eq("id", customer.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["migrated-customers"] });
      toast.success("Booking history linked to staff account ✅");
    } catch (err: any) {
      toast.error(err.message || "Failed to link account");
    } finally {
      setSendingId(null);
    }
  };

  const sendAllPending = async () => {
    const pending = customers.filter((c: any) => c.status === "pending" && !staffEmailSet.has(c.email?.toLowerCase()));
    if (!pending.length) return;
    setSendingAll(true);
    let sent = 0;
    for (const c of pending) {
      try {
        await sendInvite(c);
        sent++;
      } catch {}
    }
    setSendingAll(false);
    toast.success(`${sent} invites sent`);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "activated":
      case "self_registered":
        return <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Signed In</Badge>;
      case "invited": return <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">Invited</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1 mr-4">
          <p className="text-sm text-muted-foreground">{activatedCount} of {customers.length} customers signed in</p>
          <Progress value={progress} className="h-2" />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
            <span>✅ Activated (signed in): {activatedCount}</span>
            <span>📧 Invited (link sent, not signed in): {invitedCount}</span>
            <span>⏳ Pending (not yet invited): {pendingCount}</span>
          </div>
        </div>
        <Button size="sm" onClick={sendAllPending} disabled={sendingAll} className="gap-1">
          <Send className="h-3 w-3" />
          {sendingAll ? "Sending…" : "Send All Pending Invites"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Future</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: any) => {
                const cBookings = bookingsByCustomer.get(c.id) || [];
                const futureCount = cBookings.filter((b: any) => b.is_future_booking).length;
                const isExpanded = expandedId === c.id;
                return (
                  <>
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                      <TableCell className="w-8">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{c.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{c.email}</TableCell>
                      <TableCell className="text-xs">{c.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{cBookings.length}</TableCell>
                      <TableCell className="text-xs">{futureCount}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell>
                        {staffEmailSet.has(c.email?.toLowerCase()) ? (
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="text-[10px] gap-1 cursor-default border-0" style={{ backgroundColor: "#FFB800", color: "#2D1B0E" }}>
                                    👤 Staff + Customer
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>This email belongs to a staff account — booking history can be linked</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {c.status !== "activated" && c.status !== "self_registered" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                disabled={sendingId === c.id}
                                onClick={(e) => { e.stopPropagation(); linkStaffAccount(c); }}
                              >
                                <ShieldCheck className="h-3 w-3" />
                                {sendingId === c.id ? "Linking…" : "Link to Staff Account"}
                              </Button>
                            )}
                          </div>
                        ) : c.status !== "activated" && c.status !== "self_registered" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={sendingId === c.id}
                            onClick={(e) => { e.stopPropagation(); sendInvite(c); }}
                          >
                            <Send className="h-3 w-3" />
                            {sendingId === c.id ? "Sending…" : c.status === "invited" ? "Resend" : "Send Invite"}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                    {isExpanded && cBookings.length > 0 && (
                      <TableRow key={`${c.id}-exp`}>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          <div className="p-3 space-y-1">
                            {cBookings.map((b: any) => (
                              <div key={b.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{b.booking_date}</span>
                                <span>{b.booking_time}</span>
                                <span className="font-medium text-foreground">{b.service_name}</span>
                                {b.is_future_booking && <Badge className="bg-blue-100 text-blue-700 border-0 text-[9px]">Future</Badge>}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No customers imported yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Sync Tab ───
function SyncTab() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ total: number; linked: number; alreadyLinked: number; unlinked: number; errors: string[] } | null>(null);

  const runSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-migrated-profiles");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success(`Sync complete — ${data.linked} profiles linked`);
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            🔗 Sync to Main System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This links all migrated customers to the main customer database so they appear in
            search, profiles and the dashboard. Customers who have already signed up will be
            matched by email automatically.
          </p>
          <Button onClick={runSync} disabled={syncing} className="gap-2">
            🔗 {syncing ? "Syncing…" : "Sync Migrated Customers to Profiles"}
          </Button>
          {result && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-semibold text-green-700 dark:text-green-400">Sync Complete</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• {result.total} total migrated customers</p>
                <p>• {result.linked} newly linked to profiles</p>
                <p>• {result.alreadyLinked} already linked</p>
                <p>• {result.unlinked} without accounts (will be found via email search)</p>
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-destructive space-y-0.5 mt-2">
                  {result.errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-2">How it works</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>✅ All migrated customers are searchable in the customer search bar by name, email, phone or dog name</p>
            <p>✅ Customer profiles show full booking history from both the main system and Wix</p>
            <p>✅ Wix bookings are marked with a <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-600 mx-1">W</Badge> badge</p>
            <p>✅ Dashboard revenue and appointment counts include migrated data</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ───
export default function MigrationPage() {
  const [activeTab, setActiveTab] = useState("import");

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Wix Migration</h1>
          <p className="text-sm text-muted-foreground">Import customers and booking history from Wix</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="sync">Sync</TabsTrigger>
          </TabsList>
          <TabsContent value="import"><ImportTab onSwitchTab={setActiveTab} /></TabsContent>
          <TabsContent value="bookings"><MigrationBookingsTab /></TabsContent>
          <TabsContent value="customers"><MigrationCustomersTab /></TabsContent>
          <TabsContent value="sync"><SyncTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
