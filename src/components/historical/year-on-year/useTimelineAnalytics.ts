import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

interface RawRow {
  created_year: number | null;
  created_month: number | null;
  booking_status: string | null;
  price_charged: number | null;
  customer_email: string | null;
  service_name: string | null;
  groomer_name: string | null;
  appointment_date: string | null;
}

export interface TimelineEntry {
  label: string;
  year: number;
  month: number;
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
  bestMonthEver: { month: string; year: number; revenue: number } | null;
  bestMonthThisYear: { month: string; year: number; revenue: number } | null;
  mostLoyalCustomer: { name: string; bookings: number; spend: number } | null;
  topGroomer: { name: string; revenue: number } | null;
  busiestDay: string | null;
  vsLastYear: { revenueChange: number; bookingsChange: number } | null;
}

export interface AnnualSummary {
  year: number;
  revenue: number;
  bookings: number;
  growthPct: number | null;
  isCurrentYear: boolean;
}

export interface KpiSummary {
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  returningCustomers: number;
  avgMonthlyRevenue: number;
}

export interface GroomerMonthEntry {
  label: string;
  year: number;
  month: number;
  totalRevenue: number;
  commission: number;
  netProfit: number;
  appointments: number;
  returningCustomers: number;
}

export interface GroomerPerformanceData {
  name: string;
  commissionRate: number;
  months: GroomerMonthEntry[];
  allTimeNetProfit: number;
  allTimeAppointments: number;
}

const EXCLUDED_GROOMERS = ["Kirsty Nails", "Lauren Nails"];

