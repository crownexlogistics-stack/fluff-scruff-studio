import { useMemo } from "react";
import { format, addDays, isToday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getStaffColor } from "@/components/booking-calendar/staffColors";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface StaffMember {
  id: string;
  name: string;
}

interface CalendarBooking {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  end_time?: string;
  breed_duration_minutes?: number;
  status: string;
  notes: string | null;
  staff_name?: string;
  staff_id?: string;
  service_name?: string;
  breed_name?: string;
  is_block?: boolean;
  is_own: boolean; // Whether this belongs to the current groomer
}

interface GroomerCalendarProps {
  currentDate: Date;
  daysToShow: number; // 1 or 3
  staff: StaffMember[];
  bookings: CalendarBooking[];
  currentStaffId: string;
}

const START_HOUR = 8;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export function GroomerCalendar({ currentDate, daysToShow, staff, bookings, currentStaffId }: GroomerCalendarProps) {
  const days = useMemo(() =>
    Array.from({ length: daysToShow }, (_, i) => addDays(currentDate, i)),
    [currentDate, daysToShow]
  );

  const staffIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [staff]);

  const bookingsByDateAndStaff = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    bookings.forEach(b => {
      const key = `${b.booking_date}_${b.staff_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [bookings]);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header: days across top, staff columns within each day */}
      <div className="border-b bg-muted/30 sticky top-0 z-20">
        {/* Day row */}
        <div className="grid" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <div className="border-r p-1" />
          {days.map((day) => (
            <div key={day.toISOString()} className={cn("text-center border-r last:border-r-0 py-1", isToday(day) && "bg-primary/10")}>
              <p className="text-xs text-muted-foreground font-medium">{format(day, "EEE")}</p>
              <p className={cn("text-lg font-bold", isToday(day) && "text-primary")}>{format(day, "dd")}</p>
            </div>
          ))}
        </div>
        {/* Staff sub-headers */}
        <div className="grid border-t" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <div className="border-r p-1" />
          {days.map((day) => (
            <div key={day.toISOString()} className="grid border-r last:border-r-0" style={{ gridTemplateColumns: `repeat(${staff.length}, 1fr)` }}>
              {staff.map((s, i) => {
                const color = getStaffColor(i);
                const isMe = s.id === currentStaffId;
                return (
                  <div key={s.id} className={cn("text-center py-1 text-[10px] font-medium border-r last:border-r-0 truncate px-0.5", isMe && "bg-primary/5")}>
                    <span className={cn(isMe && "font-bold text-primary")}>
                      {s.name.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Time grid */}
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="grid" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          {/* Time labels */}
          <div className="border-r">
            {HOURS.map(hour => (
              <div key={hour} className="h-14 border-b flex items-start justify-end pr-1 pt-0.5">
                <span className="text-[10px] text-muted-foreground">{`${hour}:00`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div key={dateStr} className={cn("grid border-r last:border-r-0", isToday(day) && "bg-primary/[0.02]")} style={{ gridTemplateColumns: `repeat(${staff.length}, 1fr)` }}>
                {staff.map((s, staffIdx) => {
                  const key = `${dateStr}_${s.id}`;
                  const staffBookings = bookingsByDateAndStaff.get(key) || [];
                  const isMe = s.id === currentStaffId;

                  return (
                    <div key={s.id} className={cn("relative border-r last:border-r-0", isMe && "bg-primary/[0.03]")}>
                      {HOURS.map(hour => (
                        <div key={hour} className="h-14 border-b" />
                      ))}

                      {/* Bookings */}
                      {staffBookings.map(booking => {
                        const timeParts = booking.booking_time.split(":");
                        const hour = parseInt(timeParts[0]);
                        const minutes = parseInt(timeParts[1] || "0");
                        const topOffset = (hour - START_HOUR + minutes / 60) * 56; // 56px = h-14

                        let durationHours = 1.5;
                        if (booking.end_time) {
                          const endParts = booking.end_time.split(":");
                          const endHour = parseInt(endParts[0]);
                          const endMin = parseInt(endParts[1] || "0");
                          durationHours = (endHour + endMin / 60) - (hour + minutes / 60);
                          if (durationHours <= 0) durationHours = 1;
                        } else if (booking.breed_duration_minutes) {
                          durationHours = booking.breed_duration_minutes / 60;
                        }
                        const height = durationHours * 56;

                        const color = getStaffColor(staffIdx);

                        if (booking.is_block) {
                          return (
                            <div
                              key={booking.id}
                              className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] z-10", color.bg, color.text, "opacity-70")}
                              style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "20px" }}
                            >
                              <p className="font-bold truncate">Off</p>
                            </div>
                          );
                        }

                        if (!booking.is_own) {
                          // Other groomer's appointment — show "Booked" only
                          return (
                            <div
                              key={booking.id}
                              className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] z-10 opacity-60", color.bg, color.text)}
                              style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "20px" }}
                            >
                              <p className="font-bold truncate">Booked</p>
                            </div>
                          );
                        }

                        // Own appointment — show full details
                        return (
                          <Popover key={booking.id}>
                            <PopoverTrigger asChild>
                              <div
                                className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] cursor-pointer z-10 hover:opacity-90", color.bg, color.text)}
                                style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "20px" }}
                              >
                                <p className="font-bold truncate">{booking.service_name || "Appt"}</p>
                                <p className="truncate">{booking.customer_name}</p>
                                <p className="truncate opacity-80">{booking.dog_name}</p>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" side="right" align="start">
                              <div className="space-y-2">
                                <p className="font-semibold text-sm">{booking.customer_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(booking.booking_date), "EEE d MMM")} at {booking.booking_time.slice(0, 5)}
                                </p>
                                <div className="flex gap-1.5">
                                  {booking.service_name && <Badge variant="outline" className="text-xs">{booking.service_name}</Badge>}
                                  {booking.breed_name && <Badge variant="secondary" className="text-xs">{booking.breed_name}</Badge>}
                                </div>
                                <p className="text-xs">🐕 {booking.dog_name}</p>
                                {booking.notes && <p className="text-xs text-muted-foreground border-t pt-1">{booking.notes}</p>}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
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
