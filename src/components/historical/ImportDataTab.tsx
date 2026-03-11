import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface ParsedRow {
  wix_order_number: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  price_option: string;
  groomer_name: string;
  appointment_date: string | null;
  appointment_end: string | null;
  duration_text: string;
  booking_status: string;
  payment_status: string;
  price_charged: number;
  dog_name: string;
  dog_breed: string;
  dog_age: string;
  customer_message: string;
  registration_date: string | null;
  referral_source: string;
  excluded_from_revenue: boolean;
  revenue_recognised: boolean;
  source: string;
  created_month: number | null;
  created_year: number | null;
}

function parseWixDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  // Format: "MM/DD/YYYY, HH:MM AM/PM" or "M/D/YYYY, H:MM AM/PM"
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

function parseRow(row: Record<string, string>): ParsedRow {
  const firstName = (row["First Name"] || "").trim();
  const lastName = (row["Last Name"] || "").trim();
  const email = (row["Email"] || "").trim().toLowerCase();
  const phone = (row["Phone"] || "").trim();
  const serviceName = (row["Service Name"] || "").trim();
  // Note: "Price Option " has trailing space in Wix exports
  const priceOption = (row["Price Option "] || row["Price Option"] || "").trim();
  const groomer = (row["Staff Member"] || "").trim();
  const bookingStart = parseWixDate(row["Booking Start Time"]);
  const bookingEnd = parseWixDate(row["Booking End Time"]);
  const duration = (row["Duration"] || "").trim();
  const bookingStatus = (row["Booking Status"] || "").trim();
  const paymentStatus = (row["Payment Status"] || "").trim();
  const orderNumber = (row["Order Number"] || "").trim() || null;
  const registrationDate = parseWixDate(row["Registration Date"]);

  // Parse order total: strip ALL £ signs and commas
  const rawTotal = (row["Order Total"] || "0")
    .replace(/£/g, "")
    .replace(/,/g, "")
    .trim();
  const orderTotal = parseFloat(rawTotal) || 0;

  // Form fields
  const dogName = findFormField(row, "dog name", "dog's name", "pet name");
  const dogBreed = findFormField(row, "breed", "dog breed");
  const dogAge = findFormField(row, "dog age", "age");
  const customerMessage = findFormField(row, "message", "additional info", "notes");
  const referralSource = findFormField(row, "referral", "how did you hear", "find us");

  const isCanceled = bookingStatus.toLowerCase().includes("cancel");
  const isPaid = paymentStatus.toLowerCase() === "paid" || paymentStatus.toLowerCase().includes("partial");

  const startDate = bookingStart ? new Date(bookingStart) : null;

  return {
    wix_order_number: orderNumber,
    customer_name: `${firstName} ${lastName}`.trim(),
    customer_email: email,
    customer_phone: phone,
    service_name: serviceName,
    price_option: priceOption,
    groomer_name: groomer,
    appointment_date: bookingStart,
    appointment_end: bookingEnd,
    duration_text: duration,
    booking_status: bookingStatus,
    payment_status: paymentStatus,
    price_charged: orderTotal,
    dog_name: dogName,
    dog_breed: dogBreed,
    dog_age: dogAge,
    customer_message: customerMessage,
    registration_date: registrationDate,
    referral_source: referralSource,
    excluded_from_revenue: isCanceled,
    revenue_recognised: isPaid && !isCanceled,
    source: "wix",
    created_month: startDate ? startDate.getMonth() + 1 : null,
    created_year: startDate ? startDate.getFullYear() : null,
  };
}

