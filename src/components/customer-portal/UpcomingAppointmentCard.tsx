import { useEffect, useState } from "react";
import { format, parseISO, differenceInSeconds } from "date-fns";

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

export function UpcomingAppointmentCard({ booking }: UpcomingAppointmentCardProps) {
  if (!booking) {
    return (
      <div className="rounded-[20px] bg-muted/50 p-5 text-center">
        <p className="text-sm text-muted-foreground font-body">No upcoming appointments</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Book your next groom to see it here!</p>
      </div>
    );
  }

  const appointmentDate = parseISO(booking.booking_date);
  const serviceName = (booking.services as any)?.name || "Grooming";
  const staffName = (booking.staff as any)?.name;
  const dayNum = format(appointmentDate, "d");
  const monthStr = format(appointmentDate, "MMM").toUpperCase();
  const timeStr = booking.booking_time?.slice(0, 5);

  return (
    <div className="rounded-[20px] bg-accent p-5 text-accent-foreground">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] font-body font-bold opacity-90 mb-1">
            ⏰ Next Appointment
          </p>
          <p className="text-xl font-heading font-bold leading-tight">{serviceName}</p>
          <p className="text-[13px] font-body opacity-90 mt-1">
            {booking.dog_name}
            {staffName && ` · with ${staffName}`}
            {timeStr && ` · ${timeStr}`}
          </p>
        </div>
        <div className="shrink-0 ml-4 w-16 h-16 rounded-2xl bg-card flex flex-col items-center justify-center">
          <span className="text-2xl font-heading font-bold text-foreground leading-none">{dayNum}</span>
          <span className="text-[10px] font-body font-bold text-muted-foreground uppercase">{monthStr}</span>
        </div>
      </div>
    </div>
  );
}
