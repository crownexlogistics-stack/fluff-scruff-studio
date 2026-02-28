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
  onBook: (date: Date, hour: number, staffId: string) => void;
  onBlock: (date: Date, hour: number, staffId: string) => void;
  onEditBlock?: (booking: BookingData) => void;
  onCancelBlock?: (booking: BookingData) => void;
}

const START_HOUR = 8;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS = Array.from({ length: 7 }, (_, i) => i);

export function WeeklyCalendar({ weekStart, staff, bookings, staffIndexMap, onBook, onBlock, onEditBlock, onCancelBlock }: WeeklyCalendarProps) {
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

      <ScrollArea className="h-[calc(100vh-220px)]">
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
                  >
                    <div className="h-16 border-b cursor-pointer hover:bg-accent/30 transition-colors" />
                  </EmptySlotAction>
                ))}

                {dayBookings.map(booking => {
                  const sIdx = staffIndexMap.get(booking.staff_name || "") ?? 0;
                  return (
                    <BookingEvent
                      key={booking.id}
                      booking={booking}
                      staffIndex={sIdx}
                      startHour={START_HOUR}
                      durationHours={1.5}
                      onEditBlock={onEditBlock}
                      onCancelBlock={onCancelBlock}
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
