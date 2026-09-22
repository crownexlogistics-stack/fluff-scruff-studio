import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, Row, Section } from "./primitives";

type PeriodKey = "month" | "3months" | "all";

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "3months", label: "Last 3 months" },
  { key: "all", label: "All time" },
];

interface BookingRow {
  staff_id: string | null;
  customer_email: string | null;
  booking_date: string;
  status: string | null;
}

const EXCLUDED = new Set(["Cancelled", "No Show", "Refunded"]);

function useRetentionData() {
  return useQuery({
    queryKey: ["owner-groomer-retention"],
    queryFn: async () => {
      const [{ data: bookings, error: bErr }, { data: staff, error: sErr }] = await Promise.all([
        supabase.from("bookings").select("staff_id, customer_email, booking_date, status").order("booking_date"),
        supabase.from("staff").select("id, name, role").order("name"),
      ]);
      if (bErr) throw bErr;
      if (sErr) throw sErr;
      return {
        bookings: (bookings ?? []) as BookingRow[],
        staff: (staff ?? []) as { id: string; name: string; role: string | null }[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);
const show = (value: number | null) => (value === null ? "—" : `${value}%`);

export function OwnerGroomerRetention() {
  const { data, isLoading } = useRetentionData();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [groomerId, setGroomerId] = useState<string>("");

  const groomers = useMemo(() => {
    if (!data) return [];
    const withWork = new Set(data.bookings.map((b) => b.staff_id).filter(Boolean) as string[]);
    return data.staff.filter((s) => withWork.has(s.id));
  }, [data]);

  const selected = groomerId || groomers[0]?.id || "";

  const range = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (period === "month") return { start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: today, label: format(new Date(), "MMMM yyyy") };
    if (period === "3months") return { start: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"), end: today, label: `${format(subMonths(new Date(), 2), "MMM")} – ${format(new Date(), "MMM yyyy")}` };
    return { start: "0000-01-01", end: today, label: "All time to date" };
  }, [period]);

  const stats = useMemo(() => {
    if (!data || !selected) return null;
    const valid = data.bookings.filter((b) => !EXCLUDED.has(b.status ?? "") && b.customer_email);
    const byGroomer = valid.filter((b) => b.staff_id === selected);
    const inPeriod = byGroomer.filter((b) => b.booking_date >= range.start && b.booking_date <= range.end);

    const customers = new Map<string, { first: string; last: string }>();
    inPeriod.forEach((b) => {
      const email = b.customer_email!.toLowerCase();
      const existing = customers.get(email);
      if (!existing) customers.set(email, { first: b.booking_date, last: b.booking_date });
      else {
        if (b.booking_date < existing.first) existing.first = b.booking_date;
        if (b.booking_date > existing.last) existing.last = b.booking_date;
      }
    });

    const byCustomer = new Map<string, string[]>();
    byGroomer.forEach((b) => {
      const email = b.customer_email!.toLowerCase();
      const list = byCustomer.get(email) ?? [];
      list.push(b.booking_date);
      byCustomer.set(email, list);
    });

    let returning = 0;
    let cameBack = 0;
    customers.forEach((visit, email) => {
      const dates = byCustomer.get(email) ?? [];
      if (dates.some((d) => d < visit.first)) returning++;
      // Came back = another appointment with this groomer after their first visit in the period
      if (dates.some((d) => d > visit.first)) cameBack++;
    });

    // Repeat visits = appointments in the period that were not that customer's
    // very first appointment with this groomer.
    const firstEver = new Map<string, string>();
    byCustomer.forEach((dates, email) => {
      firstEver.set(email, dates.reduce((a, b) => (b < a ? b : a)));
    });
    const repeatVisits = inPeriod.filter((b) => b.booking_date > (firstEver.get(b.customer_email!.toLowerCase()) ?? b.booking_date)).length;

    const totalCustomers = customers.size;
    return {
      appointments: inPeriod.length,
      totalCustomers,
      returning,
      newCustomers: totalCustomers - returning,
      returningPct: pct(returning, totalCustomers),
      newPct: pct(totalCustomers - returning, totalCustomers),
      repeatVisits,
      repeatPct: pct(repeatVisits, inPeriod.length),
      cameBack,
      cameBackPct: pct(cameBack, totalCustomers),
    };
  }, [data, selected, range]);

  const groomerName = groomers.find((g) => g.id === selected)?.name ?? "";

  return (
    <Section title="Groomer retention" hint={range.label}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selected} onValueChange={setGroomerId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Choose a groomer" />
          </SelectTrigger>
          <SelectContent>
            {groomers.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {periodOptions.map((option) => (
          <Button key={option.key} size="sm" variant={period === option.key ? "default" : "outline"} onClick={() => setPeriod(option.key)}>
            {option.label}
          </Button>
        ))}
      </div>

      <Panel className="p-5">
        {isLoading || !stats ? (
          <Skeleton className="h-40 w-full" />
        ) : stats.appointments === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments for {groomerName || "this groomer"} in this period.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
            <div>
              <Row label="Appointments" value={stats.appointments.toLocaleString("en-GB")} />
              <Row label="Customers seen" value={stats.totalCustomers.toLocaleString("en-GB")} />
              <Row label="Returning to this groomer" hint="Had seen this groomer before" value={`${show(stats.returningPct)} · ${stats.returning}`} />
              <Row label="New to this groomer" value={`${show(stats.newPct)} · ${stats.newCustomers}`} />
            </div>
            <div>
              <Row
                label="Rebooked after this period"
                hint="Booked with this groomer again after their visit"
                value={`${show(stats.rebookedPct)} · ${stats.rebookedAfter}`}
                tone={stats.rebookedPct !== null && stats.rebookedPct >= 50 ? "good" : stats.rebookedPct !== null && stats.rebookedPct < 25 ? "warn" : "neutral"}
                strong
              />
              <p className="text-[11px] text-muted-foreground/80 mt-3 leading-snug">
                Based on appointments in this system only. Visits made before the salon moved over may make some customers look new.
              </p>
            </div>
          </div>
        )}
      </Panel>
    </Section>
  );
}
