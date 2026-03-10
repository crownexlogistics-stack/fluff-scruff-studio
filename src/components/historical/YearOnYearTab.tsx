import { useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend, ComposedChart,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelineAnalytics } from "./year-on-year/useTimelineAnalytics";
import TimelineHighlightsSidebar from "./year-on-year/TimelineHighlightsSidebar";

const xAxisProps = {
  dataKey: "label" as const,
  tick: { fontSize: 10, fill: "#8B6F5C" },
  angle: -45,
  textAnchor: "end" as const,
  height: 60,
  interval: "preserveStartEnd" as const,
};

const gridProps = {
  strokeDasharray: "3 3",
  stroke: "#f0e6da",
  vertical: false as const,
};

export default function YearOnYearTab() {
  const { isLoading, isEmpty, timeline, kpi, bestMonthIdx, services, groomers, highlights, annualSummary } = useTimelineAnalytics();
  const exportRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!exportRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save("year-on-year-analytics.pdf");
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-80 rounded-[30px]" />
        <div className="flex gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-40 rounded-[16px]" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[320px] rounded-[20px]" />)}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <Card className="rounded-[20px] border-none shadow-sm">
        <CardContent className="p-8 text-center">
          <p className="text-sm" style={{ color: "#8B6F5C" }}>
            No data yet — go to Import Data tab to upload your CSV.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "#8B6F5C" }}>
          Showing all data from first booking to present
        </p>
        <Button onClick={handleDownload} variant="outline" size="sm" className="rounded-[30px] gap-2">
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      <div ref={exportRef} className="space-y-6" style={{ backgroundColor: "#ffffff", padding: "8px" }}>

      {/* KPI Pills */}
      <div className="flex flex-wrap gap-3">
        <KpiPill label="Total Bookings" value={kpi.totalBookings.toLocaleString()} />
        <KpiPill label="Total Revenue" value={`£${kpi.totalRevenue.toLocaleString()}`} />
        <KpiPill label="Total Customers" value={kpi.totalCustomers.toLocaleString()} subtitle="all time unique" />
        <KpiPill
          label="Returning Customers"
          value={kpi.returningCustomers.toLocaleString()}
          subtitle="booked more than once"
          amber
          badge={kpi.totalCustomers > 0 ? `${Math.round((kpi.returningCustomers / kpi.totalCustomers) * 100)}% of customers` : undefined}
        />
        <KpiPill label="Avg Monthly Revenue" value={`£${kpi.avgMonthlyRevenue.toLocaleString()}`} />
      </div>

      {/* Annual Revenue Cards */}
      {annualSummary.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {annualSummary.map(yr => {
            const yearColors: Record<number, string> = { 2024: "#FFB800", 2025: "#FF6B35", 2026: "#2D1B0E" };
            const borderColor = yearColors[yr.year] || "#FF6B35";
            return (
              <div
                key={yr.year}
                className="rounded-[20px] bg-white shadow-sm px-5 py-4 min-w-[180px] flex-1"
                style={{ borderLeft: `4px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-heading text-xl font-bold" style={{ color: "#2D1B0E" }}>{yr.year}</span>
                  {yr.isCurrentYear && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FFB800", color: "#2D1B0E" }}>In Progress</span>
                  )}
                </div>
                <p className="font-heading text-2xl font-bold" style={{ color: "#2D1B0E" }}>£{yr.revenue.toLocaleString()}</p>
                <p className="text-xs" style={{ color: "#8B6F5C" }}>{yr.bookings.toLocaleString()} confirmed bookings</p>
                {yr.growthPct !== null && (
                  <span
                    className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: yr.growthPct >= 0 ? "#22c55e" : "#ef4444" }}
                  >
                    {yr.growthPct >= 0 ? "↑" : "↓"} {Math.abs(yr.growthPct)}% vs {yr.year - 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main layout — charts only (no sidebar in export) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Panel 1: Revenue Over Time */}
          <Card className="rounded-[20px] border-none shadow-sm md:col-span-2">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>💰 Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={timeline}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis tickFormatter={(v: number) => `£${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `£${v.toLocaleString()}`,
                      name === "confirmedRevenue" ? "Revenue" : "3-Month Avg",
                    ]}
                    labelStyle={{ fontWeight: "bold" }}
                  />
                  <Bar dataKey="confirmedRevenue" radius={[4, 4, 0, 0]} name="confirmedRevenue">
                    {timeline.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === bestMonthIdx ? "#FFB800" : "#FF6B35"}
                        fillOpacity={i === bestMonthIdx ? 1 : 0.7}
                      />
                    ))}
                  </Bar>
                  <Line
                    dataKey="rollingAvg"
                    stroke="#2D1B0E"
                    strokeWidth={2}
                    dot={false}
                    type="monotone"
                    name="rollingAvg"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Panel 2: Bookings Over Time */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>📅 Bookings Over Time</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeline}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    dataKey="totalBookings"
                    stroke="#FF6B35"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#FF6B35" }}
                    type="monotone"
                    name="Total Bookings"
                  />
                  <Line
                    dataKey="uniqueCustomers"
                    stroke="#FFB800"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#FFB800" }}
                    type="monotone"
                    strokeDasharray="4 4"
                    name="Unique Customers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Panel 3: Cancellation Rate */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>❌ Cancellation Rate</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={timeline}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === "cancellations" ? v : `${v}%`,
                      name === "cancellations" ? "Count" : "Rate",
                    ]}
                  />
                  <Bar dataKey="cancellations" fill="#ffcdd2" radius={[4, 4, 0, 0]} yAxisId="left" name="cancellations" />
                  <Line
                    dataKey="cancellationRate"
                    stroke="#e53935"
                    strokeWidth={2}
                    dot={false}
                    type="monotone"
                    yAxisId="right"
                    name="cancellationRate"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Panel 4: New vs Returning */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>🔄 New vs Returning</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={timeline}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name === "newCustomers" ? "New Customers" : "Returning"]}
                  />
                  <Legend />
                  <Bar dataKey="newCustomers" stackId="a" fill="#FFB800" name="New Customers" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="returningCustomers" stackId="a" fill="#FF6B35" name="Returning" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Panel 5: Top Services */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>🏆 Top Services</h3>
              {services.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={services} layout="vertical">
                    <CartesianGrid {...gridProps} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 25) + "…" : v}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FF6B35" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm" style={{ color: "#8B6F5C" }}>No confirmed bookings</p>
              )}
            </CardContent>
          </Card>

          {/* Panel 6: Groomer Revenue */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>✂️ Groomer Revenue</h3>
              {groomers.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={groomers} layout="vertical">
                    <CartesianGrid {...gridProps} />
                    <XAxis type="number" tickFormatter={(v: number) => `£${v}`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `£${v.toLocaleString()}`} />
                    <Bar
                      dataKey="revenue"
                      fill="#FFB800"
                      radius={[0, 4, 4, 0]}
                      label={{ position: "right", fontSize: 10, formatter: (v: number) => `£${v.toLocaleString()}` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm" style={{ color: "#8B6F5C" }}>No groomer data</p>
              )}
            </CardContent>
        </Card>
      </div>
      </div>{/* end exportRef */}

      {/* Sidebar — outside export area */}
      <TimelineHighlightsSidebar highlights={highlights} />
    </div>
  );
}

function KpiPill({ label, value, subtitle, amber, badge }: { label: string; value: string; subtitle?: string; amber?: boolean; badge?: string }) {
  return (
    <div className="rounded-[16px] px-4 py-3 shadow-sm" style={{ backgroundColor: amber ? "#fff8e7" : "#FFF8F0", border: "1px solid #f0e6da" }}>
      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#8B6F5C" }}>{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-lg font-bold" style={{ color: "#2D1B0E" }}>{value}</p>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#FF6B35" }}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-[10px]" style={{ color: "#8B6F5C" }}>{subtitle}</p>}
    </div>
  );
}
