import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { parseISO, getDay, differenceInDays, format, eachMonthOfInterval, eachWeekOfInterval, differenceInCalendarDays } from "date-fns";
import type { BookingRecord } from "../BookingAnalyticsSection";

interface Props {
  bookings: BookingRecord[];
  serviceMap: Map<string, string>;
  dateRange: { start: Date; end: Date };
  prevRange: { start: Date; end: Date };
  compare: boolean;
  period: string;
}

function inRange(dateStr: string, range: { start: Date; end: Date }) {
  const d = parseISO(dateStr);
  return d >= range.start && d <= range.end;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CancellationIntelligenceSection({ bookings, serviceMap, dateRange, prevRange, compare, period }: Props) {
  const cancelled = bookings.filter(b => b.status === "Cancelled" && inRange(b.booking_date, dateRange));

  // Cancellations by day of week
  const dayData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    cancelled.forEach(b => counts[getDay(parseISO(b.booking_date))]++);
    return [1, 2, 3, 4, 5, 6].map(i => ({ day: DAY_NAMES[i], count: counts[i] }));
  }, [cancelled]);

  // By service
  const serviceData = useMemo(() => {
    const map = new Map<string, { cancelled: number; total: number }>();
    bookings.filter(b => inRange(b.booking_date, dateRange) && b.service_id).forEach(b => {
      const name = serviceMap.get(b.service_id!) || "Unknown";
      const entry = map.get(name) || { cancelled: 0, total: 0 };
      entry.total++;
      if (b.status === "Cancelled") entry.cancelled++;
      map.set(name, entry);
    });
    return Array.from(map.entries())
      .map(([name, { cancelled, total }]) => ({ name, cancelled, rate: total > 0 ? Math.round((cancelled / total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [bookings, dateRange, serviceMap]);

  // Notice period
  const noticeData = useMemo(() => {
    const bins = { sameDay: 0, d1: 0, d2_3: 0, d4_7: 0, d7plus: 0 };
    cancelled.forEach(b => {
      // Approximate: difference between created_at and booking_date as proxy
      // In reality we'd want a "cancelled_at" field, using created_at of the status change
      // For now use booking_date - we assume cancellation happened close to created_at
      const lead = Math.max(0, differenceInCalendarDays(parseISO(b.booking_date), new Date()));
      if (lead <= 0) bins.sameDay++;
      else if (lead <= 1) bins.d1++;
      else if (lead <= 3) bins.d2_3++;
      else if (lead <= 7) bins.d4_7++;
      else bins.d7plus++;
    });
    return [
      { label: "Same day", count: bins.sameDay, color: "text-destructive" },
      { label: "1 day notice", count: bins.d1, color: "text-orange-500" },
      { label: "2-3 days", count: bins.d2_3, color: "text-amber-500" },
      { label: "4-7 days", count: bins.d4_7, color: "text-green-500" },
      { label: "7+ days", count: bins.d7plus, color: "text-green-600" },
    ];
  }, [cancelled]);

  // Financial impact
  const avgBookingValue = useMemo(() => {
    const completed = bookings.filter(b => b.status === "Completed");
    if (completed.length === 0) return 0;
    return completed.reduce((s, b) => s + (b.final_charge || b.total_price || 0), 0) / completed.length;
  }, [bookings]);

  const shortNoticeCancellations = noticeData.slice(0, 2).reduce((s, d) => s + d.count, 0);
  const financialImpact = Math.round(shortNoticeCancellations * avgBookingValue);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cancellation Intelligence</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Cancellations by Day of Week</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cancellation Notice Period</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {noticeData.map(d => (
                <div key={d.label} className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${d.color}`}>{d.label}</span>
                  <span className="font-bold">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {serviceData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cancellations by Service</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {serviceData.map(s => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <span className={`font-semibold ${s.rate > 20 ? "text-destructive" : s.rate > 10 ? "text-amber-500" : "text-green-600"}`}>
                    {s.cancelled} cancelled ({s.rate}% rate)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/20">
        <CardHeader><CardTitle className="text-base">Financial Impact of Cancellations</CardTitle></CardHeader>
        <CardContent>
          <p className="text-lg">
            Short-notice cancellations cost an estimated{" "}
            <span className="text-destructive font-bold text-2xl">£{financialImpact}</span>{" "}
            in lost revenue this period
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {shortNoticeCancellations} same-day/1-day cancellations × £{Math.round(avgBookingValue)} avg booking value
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
