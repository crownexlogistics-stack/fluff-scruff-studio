import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useYoYAnalytics, YEAR_COLORS } from "./year-on-year/useYoYAnalytics";
import HighlightsSidebar from "./year-on-year/HighlightsSidebar";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const YearPill = ({ year, value }: { year: number; value: string }) => (
  <Badge
    className="text-xs font-bold px-2.5 py-1"
    style={{
      backgroundColor: YEAR_COLORS[year] || "#FF6B35",
      color: year === 2026 ? "#fff" : "#2D1B0E",
    }}
  >
    {year}: {value}
  </Badge>
);

export default function YearOnYearTab() {
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [activeYears, setActiveYears] = useState<Set<number>>(new Set([2024, 2025, 2026]));

  const month = parseInt(selectedMonth);
  const { isLoading, isEmpty, metrics, services, groomers, highlights } = useYoYAnalytics(month, activeYears);

  const toggleYear = (y: number) => {
    setActiveYears(prev => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y); else next.add(y);
      return next;
    });
  };

  const sorted = [...metrics].sort((a, b) => a.year - b.year);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60 rounded-[30px]" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-[20px]" />)}
          </div>
          <Skeleton className="h-[600px] rounded-[20px]" />
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

  const revenueData = sorted.map(m => ({ year: m.year.toString(), value: Math.round(m.confirmedRevenue) }));
  const customerData = sorted.map(m => ({ year: m.year.toString(), value: m.uniqueCustomers }));
  const cancellationData = sorted.map(m => ({ year: m.year.toString(), value: m.cancellationRate }));
  const retentionData = sorted.map(m => ({ year: m.year.toString(), new: m.newCustomers, returning: m.returningCustomers }));

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

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* 6 Chart Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Panel 1: Revenue */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>📈 Revenue</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v: number) => `£${v}`} />
                  <Tooltip formatter={(v: number) => `£${v.toLocaleString()}`} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {revenueData.map((e, i) => (
                      <Cell key={i} fill={YEAR_COLORS[parseInt(e.year)] || "#FF6B35"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sorted.map(m => (
                  <YearPill key={m.year} year={m.year} value={`£${Math.round(m.confirmedRevenue).toLocaleString()}`} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panel 2: Customers */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>👥 Customers</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={customerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {customerData.map((e, i) => (
                      <Cell key={i} fill={YEAR_COLORS[parseInt(e.year)] || "#FF6B35"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sorted.map(m => (
                  <YearPill key={m.year} year={m.year} value={m.uniqueCustomers.toLocaleString()} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panel 3: Cancellations */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>❌ Cancellations</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cancellationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {cancellationData.map((e, i) => (
                      <Cell key={i} fill={YEAR_COLORS[parseInt(e.year)] || "#FF6B35"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sorted.map((m, idx) => (
                  <span key={m.year} className="inline-flex items-center gap-1">
                    <YearPill year={m.year} value={`${m.cancellationRate}%`} />
                    {idx > 0 && m.cancellationRate < sorted[idx - 1].cancellationRate && (
                      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300">↓ improved</Badge>
                    )}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panel 4: Returning Customers */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>🔄 Returning Customers</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={retentionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="new" stackId="a" fill="#FFB800" name="New" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="returning" stackId="a" fill="#FF6B35" name="Returning" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sorted.map(m => (
                  <YearPill
                    key={m.year}
                    year={m.year}
                    value={`${m.newCustomers} new, ${m.returningCustomers} ret. (${m.retentionRate}%)`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panel 5: Top Services */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>🏆 Top Services</h3>
              {services.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={services} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FF6B35" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm" style={{ color: "#8B6F5C" }}>No confirmed bookings for this period</p>
              )}
            </CardContent>
          </Card>

          {/* Panel 6: Groomer Revenue */}
          <Card className="rounded-[20px] border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-heading text-base font-bold mb-3" style={{ color: "#2D1B0E" }}>⭐ Groomer Revenue</h3>
              {groomers.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={groomers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" />
                    <XAxis type="number" tickFormatter={(v: number) => `£${v}`} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `£${v.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#FFB800" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm" style={{ color: "#8B6F5C" }}>No groomer data for this period</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <HighlightsSidebar highlights={highlights} selectedMonthName={MONTH_NAMES[month - 1]} />
      </div>
    </div>
  );
}
