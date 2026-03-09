import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { parseISO, format, eachMonthOfInterval, isBefore } from "date-fns";
import type { BookingRecord, MigratedBookingRecord, MigratedCustomerRecord, StaffRecord } from "../BookingAnalyticsSection";

interface Props {
  bookings: BookingRecord[];
  migratedBookings: MigratedBookingRecord[];
  migratedCustomerMap: Map<string, MigratedCustomerRecord>;
  staffMap: Map<string, StaffRecord>;
  dateRange: { start: Date; end: Date };
  prevRange: { start: Date; end: Date };
  compare: boolean;
}

function inRange(dateStr: string, range: { start: Date; end: Date }) {
  const d = parseISO(dateStr);
  return d >= range.start && d <= range.end;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

export function CustomerRetentionSection({ bookings, migratedBookings, migratedCustomerMap, staffMap, dateRange, prevRange, compare }: Props) {
  // Build full customer booking history to determine first-ever booking
  const customerFirstBooking = useMemo(() => {
    const map = new Map<string, string>(); // email -> earliest date
    bookings.forEach(b => {
      if (!b.customer_email || b.status === "Cancelled") return;
      const email = b.customer_email.toLowerCase();
      const existing = map.get(email);
      if (!existing || b.booking_date < existing) map.set(email, b.booking_date);
    });
    migratedBookings.forEach(mb => {
      const mc = migratedCustomerMap.get(mb.migrated_customer_id);
      const email = mc?.email?.toLowerCase();
      if (!email) return;
      const existing = map.get(email);
      if (!existing || mb.booking_date < existing) map.set(email, mb.booking_date);
    });
    return map;
  }, [bookings, migratedBookings, migratedCustomerMap]);

  // New vs Returning in period
  const { newCount, returningCount } = useMemo(() => {
    const periodEmails = new Set<string>();
    let newC = 0, retC = 0;

    bookings.filter(b => inRange(b.booking_date, dateRange) && b.status !== "Cancelled" && b.customer_email).forEach(b => {
      const email = b.customer_email!.toLowerCase();
      if (periodEmails.has(email)) return;
      periodEmails.add(email);
      const first = customerFirstBooking.get(email);
      if (first && inRange(first, dateRange)) newC++; else retC++;
    });

    migratedBookings.filter(mb => inRange(mb.booking_date, dateRange)).forEach(mb => {
      const mc = migratedCustomerMap.get(mb.migrated_customer_id);
      const email = mc?.email?.toLowerCase();
      if (!email || periodEmails.has(email)) return;
      periodEmails.add(email);
      const first = customerFirstBooking.get(email);
      if (first && inRange(first, dateRange)) newC++; else retC++;
    });

    return { newCount: newC, returningCount: retC };
  }, [bookings, migratedBookings, dateRange, customerFirstBooking, migratedCustomerMap]);

  const total = newCount + returningCount;
  const returnRate = total > 0 ? Math.round((returningCount / total) * 100) : 0;
  const donutData = [
    { name: "Returning", value: returningCount },
    { name: "New", value: newCount },
  ];

  // Booking source breakdown
  const sourceBreakdown = useMemo(() => {
    const sources: Record<string, number> = { "Self-booked online": 0, "Rebooked by salon": 0, "Phone booking": 0, "Walk-in": 0, "Other": 0 };
    const groomerRebooks: Record<string, number> = {};

    bookings.filter(b => inRange(b.booking_date, dateRange) && b.status !== "Cancelled").forEach(b => {
      const src = b.referral_source?.toLowerCase() || "direct";
      if (src === "direct" || src === "website" || src === "online") {
        sources["Self-booked online"]++;
      } else if (src === "phone") {
        sources["Phone booking"]++;
      } else if (src === "walk-in" || src === "walkin") {
        sources["Walk-in"]++;
      } else if (src === "rebooked" || src === "staff" || b.is_groomers_own_customer) {
        sources["Rebooked by salon"]++;
        const groomerName = staffMap.get(b.staff_id || "")?.name || "Unknown";
        groomerRebooks[groomerName] = (groomerRebooks[groomerName] || 0) + 1;
      } else {
        sources["Other"]++;
      }
    });

    return { sources, groomerRebooks };
  }, [bookings, dateRange, staffMap]);

  // New customer acquisition over time
  const acquisitionData = useMemo(() => {
    const allDates = Array.from(customerFirstBooking.values()).sort();
    if (allDates.length === 0) return [];
    const start = parseISO(allDates[0]);
    const end = new Date();
    const months = eachMonthOfInterval({ start, end });
    return months.map((m, i) => {
      const monthStr = format(m, "yyyy-MM");
      const count = allDates.filter(d => d.startsWith(monthStr)).length;
      return { month: format(m, "MMM yy"), count };
    });
  }, [customerFirstBooking]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">New vs Returning Customers</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer Split</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                      {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <p className="text-sm">New customers: <span className="font-bold">{newCount}</span></p>
                <p className="text-sm">Returning customers: <span className="font-bold">{returningCount}</span></p>
                <p className="text-sm">
                  Returning rate:{" "}
                  <span className={`font-bold ${returnRate >= 60 ? "text-green-600" : returnRate >= 40 ? "text-amber-500" : "text-destructive"}`}>
                    {returnRate}%
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">Industry benchmark: 60%+ is healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Booking Source</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(sourceBreakdown.sources).filter(([, v]) => v > 0).map(([label, count]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  {label === "Rebooked by salon" && Object.entries(sourceBreakdown.groomerRebooks).map(([name, c]) => (
                    <div key={name} className="flex justify-between text-xs text-muted-foreground ml-4">
                      <span>└ {name} rebooked</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">New Customer Acquisition</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={acquisitionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
