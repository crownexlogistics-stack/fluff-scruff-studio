import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { getStaffColor } from "./staffColors";

export interface BookingData {
  id: string;
  customer_name: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  total_price: number;
  deposit_paid: number;
  status: string;
  notes: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff_name?: string;
  breed_name?: string;
  service_name?: string;
  is_block?: boolean;
}

interface BookingEventProps {
  booking: BookingData;
  staffIndex: number;
  startHour: number;
  durationHours?: number;
}

export function BookingEvent({ booking, staffIndex, startHour, durationHours = 1 }: BookingEventProps) {
  const color = getStaffColor(staffIndex);
  const timeParts = booking.booking_time.split(":");
  const hour = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1] || "0");
  const topOffset = (hour - startHour + minutes / 60) * 64; // 64px per hour
  const height = durationHours * 64;

  if (booking.is_block) {
    return (
      <div
        className={cn("absolute left-1 right-1 rounded-md px-2 py-1 text-xs font-medium cursor-pointer z-10", color.bg, color.text)}
        style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "28px" }}
      >
        <p className="font-bold">Blocked</p>
        <p className="opacity-80">{booking.staff_name}</p>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "absolute left-1 right-1 rounded-md px-2 py-1 text-xs cursor-pointer z-10 overflow-hidden transition-opacity hover:opacity-90",
            color.bg, color.text
          )}
          style={{ top: `${topOffset}px`, height: `${height}px`, minHeight: "48px" }}
        >
          <p className="font-bold truncate">{booking.service_name || "Appointment"}</p>
          <p className="truncate">{booking.customer_name}</p>
          <p className="opacity-80 truncate">with {booking.staff_name}</p>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="right" align="start">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold", color.bg, color.text)}>
                {booking.customer_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold">{booking.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {booking.customer_email || ""}
                  {booking.customer_phone ? ` • ${booking.customer_phone}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Badge variant={booking.status === "Confirmed" ? "default" : booking.status === "Cancelled" ? "destructive" : "secondary"}>
              {booking.status}
            </Badge>
            <Badge variant={booking.deposit_paid > 0 ? "secondary" : "destructive"}>
              {booking.deposit_paid > 0 ? "PAID" : "NOT PAID"}
            </Badge>
          </div>

          <div className="text-sm space-y-1">
            <p>
              {format(new Date(booking.booking_date), "EEE, MMM d")} • {booking.booking_time.slice(0, 5)}
            </p>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium">{booking.service_name || "Service"} — {booking.breed_name || booking.dog_name}</p>
            <p className="text-sm text-muted-foreground">with {booking.staff_name}</p>
            <p className="text-sm font-medium mt-1">£{Number(booking.total_price).toFixed(2)}</p>
          </div>

          {booking.notes && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">{booking.notes}</p>
            </div>
          )}

          <div className="border-t pt-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm">Book Again</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
