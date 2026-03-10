import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { WIX_MONTHLY_DATA, MONTH_NAMES } from "./wixData";

const YEAR_COLORS: Record<number, string> = {
  2024: "#FFB800",
  2025: "#FF6B35",
  2026: "#2D1B0E",
};

export default function YearOnYearTab() {
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [activeYears, setActiveYears] = useState<Set<number>>(new Set([2024, 2025, 2026]));
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [chartMetric, setChartMetric] = useState<"revenue" | "bookings">("revenue");

  const month = parseInt(selectedMonth);

  const toggleYear = (y: number) => {
    setActiveYears(prev => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y); else next.add(y);
      return next;
    });
  };

  const monthData = useMemo(() => {
    return WIX_MONTHLY_DATA.filter(d => d.month === month && activeYears.has(d.year));
  }, [month, activeYears]);

  const kpis = useMemo(() => {
    return monthData.map(d => ({
      year: d.year,
      bookings: d.bookings,
      revenue: d.revenue,
      cancellationRate: d.bookings > 0 ? Math.round((d.cancelled / d.bookings) * 100) : 0,
      customers: d.customers,
    }));
  }, [monthData]);

  const chartData = useMemo(() => {
    return monthData.map(d => ({
      year: d.year.toString(),
      revenue: d.revenue,
      bookings: d.bookings,
    }));
  }, [monthData]);

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

  const isPartialMonth = (year: number) => year === 2026 && month === new Date().getMonth() + 1;

  const YearPill = ({ year, value, prefix = "" }: { year: number; value: number | string; prefix?: string }) => (
    <Badge
      className="text-xs font-bold px-2.5 py-1"
      style={{
        backgroundColor: YEAR_COLORS[year],
        color: year === 2026 ? "#fff" : "#2D1B0E",
      }}
    >
      {year}: {prefix}{typeof value === "number" ? value.toLocaleString() : value}
      {isPartialMonth(year) && <span className="ml-1 text-[10px] opacity-80">⚠️</span>}
    </Badge>
  );

  const ChartComponent = chartType === "bar" ? BarChart : LineChart;

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
          {[2024, 2025, 2026].map(y => (
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
      {activeYears.has(2026) && month >= new Date().getMonth() + 1 && (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
          ⚠️ 2026 data for {MONTH_NAMES[month - 1]} is a partial month
        </Badge>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", key: "bookings" as const, prefix: "" },
          { label: "Confirmed Revenue", key: "revenue" as const, prefix: "£" },
          { label: "Cancellation Rate", key: "cancellationRate" as const, prefix: "", suffix: "%" },
          { label: "Unique Customers", key: "customers" as const, prefix: "" },
        ].map(metric => (
          <Card key={metric.label} className="rounded-[20px] border-none shadow-sm" style={{ backgroundColor: "#fff" }}>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8B6F5C" }}>{metric.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {kpis.length === 0 && <span className="text-sm text-muted-foreground">No data</span>}
                {kpis.map(k => (
                  <YearPill
                    key={k.year}
                    year={k.year}
                    value={`${metric.prefix}${k[metric.key].toLocaleString()}${"suffix" in metric ? metric.suffix : ""}`}
                  />
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
            <Button
              size="sm"
              variant={chartMetric === "revenue" ? "default" : "outline"}
              className="rounded-[30px] text-xs"
              style={chartMetric === "revenue" ? { backgroundColor: "#FF6B35" } : {}}
              onClick={() => setChartMetric("revenue")}
            >
              Revenue (£)
            </Button>
            <Button
              size="sm"
              variant={chartMetric === "bookings" ? "default" : "outline"}
              className="rounded-[30px] text-xs"
              style={chartMetric === "bookings" ? { backgroundColor: "#FF6B35" } : {}}
              onClick={() => setChartMetric("bookings")}
            >
              Bookings
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-[30px] text-xs gap-1"
            onClick={() => setChartType(t => t === "bar" ? "line" : "bar")}
          >
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
              <Bar dataKey={chartMetric} radius={[8, 8, 0, 0]}>
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
            <p className="text-sm font-medium" style={{ color: "#2D1B0E" }}>
              💡 {insight}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
