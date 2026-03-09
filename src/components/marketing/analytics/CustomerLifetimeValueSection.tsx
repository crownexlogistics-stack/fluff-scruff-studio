import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { parseISO, format } from "date-fns";
import type { BookingRecord, MigratedBookingRecord, MigratedCustomerRecord, StaffRecord } from "../BookingAnalyticsSection";

interface Props {
  bookings: BookingRecord[];
  migratedBookings: MigratedBookingRecord[];
  migratedCustomerMap: Map<string, MigratedCustomerRecord>;
  staffMap: Map<string, StaffRecord>;
}

interface CustomerStats {
  name: string;
  email: string;
  totalVisits: number;
  totalSpent: number;
  firstVisit: string;
  lastVisit: string;
  usualGroomer: string;
}

function loyaltyBadge(visits: number) {
  if (visits >= 20) return <Badge className="bg-blue-400 text-white">💎 Diamond</Badge>;
  if (visits >= 10) return <Badge className="bg-amber-500 text-white">🥇 Gold</Badge>;
  if (visits >= 5) return <Badge className="bg-gray-400 text-white">🥈 Silver</Badge>;
  if (visits >= 2) return <Badge className="bg-orange-700 text-white">🥉 Bronze</Badge>;
  return <Badge variant="outline">🆕 New</Badge>;
}

const VALUE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))"];

export function CustomerLifetimeValueSection({ bookings, migratedBookings, migratedCustomerMap, staffMap }: Props) {
  const customerStats = useMemo(() => {
    const map = new Map<string, CustomerStats>();

    bookings.filter(b => b.status !== "Cancelled" && b.customer_email).forEach(b => {
      const email = b.customer_email!.toLowerCase();
      const existing = map.get(email) || { name: b.customer_name, email, totalVisits: 0, totalSpent: 0, firstVisit: b.booking_date, lastVisit: b.booking_date, usualGroomer: "" };
      existing.totalVisits++;
      existing.totalSpent += (b.final_charge || b.total_price || 0);
      if (b.booking_date < existing.firstVisit) existing.firstVisit = b.booking_date;
      if (b.booking_date > existing.lastVisit) {
        existing.lastVisit = b.booking_date;
        existing.usualGroomer = staffMap.get(b.staff_id || "")?.name || existing.usualGroomer;
      }
      if (!existing.usualGroomer) existing.usualGroomer = staffMap.get(b.staff_id || "")?.name || "Unknown";
      map.set(email, existing);
    });

    migratedBookings.forEach(mb => {
      const mc = migratedCustomerMap.get(mb.migrated_customer_id);
      const email = mc?.email?.toLowerCase();
      if (!email) return;
      const existing = map.get(email) || { name: mc?.full_name || "Unknown", email, totalVisits: 0, totalSpent: 0, firstVisit: mb.booking_date, lastVisit: mb.booking_date, usualGroomer: mb.staff_name || "Unknown" };
      existing.totalVisits++;
      existing.totalSpent += (mb.total_price || 0);
      if (mb.booking_date < existing.firstVisit) existing.firstVisit = mb.booking_date;
      if (mb.booking_date > existing.lastVisit) existing.lastVisit = mb.booking_date;
      map.set(email, existing);
    });

    return Array.from(map.values());
  }, [bookings, migratedBookings, migratedCustomerMap, staffMap]);

  const uniqueCustomers = customerStats.length;
  const totalRevenue = customerStats.reduce((s, c) => s + c.totalSpent, 0);
  const avgLifetimeValue = uniqueCustomers > 0 ? Math.round(totalRevenue / uniqueCustomers) : 0;

  const top10 = [...customerStats].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

  // Lifetime value by referral source
  const sourceValues = useMemo(() => {
    const sourceMap = new Map<string, { total: number; count: number }>();
    bookings.filter(b => b.status !== "Cancelled" && b.customer_email).forEach(b => {
      const src = b.referral_source || "direct";
      const entry = sourceMap.get(src) || { total: 0, count: 0 };
      entry.total += (b.final_charge || b.total_price || 0);
      entry.count++;
      sourceMap.set(src, entry);
    });
    return Array.from(sourceMap.entries())
      .map(([source, { total, count }]) => ({ source: source.charAt(0).toUpperCase() + source.slice(1), avgValue: count > 0 ? Math.round(total / count) : 0 }))
      .sort((a, b) => b.avgValue - a.avgValue);
  }, [bookings]);

  // Value distribution
  const distribution = useMemo(() => {
    let high = 0, mid = 0, low = 0, single = 0;
    customerStats.forEach(c => {
      if (c.totalSpent >= 500) high++;
      else if (c.totalSpent >= 200) mid++;
      else if (c.totalSpent >= 50) low++;
      else single++;
    });
    return [
      { name: "High (£500+)", value: high },
      { name: "Mid (£200-500)", value: mid },
      { name: "Low (£50-200)", value: low },
      { name: "Single (<£50)", value: single },
    ];
  }, [customerStats]);

  // Never returned
  const neverReturned = customerStats.filter(c => c.totalVisits === 1);
  const neverReturnedPct = uniqueCustomers > 0 ? Math.round((neverReturned.length / uniqueCustomers) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Customer Lifetime Value</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Lifetime Value</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-primary">£{avgLifetimeValue}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Unique Customers</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{uniqueCustomers}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Never Returned</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{neverReturned.length} <span className="text-lg text-muted-foreground">({neverReturnedPct}%)</span></p>
            <p className="text-xs text-muted-foreground">Came once and never booked again</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Value Distribution</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={35} outerRadius={65} paddingAngle={2}>
                  {distribution.map((_, i) => <Cell key={i} fill={VALUE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">LTV by Acquisition Source</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sourceValues.map(s => (
                <div key={s.source} className="flex justify-between text-sm">
                  <span>{s.source}</span>
                  <span className="font-semibold">£{s.avgValue} avg</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Most Loyal Customers</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead>First Visit</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Usual Groomer</TableHead>
                <TableHead>Loyalty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top10.map(c => (
                <TableRow key={c.email}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.totalVisits}</TableCell>
                  <TableCell className="text-right font-semibold">£{Math.round(c.totalSpent)}</TableCell>
                  <TableCell>{format(parseISO(c.firstVisit), "dd MMM yyyy")}</TableCell>
                  <TableCell>{format(parseISO(c.lastVisit), "dd MMM yyyy")}</TableCell>
                  <TableCell>{c.usualGroomer}</TableCell>
                  <TableCell>{loyaltyBadge(c.totalVisits)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
