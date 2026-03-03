import { format, differenceInDays, isPast, isToday } from "date-fns";
import { CalendarCheck, Clock, RotateCcw, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Booking {
  id: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  services?: { name: string } | null;
  service_id?: string | null;
  breed_id?: string | null;
  staff?: { name: string } | null;
}

interface BookingTimelineProps {
  bookings: Booking[];
}

export function BookingTimeline({ bookings }: BookingTimelineProps) {
  const navigate = useNavigate();

  const getStatusConfig = (booking: Booking) => {
    const bookingDate = new Date(booking.booking_date);
    const daysUntil = differenceInDays(bookingDate, new Date());
    const isFuture = !isPast(bookingDate) || isToday(bookingDate);

    switch (booking.status) {
      case "Confirmed":
      case "Pending":
        if (isFuture) {
          const countdown = isToday(bookingDate)
            ? "Today! 🎉"
            : daysUntil === 1
            ? "Tomorrow!"
            : `${daysUntil} days to go!`;
          return {
            icon: <Clock className="h-4 w-4" />,
            color: "border-green-400 bg-green-50 dark:bg-green-950/20",
            dotColor: "bg-green-400 ring-green-100",
            badge: <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px] gap-1">{countdown}</Badge>,
          };
        }
        return {
          icon: <CalendarCheck className="h-4 w-4" />,
          color: "border-muted bg-muted/30",
          dotColor: "bg-muted-foreground/40 ring-muted",
          badge: <Badge variant="secondary" className="text-[10px]">{booking.status}</Badge>,
        };
      case "Completed":
        return {
          icon: <CalendarCheck className="h-4 w-4" />,
          color: "border-muted bg-muted/20",
          dotColor: "bg-muted-foreground/30 ring-muted",
          badge: <Badge variant="secondary" className="text-[10px] gap-1"><CalendarCheck className="h-3 w-3" /> Complete</Badge>,
          showRebook: true,
        };
      case "Cancelled":
      case "Refunded":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "border-destructive/20 bg-destructive/5",
          dotColor: "bg-destructive/50 ring-destructive/10",
          badge: <Badge variant="destructive" className="text-[10px] gap-1">
            <XCircle className="h-3 w-3" /> {booking.status === "Refunded" ? "Refunded & Cancelled" : "Cancelled"}
          </Badge>,
        };
      case "No Show":
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "border-orange-300 bg-orange-50 dark:bg-orange-950/20",
          dotColor: "bg-orange-400 ring-orange-100",
          badge: <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> No Show</Badge>,
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "border-muted bg-muted/20",
          dotColor: "bg-muted-foreground/30 ring-muted",
          badge: <Badge variant="secondary" className="text-[10px]">{booking.status}</Badge>,
        };
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-accent" />
        Groom Timeline
      </h3>

      {bookings.length === 0 ? (
        <div className="text-center py-8">
          <CalendarCheck className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No bookings yet</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/book")}>
            Book First Groom
          </Button>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-3 bottom-3 w-px bg-border" />
          
          <div className="space-y-0">
            {bookings.map((booking, idx) => {
              const config = getStatusConfig(booking);
              return (
                <div key={booking.id} className="relative flex gap-4 pb-4">
                  {/* Dot */}
                  <div className={`w-[38px] h-[38px] rounded-full ${config.dotColor} ring-4 flex items-center justify-center shrink-0 z-10`}>
                    {config.icon}
                  </div>

                  {/* Card */}
                  <div className={`flex-1 rounded-xl border p-3 ${config.color} transition-colors`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {(booking.services as any)?.name || "Grooming"} — {booking.dog_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(booking.booking_date), "EEE d MMM yyyy")} at {booking.booking_time?.slice(0, 5)}
                          {(booking.staff as any)?.name && ` • ${(booking.staff as any).name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {config.badge}
                      </div>
                    </div>
                    {(config as any).showRebook && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 text-xs text-accent hover:text-accent gap-1"
                        onClick={() => {
                          const params = new URLSearchParams();
                          const serviceName = (booking.services as any)?.name;
                          if (serviceName) params.set("service", serviceName);
                          if (booking.dog_name) params.set("dogName", booking.dog_name);
                          if (booking.breed_id) params.set("breedId", booking.breed_id);
                          navigate(`/book?${params.toString()}`);
                        }}
                      >
                        <RotateCcw className="h-3 w-3" /> Rebook this Groom
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
