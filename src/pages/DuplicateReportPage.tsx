import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  booking_date: string;
  booking_time: string;
  service_id: string | null;
  staff_id: string | null;
  total_price: number;
  status: string;
  created_at: string;
}

interface DuplicateGroup {
  key: string;
  bookings: Booking[];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function runChecks(bookings: Booking[]) {
  // CHECK 1: same email + date + time
  const check1Map = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!b.customer_email) continue;
    const k = `${b.customer_email.toLowerCase()}|${b.booking_date}|${b.booking_time}`;
    if (!check1Map.has(k)) check1Map.set(k, []);
    check1Map.get(k)!.push(b);
  }
  const check1: DuplicateGroup[] = [];
  check1Map.forEach((bks, key) => {
    if (bks.length > 1) check1.push({ key, bookings: bks });
  });

  // CHECK 2: same email + date + service
  const check2Map = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!b.customer_email) continue;
    const k = `${b.customer_email.toLowerCase()}|${b.booking_date}|${b.service_id || ""}`;
    if (!check2Map.has(k)) check2Map.set(k, []);
    check2Map.get(k)!.push(b);
  }
  const check2: DuplicateGroup[] = [];
  check2Map.forEach((bks, key) => {
    if (bks.length > 1) check2.push({ key, bookings: bks });
  });

  // CHECK 3: same email + date, times within 2h
  const check3DateMap = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!b.customer_email) continue;
    const k = `${b.customer_email.toLowerCase()}|${b.booking_date}`;
    if (!check3DateMap.has(k)) check3DateMap.set(k, []);
    check3DateMap.get(k)!.push(b);
  }
  const check3: DuplicateGroup[] = [];
  check3DateMap.forEach((bks, key) => {
    if (bks.length < 2) return;
    const flagged = new Set<string>();
    for (let i = 0; i < bks.length; i++) {
      for (let j = i + 1; j < bks.length; j++) {
        if (Math.abs(timeToMinutes(bks[i].booking_time) - timeToMinutes(bks[j].booking_time)) <= 120) {
          flagged.add(bks[i].id);
          flagged.add(bks[j].id);
        }
      }
    }
    if (flagged.size > 0) {
      check3.push({ key, bookings: bks.filter((b) => flagged.has(b.id)) });
    }
  });

  // CHECK 4: same phone + date + time
  const check4Map = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!b.customer_phone) continue;
    const k = `${b.customer_phone}|${b.booking_date}|${b.booking_time}`;
    if (!check4Map.has(k)) check4Map.set(k, []);
    check4Map.get(k)!.push(b);
  }
  const check4: DuplicateGroup[] = [];
  check4Map.forEach((bks, key) => {
    if (bks.length > 1) check4.push({ key, bookings: bks });
  });

  return { check1, check2, check3, check4 };
}

const CHECK_LABELS = [
  "Same customer booked twice at identical date & time",
  "Same customer, same service, same day",
  "Same customer, same day, times within 2 hours",
  "Same phone number, same date & time",
];

