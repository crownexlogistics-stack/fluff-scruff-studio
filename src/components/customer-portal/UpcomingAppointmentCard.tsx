import { useEffect, useState } from "react";
import { format, parseISO, differenceInSeconds, isPast } from "date-fns";
import { CalendarCheck, Clock, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Booking {
  id: string;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  services?: { name: string } | null;
  staff?: { name: string } | null;
}

interface UpcomingAppointmentCardProps {
  booking: Booking | null;
}

function formatCountdown(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function UpcomingAppointmentCard({ booking }: UpcomingAppointmentCardProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!booking) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-5 text-center">
        <CalendarCheck className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground font-body">No upcoming appointments</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Book your next groom to see it here!</p>
      </div>
    );
  }

  const appointmentDate = parseISO(`${booking.booking_date}T${booking.booking_time || "09:00:00"}`);
  const secondsUntil = Math.max(0, differenceInSeconds(appointmentDate, now));
  const isToday = secondsUntil < 86400 && secondsUntil > 0;
  const serviceName = (booking.services as any)?.name || "Grooming";
  const staffName = (booking.staff as any)?.name;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
      isToday
        ? "border-accent/40 bg-gradient-to-br from-accent/5 via-card to-accent/5 shadow-lg shadow-accent/10"
        : "border-border/50 bg-card shadow-sm"
    }`}>
      {isToday && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -translate-y-8 translate-x-8" />
      )}
      
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold font-body text-foreground">Upcoming Appointment</h3>
        {isToday && (
          <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px] ml-auto">Today!</Badge>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-lg font-heading font-bold text-foreground">{serviceName}</p>
        <p className="text-sm text-foreground/80">for {booking.dog_name}</p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarCheck className="h-3.5 w-3.5" />
            {format(parseISO(booking.booking_date), "EEE d MMM")}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {booking.booking_time?.slice(0, 5)}
          </span>
          {staffName && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {staffName}
            </span>
          )}
        </div>
      </div>

      {/* Countdown Timer */}
      {secondsUntil > 0 && (
        <div className={`mt-4 rounded-xl p-3 text-center ${
          isToday ? "bg-accent/10" : "bg-muted/50"
        }`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-1">Countdown</p>
          <p className={`text-xl font-heading font-bold tabular-nums ${
            isToday ? "text-accent" : "text-foreground"
          }`}>
            {formatCountdown(secondsUntil)}
          </p>
        </div>
      )}
    </div>
  );
}