export default function ImportDataTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [allParsed, setAllParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = (results.data as Record<string, string>[]).map(parseRow);
          setAllParsed(parsed);
          setPreview(parsed.slice(0, 5));
        } catch {
          toast({ title: "❌ Could not parse file", description: "Please check it is a Wix booking export CSV", variant: "destructive" });
        }
      },
      error: () => {
        toast({ title: "❌ Could not parse file", description: "Please check it is a Wix booking export CSV", variant: "destructive" });
      },
    });
  }, []);

  const runImport = async (data: ParsedRow[]) => {
    setImporting(true);
    setProgress(0);
    const BATCH = 100;
    let imported = 0;

    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);

      const { error } = await supabase
        .from("wix_historical_bookings")
        .upsert(batch as any, {
          onConflict: "wix_order_number",
          ignoreDuplicates: true,
        });

      if (error) {
        console.error("Batch error at index", i, error);
      } else {
        imported += batch.length;
      }

      setProgress(Math.round(Math.min(((i + BATCH) / data.length) * 100, 100)));
    }

    setImporting(false);
    setResult({ imported, skipped: data.length - imported });
    return imported;
  };

  const handleImport = async () => {
    if (allParsed.length === 0) return;
    const imported = await runImport(allParsed);
    toast({ title: `✅ Import complete — ${imported} records processed` });
  };

  const handleClearAndReimport = async () => {
    if (allParsed.length === 0) return;
    setImporting(true);
    setProgress(0);
    // Delete all existing records
    await supabase.from("wix_historical_bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const imported = await runImport(allParsed);
    toast({ title: `✅ Re-import complete — ${imported} records imported` });
  };

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastCompletedMonthLabel = `${MONTH_NAMES[m]} ${y}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold" style={{ color: "#2D1B0E" }}>Import Wix CSV Export</h2>
        <p className="text-sm mt-1" style={{ color: "#8B6F5C" }}>
          Upload a booking export from Wix. The system will parse every row and import it into the archive. Duplicate order numbers are skipped automatically.
        </p>
      </div>

      {/* Drop zone */}
      <label
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-[20px] border-2 border-dashed cursor-pointer transition-colors hover:bg-accent/20"
        style={{ borderColor: "#FF6B35", backgroundColor: "#FFFAF4" }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <Upload className="h-8 w-8" style={{ color: "#FF6B35" }} />
        <span className="text-sm font-medium" style={{ color: "#2D1B0E" }}>
          {file ? file.name : "Drop your .csv file here or click to browse"}
        </span>
        <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>

      {/* Preview */}
      {preview.length > 0 && (
        <Card className="rounded-[20px] border-none shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm flex items-center gap-2" style={{ color: "#2D1B0E" }}>
                <FileText className="h-4 w-4" /> Preview (first 5 rows of {allParsed.length})
              </h3>
              <Badge style={{ backgroundColor: "#FFB800", color: "#2D1B0E" }} className="text-xs font-bold">
                {allParsed.length} total rows
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ backgroundColor: "#FFFAF4" }}>
                  <tr>
                    <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Customer</th>
                    <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Service</th>
                    <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Groomer</th>
                    <th className="text-left p-2 font-semibold" style={{ color: "#8B6F5C" }}>Status</th>
                    <th className="text-right p-2 font-semibold" style={{ color: "#8B6F5C" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "#f0e6da" }}>
                      <td className="p-2">{r.customer_name}</td>
                      <td className="p-2">{r.service_name}</td>
                      <td className="p-2">{r.groomer_name}</td>
                      <td className="p-2">{r.booking_status}</td>
                      <td className="p-2 text-right">£{r.price_charged.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!result && (
              <div className="flex gap-2">
                <Button
                  className="rounded-[30px] font-bold flex-1"
                  style={{ backgroundColor: "#FF6B35" }}
                  disabled={importing}
                  onClick={handleImport}
                >
                  {importing ? "Importing…" : `Import ${allParsed.length} records`}
                </Button>
                <Button
                  className="rounded-[30px] font-bold"
                  variant="outline"
                  disabled={importing}
                  onClick={handleClearAndReimport}
                >
                  Clear &amp; Re-import
                </Button>
              </div>
            )}

            {importing && <Progress value={progress} className="h-2 rounded-full" />}

            {result && (
              <div className="flex items-center gap-2 p-3 rounded-[16px]" style={{ backgroundColor: "#E8F5E9" }}>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {result.imported} records imported, {result.skipped} duplicates skipped
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Archive Completed Month */}
      <div className="border-t pt-6" style={{ borderColor: "#f0e6da" }}>
        <h2 className="font-heading text-xl font-bold" style={{ color: "#2D1B0E" }}>Archive a Completed Month</h2>
        <p className="text-sm mt-1 mb-4" style={{ color: "#8B6F5C" }}>
          Manually archive all bookings from a completed month into the historical record. This runs automatically on the 1st of each month but can be triggered manually here.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#8B6F5C" }}>Month</label>
            <select
              value={archiveMonth}
              onChange={e => setArchiveMonth(Number(e.target.value))}
              className="h-10 px-3 rounded-[30px] border-2 text-sm"
              style={{ borderColor: "#f0e6da" }}
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#8B6F5C" }}>Year</label>
            <select
              value={archiveYear}
              onChange={e => setArchiveYear(Number(e.target.value))}
              className="h-10 px-3 rounded-[30px] border-2 text-sm"
              style={{ borderColor: "#f0e6da" }}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button
            className="rounded-[30px] font-bold text-white"
            style={{ backgroundColor: "#2D1B0E" }}
            disabled={archiving}
            onClick={handleArchiveMonth}
          >
            {archiving ? "Archiving…" : "Archive Month"}
          </Button>
        </div>
      </div>
    </div>
  );
}
