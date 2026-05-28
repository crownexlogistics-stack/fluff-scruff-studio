import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const WIX_COMMISSION_RATE = 0.4;

// --- date helpers (week = Mon..Sun) ---
function pad(n: number) { return String(n).padStart(2, "0"); }
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function weekLabel(monday: Date) {
  return `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]}`;
}

/**
 * Resolve a representative Date for a row.
 *  - prefer appointment_date (real-world day of the appointment)
 *  - else fall back to the 15th of created_year/created_month (Wix legacy)
 */
function rowDate(row: RawRow): Date | null {
  if (row.appointment_date) {
    const d = new Date(row.appointment_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (row.created_year && row.created_month) {
    return new Date(row.created_year, row.created_month - 1, 15);
  }
  return null;
}

interface RawRow {
  created_year: number | null;
  created_month: number | null;
  booking_status: string | null;
  price_charged: number | null;
  customer_email: string | null;
  service_name: string | null;
  groomer_name: string | null;
  appointment_date: string | null;
  /** per-row commission rate (live bookings only); Wix rows fall back to WIX_COMMISSION_RATE */
  commission_rate: number | null;
  /** "wix" | "live" — used only for diagnostics */
  _source: "wix" | "live";
}

export interface TimelineEntry {
  weekStart: string; // ISO Monday yyyy-mm-dd
  label: string;
  totalBookings: number;
  confirmedRevenue: number;
  cancellations: number;
  cancellationRate: number;
  uniqueCustomers: number;
  returningCustomers: number;
  newCustomers: number;
  rollingAvg?: number;
}

export interface ServiceCount {
  name: string;
  count: number;
}

export interface GroomerRevenue {
  name: string;
  revenue: number;
}

export interface Highlights {
  bestWeekEver: { weekStart: string; label: string; revenue: number } | null;
  bestWeekRecent: { weekStart: string; label: string; revenue: number } | null;
  mostLoyalCustomer: { name: string; bookings: number; spend: number } | null;
  topGroomer: { name: string; revenue: number } | null;
  busiestDay: string | null;
  vsLastWeek: { revenueChange: number; bookingsChange: number } | null;
}

export interface KpiSummary {
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  returningCustomers: number;
  avgWeeklyRevenue: number;
  weekRangeLabel: string;
}

export interface GroomerWeekEntry {
  weekStart: string;
  label: string;
  totalRevenue: number;
  commission: number;
  netProfit: number;
  appointments: number;
  returningCustomers: number;
}

export interface GroomerPerformanceData {
  name: string;
  weeks: GroomerWeekEntry[];
  allTimeNetProfit: number;
  allTimeAppointments: number;
}

export function useTimelineAnalytics() {
  const { data: dbData, isLoading } = useQuery({
    queryKey: ["timeline-weekly-v1"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const allData: RawRow[] = [];
      const PAGE = 1000;

      // --- Source A: Wix historical CSV import ---
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("wix_historical_bookings")
          .select("created_year, created_month, booking_status, price_charged, customer_email, service_name, groomer_name, appointment_date")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data as any[]) {
          allData.push({
            created_year: r.created_year,
            created_month: r.created_month,
            booking_status: r.booking_status,
            price_charged: r.price_charged,
            customer_email: r.customer_email,
            service_name: r.service_name,
            groomer_name: r.groomer_name,
            appointment_date: r.appointment_date,
            commission_rate: null,
            _source: "wix",
          });
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // --- Source B: live bookings ---
      from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("bookings")
          .select("booking_date, status, total_price, final_charge, customer_email, staff:staff_id(name, commission_rate), service:service_id(name)")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data as any[]) {
          const d = r.booking_date ? new Date(r.booking_date) : null;
          if (!d || isNaN(d.getTime())) continue;
          const rawStatus = (r.status || "").toLowerCase();
          let mapped: string;
          if (rawStatus.includes("cancel")) mapped = r.status;
          else if (rawStatus === "completed" || rawStatus === "confirmed") mapped = "Confirmed";
          else mapped = r.status; // Pending, No Show, etc. — counts toward totalBookings only
          allData.push({
            created_year: d.getFullYear(),
            created_month: d.getMonth() + 1,
            booking_status: mapped,
            price_charged: r.final_charge ?? r.total_price ?? 0,
            customer_email: r.customer_email,
            service_name: r.service?.name ?? null,
            groomer_name: r.staff?.name ?? null,
            appointment_date: r.booking_date,
            commission_rate: typeof r.staff?.commission_rate === "number" ? r.staff.commission_rate : null,
            _source: "live",
          });
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }

      return allData;
    },
  });

  // Build WEEKLY timeline (Mon..Sun buckets)
  const timeline = useMemo((): TimelineEntry[] => {
    if (!dbData || dbData.length === 0) return [];

    const weekMap = new Map<string, RawRow[]>();
    dbData.forEach(row => {
      const d = rowDate(row);
      if (!d) return;
      const monday = getMonday(d);
      const key = toIsoDate(monday);
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(row);
    });

    const sortedKeys = [...weekMap.keys()].sort();
    const seenEmails = new Set<string>();
    const entries: TimelineEntry[] = [];

    for (const key of sortedKeys) {
      const rows = weekMap.get(key)!;
      const monday = new Date(key);

      const totalBookings = rows.length;
      const confirmed = rows.filter(r => r.booking_status === "Confirmed");
      const confirmedRevenue = confirmed.reduce((s, r) => s + (Number(r.price_charged) || 0), 0);
      const cancellations = rows.filter(r => (r.booking_status || "").toLowerCase().includes("cancel")).length;
      const cancellationRate = totalBookings > 0 ? Math.round((cancellations / totalBookings) * 100) : 0;

      const weekEmails = new Set<string>();
      confirmed.forEach(r => { if (r.customer_email) weekEmails.add(r.customer_email.toLowerCase()); });

      const uniqueCustomers = weekEmails.size;
      let returningCustomers = 0;
      weekEmails.forEach(e => { if (seenEmails.has(e)) returningCustomers++; });
      const newCustomers = uniqueCustomers - returningCustomers;
      weekEmails.forEach(e => seenEmails.add(e));

      entries.push({
        weekStart: key,
        label: weekLabel(monday),
        totalBookings,
        confirmedRevenue,
        cancellations,
        cancellationRate,
        uniqueCustomers,
        returningCustomers,
        newCustomers,
      });
    }

    // 4-week rolling average
    for (let i = 0; i < entries.length; i++) {
      const start = Math.max(0, i - 3);
      const window = entries.slice(start, i + 1);
      entries[i].rollingAvg = Math.round(window.reduce((s, e) => s + e.confirmedRevenue, 0) / window.length);
    }

    return entries;
  }, [dbData]);

  // KPI summary (weekly)
  const kpi = useMemo((): KpiSummary => {
    if (!timeline.length) {
      return { totalBookings: 0, totalRevenue: 0, totalCustomers: 0, returningCustomers: 0, avgWeeklyRevenue: 0, weekRangeLabel: "" };
    }
    const totalBookings = timeline.reduce((s, e) => s + e.totalBookings, 0);
    const totalRevenue = Math.round(timeline.reduce((s, e) => s + e.confirmedRevenue, 0));
    const allEmails = new Set<string>();
    const emailWeeks = new Map<string, Set<string>>();
    dbData?.forEach(r => {
      if (r.booking_status === "Confirmed" && r.customer_email) {
        const email = r.customer_email.toLowerCase();
        const d = rowDate(r);
        if (!d) return;
        const wk = toIsoDate(getMonday(d));
        allEmails.add(email);
        if (!emailWeeks.has(email)) emailWeeks.set(email, new Set());
        emailWeeks.get(email)!.add(wk);
      }
    });
    const totalCustomers = allEmails.size;
    let returningCustomers = 0;
    emailWeeks.forEach(weeks => { if (weeks.size > 1) returningCustomers++; });
    const avgWeeklyRevenue = Math.round(totalRevenue / timeline.length);
    const first = new Date(timeline[0].weekStart);
    const last = new Date(timeline[timeline.length - 1].weekStart);
    const weekRangeLabel = `Wk of ${weekLabel(first)} ${first.getFullYear()} → Wk of ${weekLabel(last)} ${last.getFullYear()} · always live`;
    return { totalBookings, totalRevenue, totalCustomers, returningCustomers, avgWeeklyRevenue, weekRangeLabel };
  }, [timeline, dbData]);

  // Best revenue month index
  const bestMonthIdx = useMemo(() => {
    if (!timeline.length) return -1;
    let best = 0;
    timeline.forEach((e, i) => { if (e.confirmedRevenue > timeline[best].confirmedRevenue) best = i; });
    return best;
  }, [timeline]);

  // Top services all time
  const services = useMemo((): ServiceCount[] => {
    if (!dbData) return [];
    const counts = new Map<string, number>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.service_name) return;
      counts.set(row.service_name, (counts.get(row.service_name) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [dbData]);

  // Groomer revenue all time
  const groomers = useMemo((): GroomerRevenue[] => {
    if (!dbData) return [];
    const rev = new Map<string, number>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.groomer_name) return;
      rev.set(row.groomer_name, (rev.get(row.groomer_name) || 0) + (Number(row.price_charged) || 0));
    });
    return [...rev.entries()]
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [dbData]);

  // Highlights (weekly)
  const highlights = useMemo((): Highlights => {
    const empty: Highlights = {
      bestWeekEver: null, bestWeekRecent: null,
      mostLoyalCustomer: null, topGroomer: null,
      busiestDay: null, vsLastWeek: null,
    };
    if (!dbData || dbData.length === 0 || !timeline.length) return empty;

    // Best week ever
    let bestEver: Highlights["bestWeekEver"] = null;
    timeline.forEach(e => {
      if (!bestEver || e.confirmedRevenue > bestEver.revenue)
        bestEver = { weekStart: e.weekStart, label: e.label, revenue: Math.round(e.confirmedRevenue) };
    });

    // Best week in last 12 weeks
    const recent = timeline.slice(-12);
    let bestRecent: Highlights["bestWeekRecent"] = null;
    recent.forEach(e => {
      if (!bestRecent || e.confirmedRevenue > bestRecent.revenue)
        bestRecent = { weekStart: e.weekStart, label: e.label, revenue: Math.round(e.confirmedRevenue) };
    });

    // Most loyal customer (all time)
    const custStats = new Map<string, { name: string; bookings: number; spend: number }>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.customer_email) return;
      const email = row.customer_email.toLowerCase();
      if (!custStats.has(email)) custStats.set(email, { name: email, bookings: 0, spend: 0 });
      const s = custStats.get(email)!;
      s.bookings += 1;
      s.spend += Number(row.price_charged) || 0;
    });
    let mostLoyal: Highlights["mostLoyalCustomer"] = null;
    custStats.forEach(v => {
      if (!mostLoyal || v.bookings > mostLoyal.bookings)
        mostLoyal = { name: v.name, bookings: v.bookings, spend: Math.round(v.spend) };
    });

    // Top groomer (all time)
    let topGroomerH: Highlights["topGroomer"] = null;
    groomers.forEach(g => {
      if (!topGroomerH || g.revenue > topGroomerH.revenue) topGroomerH = { name: g.name, revenue: g.revenue };
    });

    // Busiest day-of-week (using appointment_date when available)
    const dayCounts = new Map<number, number>();
    dbData.forEach(row => {
      const d = rowDate(row);
      if (!d) return;
      dayCounts.set(d.getDay(), (dayCounts.get(d.getDay()) || 0) + 1);
    });
    let busiestDay: string | null = null;
    let maxDayCount = 0;
    dayCounts.forEach((count, day) => {
      if (count > maxDayCount) { maxDayCount = count; busiestDay = DAY_NAMES[day]; }
    });

    // vs last week (latest finished week vs the one before)
    let vsLastWeek: Highlights["vsLastWeek"] = null;
    if (timeline.length >= 2) {
      const cur = timeline[timeline.length - 1];
      const prev = timeline[timeline.length - 2];
      const revenueChange = prev.confirmedRevenue > 0
        ? Math.round(((cur.confirmedRevenue - prev.confirmedRevenue) / prev.confirmedRevenue) * 100) : 0;
      const bookingsChange = prev.totalBookings > 0
        ? Math.round(((cur.totalBookings - prev.totalBookings) / prev.totalBookings) * 100) : 0;
      vsLastWeek = { revenueChange, bookingsChange };
    }

    return { bestWeekEver: bestEver, bestWeekRecent: bestRecent, mostLoyalCustomer: mostLoyal, topGroomer: topGroomerH, busiestDay, vsLastWeek };
  }, [dbData, timeline, groomers]);

  // Groomer performance over time (WEEKLY)
  const groomerPerformance = useMemo((): GroomerPerformanceData[] => {
    if (!dbData || dbData.length === 0) return [];

    // Group confirmed rows by groomer -> week
    const groomerMap = new Map<string, Map<string, RawRow[]>>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.groomer_name) return;
      const d = rowDate(row);
      if (!d) return;
      const weekKey = toIsoDate(getMonday(d));
      if (!groomerMap.has(row.groomer_name)) groomerMap.set(row.groomer_name, new Map());
      const gWeeks = groomerMap.get(row.groomer_name)!;
      if (!gWeeks.has(weekKey)) gWeeks.set(weekKey, []);
      gWeeks.get(weekKey)!.push(row);
    });

    const results: GroomerPerformanceData[] = [];

    groomerMap.forEach((weeksMap, groomerName) => {
      if (weeksMap.size < 1) return;

      const sortedKeys = [...weeksMap.keys()].sort();
      const seenEmails = new Set<string>();
      const weeks: GroomerWeekEntry[] = [];

      for (const key of sortedKeys) {
        const rows = weeksMap.get(key)!;
        const monday = new Date(key);

        let totalRevenue = 0;
        let commission = 0;
        rows.forEach(r => {
          const price = Number(r.price_charged) || 0;
          const rate = r._source === "live" && typeof r.commission_rate === "number"
            ? r.commission_rate
            : WIX_COMMISSION_RATE;
          totalRevenue += price;
          commission += price * rate;
        });
        const netProfit = totalRevenue - commission;
        const appointments = rows.length;

        const weekEmails = new Set<string>();
        rows.forEach(r => { if (r.customer_email) weekEmails.add(r.customer_email.toLowerCase()); });
        let returningCustomers = 0;
        weekEmails.forEach(e => { if (seenEmails.has(e)) returningCustomers++; });
        weekEmails.forEach(e => seenEmails.add(e));

        weeks.push({
          weekStart: key,
          label: weekLabel(monday),
          totalRevenue: Math.round(totalRevenue),
          commission: Math.round(commission),
          netProfit: Math.round(netProfit),
          appointments,
          returningCustomers,
        });
      }

      const allTimeNetProfit = weeks.reduce((s, m) => s + m.netProfit, 0);
      const allTimeAppointments = weeks.reduce((s, m) => s + m.appointments, 0);

      results.push({ name: groomerName, weeks, allTimeNetProfit, allTimeAppointments });
    });

    return results.sort((a, b) => b.allTimeNetProfit - a.allTimeNetProfit);
  }, [dbData]);

  return { isLoading, isEmpty: !dbData?.length, timeline, kpi, bestMonthIdx, services, groomers, highlights, groomerPerformance };
}