export function useTimelineAnalytics() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { data: dbData, isLoading } = useQuery({
    queryKey: ["wix-timeline-full"],
    queryFn: async () => {
      const allData: RawRow[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("wix_historical_bookings")
          .select("created_year, created_month, booking_status, price_charged, customer_email, service_name, groomer_name, appointment_date")
          .range(from, from + PAGE - 1) as { data: RawRow[] | null; error: any };
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return allData;
    },
  });

  // Build monthly timeline
  const timeline = useMemo((): TimelineEntry[] => {
    if (!dbData || dbData.length === 0) return [];

    // Group rows by year-month
    const monthMap = new Map<string, RawRow[]>();
    dbData.forEach(row => {
      if (!row.created_year || !row.created_month) return;
      const key = `${row.created_year}-${String(row.created_month).padStart(2, "0")}`;
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(row);
    });

    const sortedKeys = [...monthMap.keys()].sort();
    const seenEmails = new Set<string>();
    const entries: TimelineEntry[] = [];

    for (const key of sortedKeys) {
      const rows = monthMap.get(key)!;
      const [yearStr, monthStr] = key.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      const totalBookings = rows.length;
      const confirmed = rows.filter(r => r.booking_status === "Confirmed");
      const confirmedRevenue = confirmed.reduce((s, r) => s + (Number(r.price_charged) || 0), 0);
      const cancellations = rows.filter(r => (r.booking_status || "").toLowerCase().includes("cancel")).length;
      const cancellationRate = totalBookings > 0 ? Math.round((cancellations / totalBookings) * 100) : 0;

      const monthEmails = new Set<string>();
      confirmed.forEach(r => {
        if (r.customer_email) monthEmails.add(r.customer_email.toLowerCase());
      });

      const uniqueCustomers = monthEmails.size;
      let returningCustomers = 0;
      monthEmails.forEach(e => { if (seenEmails.has(e)) returningCustomers++; });
      const newCustomers = uniqueCustomers - returningCustomers;

      // Add this month's emails to running set AFTER counting
      monthEmails.forEach(e => seenEmails.add(e));

      entries.push({
        label: `${MONTH_NAMES_SHORT[month - 1]} ${yearStr.slice(2)}`,
        year, month, totalBookings, confirmedRevenue, cancellations,
        cancellationRate, uniqueCustomers, returningCustomers, newCustomers,
      });
    }

    // Compute 3-month rolling average
    for (let i = 0; i < entries.length; i++) {
      const start = Math.max(0, i - 2);
      const window = entries.slice(start, i + 1);
      entries[i].rollingAvg = Math.round(window.reduce((s, e) => s + e.confirmedRevenue, 0) / window.length);
    }

    return entries;
  }, [dbData]);

  // KPI summary
  const kpi = useMemo((): KpiSummary => {
    if (!timeline.length) return { totalBookings: 0, totalRevenue: 0, totalCustomers: 0, returningCustomers: 0, avgMonthlyRevenue: 0 };
    const totalBookings = timeline.reduce((s, e) => s + e.totalBookings, 0);
    const totalRevenue = Math.round(timeline.reduce((s, e) => s + e.confirmedRevenue, 0));
    const allEmails = new Set<string>();
    // Track which months each email appears in
    const emailMonths = new Map<string, Set<string>>();
    dbData?.forEach(r => {
      if (r.booking_status === "Confirmed" && r.customer_email) {
        const email = r.customer_email.toLowerCase();
        allEmails.add(email);
        if (r.created_year && r.created_month) {
          if (!emailMonths.has(email)) emailMonths.set(email, new Set());
          emailMonths.get(email)!.add(`${r.created_year}-${r.created_month}`);
        }
      }
    });
    const totalCustomers = allEmails.size;
    let returningCustomers = 0;
    emailMonths.forEach(months => { if (months.size > 1) returningCustomers++; });
    const avgMonthlyRevenue = Math.round(totalRevenue / timeline.length);
    return { totalBookings, totalRevenue, totalCustomers, returningCustomers, avgMonthlyRevenue };
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

  // Highlights
  const highlights = useMemo((): Highlights => {
    const empty: Highlights = {
      bestMonthEver: null, bestMonthThisYear: null,
      mostLoyalCustomer: null, topGroomer: null,
      busiestDay: null, vsLastYear: null,
    };
    if (!dbData || dbData.length === 0) return empty;

    // Best month ever / this year
    let bestEver: Highlights["bestMonthEver"] = null;
    let bestThisYear: Highlights["bestMonthThisYear"] = null;
    timeline.forEach(e => {
      if (!bestEver || e.confirmedRevenue > bestEver.revenue)
        bestEver = { month: MONTH_NAMES[e.month - 1], year: e.year, revenue: Math.round(e.confirmedRevenue) };
      if (e.year === currentYear && (!bestThisYear || e.confirmedRevenue > bestThisYear.revenue))
        bestThisYear = { month: MONTH_NAMES[e.month - 1], year: e.year, revenue: Math.round(e.confirmedRevenue) };
    });

    // Most loyal customer
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

    // Top groomer
    let topGroomerH: Highlights["topGroomer"] = null;
    groomers.forEach(g => {
      if (!topGroomerH || g.revenue > topGroomerH.revenue) topGroomerH = { name: g.name, revenue: g.revenue };
    });

    // Busiest day
    const dayCounts = new Map<number, number>();
    dbData.forEach(row => {
      if (!row.appointment_date) return;
      const d = new Date(row.appointment_date);
      if (!isNaN(d.getTime())) dayCounts.set(d.getDay(), (dayCounts.get(d.getDay()) || 0) + 1);
    });
    let busiestDay: string | null = null;
    let maxDayCount = 0;
    dayCounts.forEach((count, day) => {
      if (count > maxDayCount) { maxDayCount = count; busiestDay = DAY_NAMES[day]; }
    });

    // vs last year (current month)
    const thisMonthEntry = timeline.find(e => e.year === currentYear && e.month === currentMonth);
    const lastYearEntry = timeline.find(e => e.year === currentYear - 1 && e.month === currentMonth);
    let vsLastYear: Highlights["vsLastYear"] = null;
    if (thisMonthEntry && lastYearEntry) {
      const revenueChange = lastYearEntry.confirmedRevenue > 0
        ? Math.round(((thisMonthEntry.confirmedRevenue - lastYearEntry.confirmedRevenue) / lastYearEntry.confirmedRevenue) * 100) : 0;
      const bookingsChange = lastYearEntry.totalBookings > 0
        ? Math.round(((thisMonthEntry.totalBookings - lastYearEntry.totalBookings) / lastYearEntry.totalBookings) * 100) : 0;
      vsLastYear = { revenueChange, bookingsChange };
    }

    return { bestMonthEver: bestEver, bestMonthThisYear: bestThisYear, mostLoyalCustomer: mostLoyal, topGroomer: topGroomerH, busiestDay, vsLastYear };
  }, [dbData, timeline, groomers, currentYear, currentMonth]);

  // Annual summary
  const annualSummary = useMemo((): AnnualSummary[] => {
    if (!dbData?.length) return [];
    const yearMap = new Map<number, { revenue: number; bookings: number }>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.created_year) return;
      if (!yearMap.has(row.created_year)) yearMap.set(row.created_year, { revenue: 0, bookings: 0 });
      const y = yearMap.get(row.created_year)!;
      y.revenue += Number(row.price_charged) || 0;
      y.bookings += 1;
    });
    const years = [...yearMap.keys()].sort((a, b) => a - b);
    return years.map((year, i) => {
      const d = yearMap.get(year)!;
      const prev = i > 0 ? yearMap.get(years[i - 1])! : null;
      const growthPct = prev && prev.revenue > 0
        ? Math.round(((d.revenue - prev.revenue) / prev.revenue) * 100)
        : null;
      return { year, revenue: Math.round(d.revenue), bookings: d.bookings, growthPct, isCurrentYear: year === currentYear };
    });
  }, [dbData, currentYear]);

  // Groomer performance over time
  const groomerPerformance = useMemo((): GroomerPerformanceData[] => {
    if (!dbData || dbData.length === 0) return [];

    // Default commission rate for historical Wix groomers: 40% (standard rate)
    const DEFAULT_COMMISSION_RATE = 0.4;

    // Group confirmed rows by groomer -> year-month
    const groomerMap = new Map<string, Map<string, RawRow[]>>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.groomer_name || !row.created_year || !row.created_month) return;
      if (EXCLUDED_GROOMERS.includes(row.groomer_name)) return;
      if (!groomerMap.has(row.groomer_name)) groomerMap.set(row.groomer_name, new Map());
      const monthKey = `${row.created_year}-${String(row.created_month).padStart(2, "0")}`;
      const gMonths = groomerMap.get(row.groomer_name)!;
      if (!gMonths.has(monthKey)) gMonths.set(monthKey, []);
      gMonths.get(monthKey)!.push(row);
    });

    const results: GroomerPerformanceData[] = [];

    groomerMap.forEach((monthsMap, groomerName) => {
      // Only include groomers with at least 1 month of data
      if (monthsMap.size < 1) return;

      const rate = DEFAULT_COMMISSION_RATE;
      const sortedKeys = [...monthsMap.keys()].sort();
      const seenEmails = new Set<string>();
      const months: GroomerMonthEntry[] = [];

      for (const key of sortedKeys) {
        const rows = monthsMap.get(key)!;
        const [yearStr, monthStr] = key.split("-");
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const totalRevenue = rows.reduce((s, r) => s + (Number(r.price_charged) || 0), 0);
        const commission = totalRevenue * rate;
        const netProfit = totalRevenue - commission;
        const appointments = rows.length;

        const monthEmails = new Set<string>();
        rows.forEach(r => { if (r.customer_email) monthEmails.add(r.customer_email.toLowerCase()); });
        let returningCustomers = 0;
        monthEmails.forEach(e => { if (seenEmails.has(e)) returningCustomers++; });
        monthEmails.forEach(e => seenEmails.add(e));

        months.push({
          label: `${MONTH_NAMES_SHORT[month - 1]} ${yearStr.slice(2)}`,
          year, month,
          totalRevenue: Math.round(totalRevenue),
          commission: Math.round(commission),
          netProfit: Math.round(netProfit),
          appointments,
          returningCustomers,
        });
      }

      const allTimeNetProfit = months.reduce((s, m) => s + m.netProfit, 0);
      const allTimeAppointments = months.reduce((s, m) => s + m.appointments, 0);

      results.push({ name: groomerName, commissionRate: rate, months, allTimeNetProfit, allTimeAppointments });
    });

    return results.sort((a, b) => b.allTimeNetProfit - a.allTimeNetProfit);
  }, [dbData]);

  return { isLoading, isEmpty: !dbData?.length, timeline, kpi, bestMonthIdx, services, groomers, highlights, annualSummary, groomerPerformance };
}
