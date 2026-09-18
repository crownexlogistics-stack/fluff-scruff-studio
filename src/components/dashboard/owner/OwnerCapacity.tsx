import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { money, Panel, Section } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

export function OwnerCapacity({ d }: { d: OwnerDashboard }) {
  const w = d.week;
  const max = Math.max(1, ...w.days.map((x) => x.count));

  return (
    <Section
      title="This week"
      hint={`${w.appointments} appointments · ${money(w.revenue)} booked${
        w.utilisation !== null ? ` · ${w.utilisation}% of groomer time filled` : ""
      }`}
      action={{ label: "Open calendar", to: "/bookings" }}
    >
      <Panel className="p-4 md:p-5">
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {w.days.map((day) => {
            const height = day.open ? Math.max(6, (day.count / max) * 100) : 0;
            const fill =
              day.availableMinutes > 0 ? Math.round((day.bookedMinutes / day.availableMinutes) * 100) : null;
            return (
              <Link
                key={day.date.toISOString()}
                to="/bookings"
                className={cn(
                  "group rounded-xl p-2 md:p-3 text-center transition-colors",
                  day.isToday ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    day.isToday ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {format(day.date, "EEE")}
                </p>
                <div className="h-16 md:h-20 flex items-end justify-center mt-2">
                  <div
                    className={cn(
                      "w-5 md:w-7 rounded-md transition-all",
                      !day.open ? "bg-muted" : day.isToday ? "bg-primary" : "bg-primary/45",
                    )}
                    style={{ height: day.open ? `${height}%` : "4px" }}
                  />
                </div>
                <p className="font-heading text-base md:text-lg mt-2 leading-none">{day.open ? day.count : "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {!day.open ? "Closed" : fill !== null ? `${fill}% full` : `${day.workingStaff} in`}
                </p>
              </Link>
            );
          })}
        </div>
        {w.availableHours > 0 && (
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/60">
            {w.availableHours} groomer hours still unbooked this week.
          </p>
        )}
      </Panel>
    </Section>
  );
}

export function OwnerForward({ d }: { d: OwnerDashboard }) {
  const f = d.forward;
  return (
    <Section title="What's coming" action={{ label: "Open calendar", to: "/bookings" }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Next 30 days</p>
          <p className="font-heading text-3xl mt-1.5">{f.next30Count}</p>
          <p className="text-sm text-muted-foreground mt-1">
            appointments booked, worth {money(f.next30Revenue)} of future work.
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{f.nextMonthName}</p>
          <p className="font-heading text-3xl mt-1.5">{f.nextMonthCount}</p>
          <p className="text-sm text-muted-foreground mt-1">
            booked so far, worth {money(f.nextMonthRevenue)}.
            {f.avgMonthlyAppointments !== null && (
              <>
                {" "}
                A normal month is around {f.avgMonthlyAppointments}.{" "}
                <span
                  className={
                    f.nextMonthHealth === "healthy" ? "text-success font-semibold" : "text-warning font-semibold"
                  }
                >
                  {f.nextMonthHealth === "healthy" ? "Filling nicely." : "Quieter than usual."}
                </span>
              </>
            )}
          </p>
        </Panel>
      </div>
    </Section>
  );
}
