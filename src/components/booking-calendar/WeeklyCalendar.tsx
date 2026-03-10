import { useMemo } from "react";
import { format, addDays, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { BookingEvent, BookingData } from "./BookingEvent";
import { EmptySlotAction } from "./EmptySlotAction";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StaffMember {
  id: string;
  name: string;
}

interface WeeklyCalendarProps {
  weekStart: Date;
  staff: StaffMember[];
  bookings: BookingData[];
  staffIndexMap: Map<string, number>;
  currentStaffId?: string;
  onBook: (date: Date, hour: number, staffId: string) => void;
  onBlock: (date: Date, hour: number, staffId: string) => void;
  onOvertime?: (date: Date, hour: number, staffId: string) => void;
  onEditBlock?: (booking: BookingData) => void;
  onCancelBlock?: (booking: BookingData) => void;
  onEditOvertime?: (booking: BookingData) => void;
  onCancelOvertime?: (booking: BookingData) => void;
  onViewOrder?: (booking: BookingData) => void;
  onEditAppointment?: (booking: BookingData) => void;
  onCancelBooking?: (booking: BookingData) => void;
  onBookAgain?: (booking: BookingData) => void;
  onCheckout?: (booking: BookingData) => void;
}

const START_HOUR = 8;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS = Array.from({ length: 7 }, (_, i) => i);

const DEFAULT_DURATION = 1.5; // hours

function getBookingTimeRange(b: BookingData) {
  const parts = b.booking_time.split(":");
  const startMin = parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
  let endMin: number;
  if (b.end_time) {
    const ep = b.end_time.split(":");
    endMin = parseInt(ep[0]) * 60 + parseInt(ep[1] || "0");
    if (endMin <= startMin) endMin = startMin + 60;
  } else {
    const isCancelled = b.status === "Cancelled" || b.status === "No Show" || b.status === "Refunded";
    const durationMins = b.duration_minutes || DEFAULT_DURATION * 60;
    endMin = startMin + (isCancelled ? 15 : durationMins);
  }
  return { startMin, endMin };
}

interface LayoutInfo {
  column: number;
  totalColumns: number;
}

function computeOverlapLayout(dayBookings: BookingData[]): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (dayBookings.length === 0) return result;

  // Get time ranges
  const items = dayBookings.map(b => {
    const { startMin, endMin } = getBookingTimeRange(b);
    return { id: b.id, startMin, endMin };
  }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Group into overlap clusters
  const clusters: typeof items[] = [];
  let currentCluster: typeof items = [];
  let clusterEnd = -1;

  for (const item of items) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // Assign columns within each cluster
  for (const cluster of clusters) {
    const columns: { endMin: number }[] = [];
    for (const item of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (item.startMin >= columns[col].endMin) {
          columns[col].endMin = item.endMin;
          result.set(item.id, { column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        result.set(item.id, { column: columns.length, totalColumns: 0 });
        columns.push({ endMin: item.endMin });
      }
    }
    const totalCols = columns.length;
    for (const item of cluster) {
      const info = result.get(item.id)!;
      info.totalColumns = totalCols;
    }
  }

  return result;
}

export function WeeklyCalendar({ weekStart, staff, bookings, staffIndexMap, currentStaffId, onBook, onBlock, onOvertime, onEditBlock, onCancelBlock, onEditOvertime, onCancelOvertime, onViewOrder, onEditAppointment, onCancelBooking, onBookAgain, onCheckout }: WeeklyCalendarProps) {
  const days = useMemo(() => DAYS.map(i => addDays(weekStart, i)), [weekStart]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingData[]>();
    bookings.forEach(b => {
      const key = b.booking_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [bookings]);

  const layoutByDate = useMemo(() => {
    const map = new Map<string, Map<string, LayoutInfo>>();
    bookingsByDate.forEach((dayBookings, dateStr) => {
      map.set(dateStr, computeOverlapLayout(dayBookings));
    });
    return map;
  }, [bookingsByDate]);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="grid border-b bg-muted/30 sticky top-0 z-20" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
        <div className="border-r p-2" />
        {days.map((day) => (
          <div key={day.toISOString()} className={cn("p-2 text-center border-r last:border-r-0", isToday(day) && "bg-primary/10")}>
            <p className="text-xs text-muted-foreground font-medium">{format(day, "EEE")}</p>
            <p className={cn("text-lg font-bold", isToday(day) && "text-primary")}>{format(day, "dd")}</p>
          </div>
        ))}
      </div>

      <ScrollArea className="h-[calc(100vh-260px)] sm:h-[calc(100vh-220px)]">
        <div className="relative grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
          <div className="border-r">
            {HOURS.map(hour => (
              <div key={hour} className="h-16 border-b flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-muted-foreground">{`${hour}:00`}</span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayBookings = bookingsByDate.get(dateStr) || [];
            const dayLayout = layoutByDate.get(dateStr) || new Map();

            return (
              <div key={dateStr} className={cn("relative border-r last:border-r-0", isToday(day) && "bg-primary/5")}>
                {HOURS.map(hour => (
                  <EmptySlotAction
                    key={hour}
                    date={day}
                    hour={hour}
                    staffId={staff[0]?.id || ""}
                    staffName={staff[0]?.name || ""}
                    onBook={onBook}
                    onBlock={onBlock}
                    onOvertime={onOvertime}
                  >
                    <div className="h-16 border-b cursor-pointer hover:bg-accent/30 transition-colors" />
                  </EmptySlotAction>
                ))}

                {dayBookings.map(booking => {
                  const sIdx = staffIndexMap.get(booking.staff_name || "") ?? 0;
                  const layout = dayLayout.get(booking.id);
                  const isPrivacyMasked = !!currentStaffId && booking.staff_id !== currentStaffId && !booking.is_block && !booking.is_overtime;
                    return (
                      <BookingEvent
                        key={booking.id}
                        booking={booking}
                        staffIndex={sIdx}
                        startHour={START_HOUR}
                        durationHours={DEFAULT_DURATION}
                        overlapColumn={layout?.column ?? 0}
                        overlapTotalColumns={layout?.totalColumns ?? 1}
                        privacyMasked={isPrivacyMasked}
                        onEditBlock={isPrivacyMasked ? undefined : onEditBlock}
                        onCancelBlock={isPrivacyMasked ? undefined : onCancelBlock}
                        onEditOvertime={isPrivacyMasked ? undefined : onEditOvertime}
                        onCancelOvertime={isPrivacyMasked ? undefined : onCancelOvertime}
                        onViewOrder={isPrivacyMasked ? undefined : onViewOrder}
                        onEditAppointment={isPrivacyMasked ? undefined : onEditAppointment}
                        onCancelBooking={isPrivacyMasked ? undefined : onCancelBooking}
                        onBookAgain={isPrivacyMasked ? undefined : onBookAgain}
                        onCheckout={isPrivacyMasked ? undefined : onCheckout}
                      />
                    );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
