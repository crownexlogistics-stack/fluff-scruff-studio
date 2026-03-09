import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import { parseISO, differenceInWeeks } from "date-fns";
import type { BookingRecord, MigratedBookingRecord, MigratedCustomerRecord, StaffRecord } from "../BookingAnalyticsSection";

interface Props {
  bookings: BookingRecord[];
  migratedBookings: MigratedBookingRecord[];
  migratedCustomerMap: Map<string, MigratedCustomerRecord>;
  staffMap: Map<string, StaffRecord>;
  staff: StaffRecord[];
  dateRange: { start: Date; end: Date };
  isDirector: boolean;
}

function inRange(dateStr: string, range: { start: Date; end: Date }) {
  const d = parseISO(dateStr);
  return d >= range.start && d <= range.end;
}

function getStars(rate: number): string {
  if (rate >= 90) return "⭐⭐⭐⭐⭐";
  if (rate >= 75) return "⭐⭐⭐⭐";
  if (rate >= 60) return "⭐⭐⭐";
  if (rate >= 45) return "⭐⭐";
  return "⭐";
}

function getStarLabel(rate: number): string {
  if (rate >= 90) return "Exceptional";
  if (rate >= 75) return "Great";
  if (rate >= 60) return "Good";
  if (rate >= 45) return "Needs improvement";
  return "Attention needed";
}

export function GroomerRebookingSection({ bookings, migratedBookings, migratedCustomerMap, staffMap, staff, dateRange, isDirector }: Props) {
  const groomers = staff.filter(s => s.role === "groomer" || s.role === "manager" || s.role === "director");

  const groomerStats = useMemo(() => {
    return groomers.map(groomer => {
      const periodBookings = bookings.filter(b => b.staff_id === groomer.id && inRange(b.booking_date, dateRange) && b.status !== "Cancelled");
      const uniqueCustomers = new Set(periodBookings.map(b => b.customer_email?.toLowerCase()).filter(Boolean));
      const cancelledCount = bookings.filter(b => b.staff_id === groomer.id && inRange(b.booking_date, dateRange) && b.status === "Cancelled").length;
      const totalWithCancelled = periodBookings.length + cancelledCount;
      const cancelRate = totalWithCancelled > 0 ? Math.round((cancelledCount / totalWithCancelled) * 100) : 0;

      // Rebooking: of customers seen by this groomer, how many came back within 12 weeks
      let rebooked = 0;
      let totalRebookWeeks = 0;
      let rebookCount = 0;

      uniqueCustomers.forEach(email => {
        if (!email) return;
        const allCustomerBookings = bookings
          .filter(b => b.customer_email?.toLowerCase() === email && b.status !== "Cancelled")
          .sort((a, b) => a.booking_date.localeCompare(b.booking_date));

        // Find bookings with this groomer, check if customer returned within 12 weeks
        const groomerBookings = allCustomerBookings.filter(b => b.staff_id === groomer.id);
        for (const gb of groomerBookings) {
          const next = allCustomerBookings.find(b => b.booking_date > gb.booking_date);
          if (next) {
            const weeks = differenceInWeeks(parseISO(next.booking_date), parseISO(gb.booking_date));
            if (weeks <= 12) {
              rebooked++;
              totalRebookWeeks += weeks;
              rebookCount++;
              break;
            }
          }
        }
      });

      const rebookRate = uniqueCustomers.size > 0 ? Math.round((rebooked / uniqueCustomers.size) * 100) : 0;
      const avgRebookWeeks = rebookCount > 0 ? Math.round(totalRebookWeeks / rebookCount) : null;

      // Personally rebooked (bookings where groomer's own customer flag is set)
      const personallyRebooked = periodBookings.filter(b => b.is_groomers_own_customer).length;

      return {
        id: groomer.id,
        name: groomer.name,
        appointments: periodBookings.length,
        uniqueCustomers: uniqueCustomers.size,
        rebooked,
        rebookRate,
        avgRebookWeeks,
        personallyRebooked,
        cancelRate,
      };
    }).sort((a, b) => b.rebookRate - a.rebookRate);
  }, [bookings, groomers, dateRange]);

  const topPerformer = groomerStats.length > 0 ? groomerStats[0] : null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Groomer Rebooking Stats</h2>

      {topPerformer && topPerformer.rebookRate > 0 && (
        <Card className="border-amber-400/50 bg-amber-50/30">
          <CardContent className="py-4 flex items-center gap-3">
            <Trophy className="h-6 w-6 text-amber-500" />
            <span className="font-semibold">🏆 Top Retention: {topPerformer.name}</span>
            <Badge className="bg-amber-500 text-white">{topPerformer.rebookRate}% rebook rate</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Groomer</TableHead>
                <TableHead className="text-right">Appointments</TableHead>
                <TableHead className="text-right">Unique Customers</TableHead>
                <TableHead className="text-right">Rebooked</TableHead>
                <TableHead className="text-right">Rebook Rate</TableHead>
                {isDirector && <TableHead>Rating</TableHead>}
                <TableHead className="text-right">Avg Rebook Time</TableHead>
                <TableHead className="text-right">Personally Rebooked</TableHead>
                <TableHead className="text-right">Cancel Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groomerStats.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-right">{g.appointments}</TableCell>
                  <TableCell className="text-right">{g.uniqueCustomers}</TableCell>
                  <TableCell className="text-right">{g.rebooked}</TableCell>
                  <TableCell className="text-right">
                    <span className={g.rebookRate >= 75 ? "text-green-600 font-semibold" : g.rebookRate >= 60 ? "text-amber-500" : "text-destructive"}>
                      {g.rebookRate}%
                    </span>
                  </TableCell>
                  {isDirector && (
                    <TableCell>
                      <span className="text-xs" title={getStarLabel(g.rebookRate)}>{getStars(g.rebookRate)}</span>
                    </TableCell>
                  )}
                  <TableCell className="text-right">{g.avgRebookWeeks !== null ? `${g.avgRebookWeeks} weeks` : "—"}</TableCell>
                  <TableCell className="text-right">{g.personallyRebooked}</TableCell>
                  <TableCell className="text-right">
                    <span className={g.cancelRate < 10 ? "text-green-600" : g.cancelRate < 20 ? "text-amber-500" : "text-destructive"}>
                      {g.cancelRate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