function GroupTable({ groups, checkLabel }: { groups: DuplicateGroup[]; checkLabel: string }) {
  const navigate = useNavigate();
  if (groups.length === 0) {
    return <p className="text-green-700 py-2">✅ No issues found</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Groomer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Booking ID</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group, gi) =>
          group.bookings.map((b, bi) => (
            <TableRow
              key={b.id}
              className="border-l-4"
              style={{ borderLeftColor: "#fbbf24" }}
            >
              <TableCell>
                <span className="flex items-center gap-2">
                  {bi === 0 && (
                    <Badge className="text-[10px] px-1.5 py-0.5" style={{ background: "#fff8e7", color: "#92400e", border: "1px solid #fbbf24" }}>
                      Group {gi + 1}
                    </Badge>
                  )}
                  {b.customer_name}
                </span>
              </TableCell>
              <TableCell className="text-xs">{b.customer_email || "—"}</TableCell>
              <TableCell className="text-xs">{b.customer_phone || "—"}</TableCell>
              <TableCell className="text-xs">{b.booking_date}</TableCell>
              <TableCell className="text-xs">{b.booking_time}</TableCell>
              <TableCell className="text-xs">{b.service_id || "—"}</TableCell>
              <TableCell className="text-xs">{b.staff_id || "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{b.status}</Badge></TableCell>
              <TableCell className="text-xs">£{Number(b.total_price).toFixed(2)}</TableCell>
              <TableCell className="text-xs font-mono">{b.id.slice(0, 8)}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => navigate(`/bookings`)}>
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function exportCSV(checks: { check1: DuplicateGroup[]; check2: DuplicateGroup[]; check3: DuplicateGroup[]; check4: DuplicateGroup[] }) {
  const rows: string[][] = [["Check Type", "Group", "Customer Name", "Email", "Phone", "Date", "Time", "Service", "Status", "Amount", "Booking ID"]];
  const allChecks = [
    { label: CHECK_LABELS[0], groups: checks.check1 },
    { label: CHECK_LABELS[1], groups: checks.check2 },
    { label: CHECK_LABELS[2], groups: checks.check3 },
    { label: CHECK_LABELS[3], groups: checks.check4 },
  ];
  for (const c of allChecks) {
    c.groups.forEach((g, gi) => {
      for (const b of g.bookings) {
        rows.push([
          c.label,
          String(gi + 1),
          b.customer_name,
          b.customer_email || "",
          b.customer_phone || "",
          b.booking_date,
          b.booking_time,
          b.service_id || "",
          b.status,
          String(b.total_price),
          b.id,
        ]);
      }
    });
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `duplicate-report-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DuplicateReportPage() {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ["duplicate-booking-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_email, customer_phone, booking_date, booking_time, service_id, staff_id, total_price, status, created_at")
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
  });

  const checks = useMemo(() => {
    if (!bookings) return null;
    return runChecks(bookings);
  }, [bookings]);

  const handleRefresh = () => {
    refetch();
    setLastChecked(new Date());
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl" style={{ color: "#2D1B0E" }}>
              🔍 Duplicate Booking Report
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Read-only investigation — no bookings are changed here
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Last checked: {format(lastChecked, "HH:mm:ss")}
            </span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              className="text-white"
              style={{ background: "#FF6B35" }}
              onClick={() => checks && exportCSV(checks)}
              disabled={!checks}
            >
              <Download className="h-4 w-4 mr-1" /> Export Report CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : checks ? (
          <>
            {/* KPI Pills */}
            <div className="flex flex-wrap gap-3">
              <Pill label="Total Scanned" value={bookings?.length ?? 0} alwaysGreen />
              <Pill label="Check 1 Groups" value={checks.check1.length} />
              <Pill label="Check 2 Groups" value={checks.check2.length} />
              <Pill label="Check 3 Groups" value={checks.check3.length} />
              <Pill label="Check 4 Groups" value={checks.check4.length} />
            </div>

            {/* Accordion Sections */}
            <Accordion type="multiple" className="space-y-3">
              {[checks.check1, checks.check2, checks.check3, checks.check4].map((groups, i) => (
                <AccordionItem key={i} value={`check-${i}`} className="border rounded-xl overflow-hidden">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {CHECK_LABELS[i]}
                      {groups.length === 0 ? (
                        <Badge className="text-[10px]" style={{ background: "#f0fdf4", color: "#166534" }}>
                          ✅ 0 issues
                        </Badge>
                      ) : (
                        <Badge className="text-[10px]" style={{ background: "#fff8e7", color: "#92400e" }}>
                          ⚠️ {groups.length} groups flagged
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <GroupTable groups={groups} checkLabel={CHECK_LABELS[i]} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

function Pill({ label, value, alwaysGreen }: { label: string; value: number; alwaysGreen?: boolean }) {
  const bg = alwaysGreen || value === 0 ? "#f0fdf4" : "#fff8e7";
  return (
    <div
      className="px-4 py-2 rounded-2xl text-sm font-medium"
      style={{ background: bg, border: "1px solid #f0e6da" }}
    >
      <span className="text-muted-foreground text-xs block">{label}</span>
      <span className="text-lg font-bold" style={{ color: "#2D1B0E" }}>{value}</span>
    </div>
  );
}
