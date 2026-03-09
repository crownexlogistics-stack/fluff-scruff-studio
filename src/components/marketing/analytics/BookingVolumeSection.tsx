import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { format, parseISO, getDay, differenceInDays, isAfter, isBefore, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import type { BookingRecord, MigratedBookingRecord, MigratedCustomerRecord, StaffRecord } from "../BookingAnalyticsSection";

interface Props {
  bookings: BookingRecord[];
  migratedBookings: MigratedBookingRecord[];
  migratedCustomerMap: Map<string, MigratedCustomerRecord>;
  staffMap: Map<string, StaffRecord>;
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

function CompareArrow({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const isUp = pct > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span className={`text-xs font-medium ml-2 ${isGood ? "text-green-600" : "text-destructive"}`}>
      {isUp ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
      {" "}{Math.abs(pct)}%
    </span>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

export function BookingVolumeSection({ bookings, migratedBookings, migratedCustomerMap, staffMap, serviceMap, dateRange, prevRange, compare, period }: Props) {
  const filterBookings = (range: { start: Date; end: Date }) => {
    const live = bookings.filter(b => inRange(b.booking_date, range) && b.status !== "Cancelled");
    const migrated = migratedBookings.filter(mb => inRange(mb.booking_date, range));
    return { live, migrated, total: live.length + migrated.length };
  };

  const current = filterBookings(dateRange);
  const prev = filterBookings(prevRange);

  const completedCurrent = bookings.filter(b => inRange(b.booking_date, dateRange) && b.status === "Completed").length
    + migratedBookings.filter(mb => inRange(mb.booking_date, dateRange) && isBefore(parseISO(mb.booking_date), new Date())).length;
  const completedPrev = bookings.filter(b => inRange(b.booking_date, prevRange) && b.status === "Completed").length
    + migratedBookings.filter(mb => inRange(mb.booking_date, prevRange) && isBefore(parseISO(mb.booking_date), new Date())).length;

  const cancelledCurrent = bookings.filter(b => inRange(b.booking_date, dateRange) && b.status === "Cancelled").length;
  const cancelledPrev = bookings.filter(b => inRange(b.booking_date, prevRange) && b.status === "Cancelled").length;
  const totalForRate = bookings.filter(b => inRange(b.booking_date, dateRange)).length;
  const cancelRate = totalForRate > 0 ? Math.round((cancelledCurrent / totalForRate) * 100) : 0;

  const today = new Date();
  const upcomingBookings = bookings.filter(b => isAfter(parseISO(b.booking_date), today) && b.status !== "Cancelled");
  const upcomingRevenue = upcomingBookings.reduce((s, b) => s + (b.total_price || 0), 0);

  // Trend chart data
  const trendData = useMemo(() => {
    const getIntervals = (range: { start: Date; end: Date }) => {
      const days = differenceInDays(range.end, range.start);
      if (days <= 7) return eachDayOfInterval(range).map(d => ({ key: format(d, "EEE"), date: d }));
      if (days <= 60) return eachWeekOfInterval(range, { weekStartsOn: 1 }).map(d => ({ key: format(d, "dd MMM"), date: d }));
      return eachMonthOfInterval(range).map(d => ({ key: format(d, "MMM yy"), date: d }));
    };

    const intervals = getIntervals(dateRange);
    return intervals.map((interval, i) => {
      const nextDate = i < intervals.length - 1 ? intervals[i + 1].date : dateRange.end;
      const count = bookings.filter(b => {
        const d = parseISO(b.booking_date);
        return d >= interval.date && d < nextDate && b.status !== "Cancelled";
      }).length + migratedBookings.filter(mb => {
        const d = parseISO(mb.booking_date);
        return d >= interval.date && d < nextDate;
      }).length;
      return { name: interval.key, bookings: count };
    });
  }, [bookings, migratedBookings, dateRange]);

  // Day of week distribution
  const dayOfWeekData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    bookings.filter(b => b.status !== "Cancelled").forEach(b => {
      counts[getDay(parseISO(b.booking_date))]++;
    });
    migratedBookings.forEach(mb => {
      counts[getDay(parseISO(mb.booking_date))]++;
    });
    return [1, 2, 3, 4, 5, 6].map(i => ({ day: DAY_NAMES[i], count: counts[i] }));
  }, [bookings, migratedBookings]);

  // Time of day distribution
  const timeOfDayData = useMemo(() => {
    const counts = new Map<number, number>();
    HOURS.forEach(h => counts.set(h, 0));
    bookings.filter(b => b.status !== "Cancelled" && b.booking_time).forEach(b => {
      const hour = parseInt(b.booking_time.split(":")[0]);
      if (counts.has(hour)) counts.set(hour, (counts.get(hour) || 0) + 1);
    });
    migratedBookings.filter(mb => mb.booking_time).forEach(mb => {
      const hour = parseInt((mb.booking_time || "").split(":")[0]);
      if (counts.has(hour)) counts.set(hour, (counts.get(hour) || 0) + 1);
    });
    return HOURS.map(h => ({ time: `${h}:00`, count: counts.get(h) || 0 }));
  }, [bookings, migratedBookings]);

  // Lead time
  const leadTimeData = useMemo(() => {
    const bins = { sameDay: 0, d1_3: 0, d4_7: 0, w1_2: 0, w2plus: 0, total: 0 };
    bookings.filter(b => b.status !== "Cancelled").forEach(b => {
      const lead = differenceInDays(parseISO(b.booking_date), parseISO(b.created_at));
      bins.total++;
      if (lead <= 0) bins.sameDay++;
      else if (lead <= 3) bins.d1_3++;
      else if (lead <= 7) bins.d4_7++;
      else if (lead <= 14) bins.w1_2++;
      else bins.w2plus++;
    });
    const t = bins.total || 1;
    const avgLead = bookings.filter(b => b.status !== "Cancelled")
      .reduce((s, b) => s + Math.max(0, differenceInDays(parseISO(b.booking_date), parseISO(b.created_at))), 0) / t;
    return {
      avg: Math.round(avgLead),
      breakdown: [
        { label: "Same day", pct: Math.round((bins.sameDay / t) * 100) },
        { label: "1-3 days", pct: Math.round((bins.d1_3 / t) * 100) },
        { label: "4-7 days", pct: Math.round((bins.d4_7 / t) * 100) },
        { label: "1-2 weeks", pct: Math.round((bins.w1_2 / t) * 100) },
        { label: "2+ weeks", pct: Math.round((bins.w2plus / t) * 100) },
      ],
    };
  }, [bookings]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Booking Volume & Trends</h2>

      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CalendarCheck className="h-4 w-4" /> Total Bookings</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{current.total}</p>
            {compare && <CompareArrow current={current.total} previous={prev.total} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Completed</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedCurrent}</p>
            {compare && <CompareArrow current={completedCurrent} previous={completedPrev} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><XCircle className="h-4 w-4" /> Cancellations</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{cancelledCurrent}</p>
            <Badge variant="outline" className={`mt-1 ${cancelRate < 10 ? "text-green-600 border-green-600" : cancelRate < 20 ? "text-amber-500 border-amber-500" : "text-destructive border-destructive"}`}>
              {cancelRate}% rate
            </Badge>
            {compare && <CompareArrow current={cancelledCurrent} previous={cancelledPrev} invert />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Upcoming Confirmed</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{upcomingBookings.length}</p>
            <p className="text-xs text-muted-foreground">Worth £{upcomingRevenue.toFixed(0)} in confirmed revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Booking Trend</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of week */}
        <Card>
          <CardHeader><CardTitle className="text-base">Bookings by Day of Week</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Time of day */}
        <Card>
          <CardHeader><CardTitle className="text-base">Bookings by Time of Day</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeOfDayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lead time */}
      <Card>
        <CardHeader><CardTitle className="text-base">Booking Lead Time</CardTitle></CardHeader>
        <CardContent>
          <p className="text-lg font-semibold mb-3">On average customers book <span className="text-primary">{leadTimeData.avg} days</span> in advance</p>
          <div className="grid grid-cols-5 gap-2">
            {leadTimeData.breakdown.map(b => (
              <div key={b.label} className="text-center">
                <div className="text-2xl font-bold">{b.pct}%</div>
                <div className="text-xs text-muted-foreground">{b.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
