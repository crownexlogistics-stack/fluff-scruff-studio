import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const YEAR_COLORS: Record<number, string> = {
  2024: "#FFB800",
  2025: "#FF6B35",
  2026: "#2D1B0E",
};

interface MonthlyData {
  year: number;
  month: number;
  bookings: number;
  revenue: number;
  cancelled: number;
  customers: number;
}

export default function YearOnYearTab() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [activeYears, setActiveYears] = useState<Set<number>>(new Set([2024, 2025, 2026]));
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [chartMetric, setChartMetric] = useState<"revenue" | "bookings">("revenue");

  const month = parseInt(selectedMonth);

  const { data: dbData, isLoading } = useQuery({
    queryKey: ["wix-yoy-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wix_historical_bookings")
        .select("created_year, created_month, booking_status, payment_status, price_charged, customer_email");
      if (error) throw error;
      return data || [];
    },
  });

  const monthlyData = useMemo((): MonthlyData[] => {
    if (!dbData) return [];
    const map = new Map<string, MonthlyData>();

    dbData.forEach((row: any) => {
      const y = row.created_year;
      const m = row.created_month;
      if (!y || !m) return;
      const key = `${y}-${m}`;
      if (!map.has(key)) {
        map.set(key, { year: y, month: m, bookings: 0, revenue: 0, cancelled: 0, customers: 0 });
      }
      const entry = map.get(key)!;
      entry.bookings += 1;
      const isCanceled = (row.booking_status || "").toLowerCase().includes("cancel");
      if (isCanceled) entry.cancelled += 1;
      if (row.booking_status === "Confirmed" && row.price_charged) entry.revenue += Number(row.price_charged) || 0;
    });

    // Count unique customers per month
    const customerSets = new Map<string, Set<string>>();
    dbData.forEach((row: any) => {
      const key = `${row.created_year}-${row.created_month}`;
      if (!customerSets.has(key)) customerSets.set(key, new Set());
      if (row.customer_email) customerSets.get(key)!.add(row.customer_email.toLowerCase());
    });
    customerSets.forEach((emails, key) => {
      const entry = map.get(key);
      if (entry) entry.customers = emails.size;
    });

    return Array.from(map.values());
  }, [dbData]);

  const toggleYear = (y: number) => {
    setActiveYears(prev => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y); else next.add(y);
      return next;
    });
  };

  const filteredData = useMemo(() => {
    return monthlyData.filter(d => d.month === month && activeYears.has(d.year));
  }, [month, activeYears, monthlyData]);

  const kpis = useMemo(() => {
    return filteredData.map(d => ({
      year: d.year,
      bookings: d.bookings,
      revenue: d.revenue,
      cancellationRate: d.bookings > 0 ? Math.round((d.cancelled / d.bookings) * 100) : 0,
      customers: d.customers,
    }));
  }, [filteredData]);

  const chartData = useMemo(() => {
    return filteredData.map(d => ({
      year: d.year.toString(),
      revenue: d.revenue,
      bookings: d.bookings,
    }));
  }, [filteredData]);

  const insight = useMemo(() => {
    if (kpis.length < 2) return null;
    const sorted = [...kpis].sort((a, b) => a.year - b.year);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const bookingChange = first.bookings > 0
      ? Math.round(((last.bookings - first.bookings) / first.bookings) * 100)
      : 0;
    return `${MONTH_NAMES[month - 1]} ${last.year} had ${last.bookings} bookings vs ${first.bookings} in ${MONTH_NAMES[month - 1]} ${first.year} — a ${bookingChange >= 0 ? "+" : ""}${bookingChange}% change. Revenue went from £${first.revenue.toLocaleString()} to £${last.revenue.toLocaleString()}.`;
  }, [kpis, month]);

  const isPartialMonth = (year: number) => year === currentYear && month >= currentMonth;

  const availableYears = useMemo(() => {
    const years = new Set(monthlyData.map(d => d.year));
    return Array.from(years).sort();
  }, [monthlyData]);

  const YearPill = ({ year, value }: { year: number; value: string }) => (
    <Badge
      className="text-xs font-bold px-2.5 py-1"
      style={{
        backgroundColor: YEAR_COLORS[year] || "#FF6B35",
        color: year === 2026 ? "#fff" : "#2D1B0E",
      }}
    >
      {year}: {value}
      {isPartialMonth(year) && <span className="ml-1 text-[10px] opacity-80">⚠️</span>}
    </Badge>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60 rounded-[30px]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-[20px]" />)}
        </div>
        <Skeleton className="h-72 rounded-[20px]" />
      </div>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <Card className="rounded-[20px] border-none shadow-sm">
        <CardContent className="p-8 text-center">
          <p className="text-sm" style={{ color: "#8B6F5C" }}>No historical data yet. Import a Wix CSV from the "Import Data" tab to see year-on-year comparisons.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[160px] rounded-[30px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          {(availableYears.length > 0 ? availableYears : [2024, 2025, 2026]).map(y => (
            <Button
              key={y}
              variant={activeYears.has(y) ? "default" : "outline"}
              size="sm"
              className="rounded-[30px] font-bold"
              style={activeYears.has(y) ? { backgroundColor: "#FF6B35", color: "#fff" } : {}}
              onClick={() => toggleYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>

      {/* Partial month warning */}
      {activeYears.has(currentYear) && month >= currentMonth && (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
          ⚠️ {currentYear} data for {MONTH_NAMES[month - 1]} is a partial month
        </Badge>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", fn: (k: typeof kpis[0]) => k.bookings.toLocaleString() },
          { label: "Confirmed Revenue", fn: (k: typeof kpis[0]) => `£${k.revenue.toLocaleString()}` },
          { label: "Cancellation Rate", fn: (k: typeof kpis[0]) => `${k.cancellationRate}%` },
          { label: "Unique Customers", fn: (k: typeof kpis[0]) => k.customers.toLocaleString() },
        ].map(metric => (
          <Card key={metric.label} className="rounded-[20px] border-none shadow-sm" style={{ backgroundColor: "#fff" }}>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8B6F5C" }}>{metric.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {kpis.length === 0 && <span className="text-sm text-muted-foreground">No data</span>}
                {kpis.map(k => (
                  <YearPill key={k.year} year={k.year} value={metric.fn(k)} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="rounded-[20px] border-none shadow-sm p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant={chartMetric === "revenue" ? "default" : "outline"} className="rounded-[30px] text-xs" style={chartMetric === "revenue" ? { backgroundColor: "#FF6B35" } : {}} onClick={() => setChartMetric("revenue")}>Revenue (£)</Button>
            <Button size="sm" variant={chartMetric === "bookings" ? "default" : "outline"} className="rounded-[30px] text-xs" style={chartMetric === "bookings" ? { backgroundColor: "#FF6B35" } : {}} onClick={() => setChartMetric("bookings")}>Bookings</Button>
          </div>
          <Button size="sm" variant="ghost" className="rounded-[30px] text-xs gap-1" onClick={() => setChartType(t => t === "bar" ? "line" : "bar")}>
            {chartType === "bar" ? <TrendingUp className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
            {chartType === "bar" ? "Line" : "Bar"}
          </Button>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(v: number) => chartMetric === "revenue" ? `£${v.toLocaleString()}` : v} />
              <Bar dataKey={chartMetric} radius={[8, 8, 0, 0]} fill="#FF6B35">
                {chartData.map((entry, i) => (
                  <rect key={i} fill={YEAR_COLORS[parseInt(entry.year)] || "#FF6B35"} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(v: number) => chartMetric === "revenue" ? `£${v.toLocaleString()}` : v} />
              <Line type="monotone" dataKey={chartMetric} stroke="#FF6B35" strokeWidth={3} dot={{ r: 6 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </Card>

      {/* Insight */}
      {insight && (
        <Card className="rounded-[20px] border-none shadow-sm" style={{ backgroundColor: "#FFF5E0" }}>
          <CardContent className="p-4">
            <p className="text-sm font-medium" style={{ color: "#2D1B0E" }}>💡 {insight}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
