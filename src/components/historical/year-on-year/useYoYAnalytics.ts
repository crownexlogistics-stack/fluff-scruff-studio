import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export const YEAR_COLORS: Record<number, string> = {
  2024: "#FFB800",
  2025: "#FF6B35",
  2026: "#2D1B0E",
};

export interface YearMetrics {
  year: number;
  totalBookings: number;
  confirmedRevenue: number;
  cancellations: number;
  cancellationRate: number;
  uniqueCustomers: number;
  returningCustomers: number;
  newCustomers: number;
  retentionRate: number;
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

interface RawRow {
  created_year: number | null;
  created_month: number | null;
  booking_status: string | null;
  payment_status: string | null;
  price_charged: number | null;
  customer_email: string | null;
  customer_name: string | null;
  service_name: string | null;
  groomer_name: string | null;
  appointment_date: string | null;
}

export function useYoYAnalytics(selectedMonth: number, activeYears: Set<number>) {
  const currentYear = new Date().getFullYear();

  const { data: dbData, isLoading } = useQuery({
    queryKey: ["wix-analytics-full"],
    queryFn: async () => {
      const allData: RawRow[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("wix_historical_bookings")
          .select("created_year, created_month, booking_status, payment_status, price_charged, customer_email, customer_name, service_name, groomer_name, appointment_date")
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

  // Per-year metrics for the selected month
  const metrics = useMemo((): YearMetrics[] => {
    if (!dbData) return [];

    // Build confirmed customers per month key for returning calculation
    const confirmedByMonth = new Map<string, Set<string>>();
    dbData.forEach(row => {
      if (!row.created_year || !row.created_month || row.booking_status !== "Confirmed" || !row.customer_email) return;
      const key = `${row.created_year}-${String(row.created_month).padStart(2, "0")}`;
      if (!confirmedByMonth.has(key)) confirmedByMonth.set(key, new Set());
      confirmedByMonth.get(key)!.add(row.customer_email.toLowerCase());
    });

    // Build cumulative "seen before" for returning customer calc
    const sortedKeys = [...confirmedByMonth.keys()].sort();
    const seenBefore = new Map<string, Set<string>>();
    const cumulative = new Set<string>();
    for (const key of sortedKeys) {
      seenBefore.set(key, new Set(cumulative));
      confirmedByMonth.get(key)!.forEach(e => cumulative.add(e));
    }

    const results: YearMetrics[] = [];
    for (const year of Array.from(activeYears).sort()) {
      const monthRows = dbData.filter(r => r.created_year === year && r.created_month === selectedMonth);
      if (monthRows.length === 0) continue;

      const totalBookings = monthRows.length;
      const confirmed = monthRows.filter(r => r.booking_status === "Confirmed");
      const confirmedRevenue = confirmed.reduce((sum, r) => sum + (Number(r.price_charged) || 0), 0);
      const cancellations = monthRows.filter(r => (r.booking_status || "").toLowerCase().includes("cancel")).length;
      const cancellationRate = totalBookings > 0 ? Math.round((cancellations / totalBookings) * 100) : 0;

      const key = `${year}-${String(selectedMonth).padStart(2, "0")}`;
      const monthCustomers = confirmedByMonth.get(key) || new Set<string>();
      const uniqueCustomers = monthCustomers.size;
      const priorSet = seenBefore.get(key) || new Set<string>();
      const returningCustomers = [...monthCustomers].filter(e => priorSet.has(e)).length;
      const newCustomers = uniqueCustomers - returningCustomers;
      const retentionRate = uniqueCustomers > 0 ? Math.round((returningCustomers / uniqueCustomers) * 100) : 0;

      results.push({
        year, totalBookings, confirmedRevenue, cancellations, cancellationRate,
        uniqueCustomers, returningCustomers, newCustomers, retentionRate,
      });
    }
    return results;
  }, [dbData, selectedMonth, activeYears]);

  // Service demand
  const services = useMemo((): ServiceCount[] => {
    if (!dbData) return [];
    const counts = new Map<string, number>();
    dbData.forEach(row => {
      if (!row.created_month || !row.created_year) return;
      if (row.created_month !== selectedMonth || !activeYears.has(row.created_year)) return;
      if (row.booking_status !== "Confirmed" || !row.service_name) return;
      counts.set(row.service_name, (counts.get(row.service_name) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [dbData, selectedMonth, activeYears]);

  // Groomer revenue
  const groomers = useMemo((): GroomerRevenue[] => {
    if (!dbData) return [];
    const rev = new Map<string, number>();
    dbData.forEach(row => {
      if (!row.created_month || !row.created_year) return;
      if (row.created_month !== selectedMonth || !activeYears.has(row.created_year)) return;
      if (row.booking_status !== "Confirmed" || !row.groomer_name) return;
      rev.set(row.groomer_name, (rev.get(row.groomer_name) || 0) + (Number(row.price_charged) || 0));
    });
    return [...rev.entries()]
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [dbData, selectedMonth, activeYears]);

  // Highlights
  const highlights = useMemo((): Highlights => {
    const empty: Highlights = {
      bestMonthEver: null, bestMonthThisYear: null,
      mostLoyalCustomer: null, topGroomer: null,
      busiestDay: null, vsLastYear: null,
    };
    if (!dbData || dbData.length === 0) return empty;

    // Revenue per month across all data
    const monthRevMap = new Map<string, { month: number; year: number; revenue: number }>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.created_year || !row.created_month) return;
      const key = `${row.created_year}-${row.created_month}`;
      if (!monthRevMap.has(key)) monthRevMap.set(key, { month: row.created_month, year: row.created_year, revenue: 0 });
      monthRevMap.get(key)!.revenue += Number(row.price_charged) || 0;
    });

    let bestEver: Highlights["bestMonthEver"] = null;
    let bestThisYear: Highlights["bestMonthThisYear"] = null;
    monthRevMap.forEach(v => {
      if (!bestEver || v.revenue > bestEver.revenue)
        bestEver = { month: MONTH_NAMES[v.month - 1], year: v.year, revenue: Math.round(v.revenue) };
      if (v.year === currentYear && (!bestThisYear || v.revenue > bestThisYear.revenue))
        bestThisYear = { month: MONTH_NAMES[v.month - 1], year: v.year, revenue: Math.round(v.revenue) };
    });

    // Most loyal customer
    const custStats = new Map<string, { name: string; bookings: number; spend: number }>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.customer_email) return;
      const email = row.customer_email.toLowerCase();
      if (!custStats.has(email)) custStats.set(email, { name: row.customer_name || email, bookings: 0, spend: 0 });
      const s = custStats.get(email)!;
      s.bookings += 1;
      s.spend += Number(row.price_charged) || 0;
      if (row.customer_name && s.name === email) s.name = row.customer_name;
    });
    let mostLoyal: Highlights["mostLoyalCustomer"] = null;
    custStats.forEach(v => {
      if (!mostLoyal || v.bookings > mostLoyal.bookings)
        mostLoyal = { name: v.name, bookings: v.bookings, spend: Math.round(v.spend) };
    });

    // Top groomer all time
    const groomerTotals = new Map<string, number>();
    dbData.forEach(row => {
      if (row.booking_status !== "Confirmed" || !row.groomer_name) return;
      groomerTotals.set(row.groomer_name, (groomerTotals.get(row.groomer_name) || 0) + (Number(row.price_charged) || 0));
    });
    let topGroomerH: Highlights["topGroomer"] = null;
    groomerTotals.forEach((rev, name) => {
      if (!topGroomerH || rev > topGroomerH.revenue) topGroomerH = { name, revenue: Math.round(rev) };
    });

    // Busiest day of week for selected month + active years
    const dayCounts = new Map<number, number>();
    dbData.forEach(row => {
      if (!row.created_month || !row.created_year || !row.appointment_date) return;
      if (row.created_month !== selectedMonth || !activeYears.has(row.created_year)) return;
      const d = new Date(row.appointment_date);
      if (!isNaN(d.getTime())) dayCounts.set(d.getDay(), (dayCounts.get(d.getDay()) || 0) + 1);
    });
    let busiestDay: string | null = null;
    let maxDayCount = 0;
    dayCounts.forEach((count, day) => {
      if (count > maxDayCount) { maxDayCount = count; busiestDay = DAY_NAMES[day]; }
    });

    // vs Last Year
    const thisYearRev = monthRevMap.get(`${currentYear}-${selectedMonth}`);
    const lastYearRev = monthRevMap.get(`${currentYear - 1}-${selectedMonth}`);
    const monthBookingCounts = new Map<string, number>();
    dbData.forEach(row => {
      if (!row.created_year || !row.created_month) return;
      const key = `${row.created_year}-${row.created_month}`;
      monthBookingCounts.set(key, (monthBookingCounts.get(key) || 0) + 1);
    });

    let vsLastYear: Highlights["vsLastYear"] = null;
    if (thisYearRev && lastYearRev) {
      const revenueChange = lastYearRev.revenue > 0
        ? Math.round(((thisYearRev.revenue - lastYearRev.revenue) / lastYearRev.revenue) * 100) : 0;
      const thisB = monthBookingCounts.get(`${currentYear}-${selectedMonth}`) || 0;
      const lastB = monthBookingCounts.get(`${currentYear - 1}-${selectedMonth}`) || 0;
      const bookingsChange = lastB > 0 ? Math.round(((thisB - lastB) / lastB) * 100) : 0;
      vsLastYear = { revenueChange, bookingsChange };
    }

    return {
      bestMonthEver: bestEver, bestMonthThisYear: bestThisYear,
      mostLoyalCustomer: mostLoyal, topGroomer: topGroomerH,
      busiestDay, vsLastYear,
    };
  }, [dbData, selectedMonth, activeYears, currentYear]);

  return { isLoading, isEmpty: !dbData?.length, metrics, services, groomers, highlights };
}
