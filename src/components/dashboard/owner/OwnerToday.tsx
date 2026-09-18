import { Link } from "react-router-dom";
import { money, Panel, Section } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

export function OwnerToday({ d }: { d: OwnerDashboard }) {
  const t = d.today;

  const items: { label: string; value: string | number; tone?: "bad" | "warn" }[] = [
    { label: "Appointments", value: t.count },
    { label: "Scheduled work", value: money(t.scheduledRevenue) },
    { label: "Taken in salon", value: money(t.collected) },
    { label: "Groomers in", value: t.groomersWorking },
    { label: "Free time left", value: `${t.availableHours}h` },
    { label: "Cancelled", value: t.cancellations, tone: t.cancellations > 0 ? "warn" : undefined },
    { label: "No shows", value: t.noShows, tone: t.noShows > 0 ? "bad" : undefined },
  ];

  return (
    <Section title="Today" action={{ label: "Open bookings", to: "/bookings" }}>
      <Panel className="p-4 md:p-5">
        <div className="grid grid-cols-3 md:grid-cols-7 gap-4">
          {items.map((i) => (
            <div key={i.label}>
              <p
                className={
                  "font-heading text-xl md:text-2xl leading-none " +
                  (i.tone === "bad" ? "text-destructive" : i.tone === "warn" ? "text-warning" : "")
                }
              >
                {i.value}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mt-1.5">
                {i.label}
              </p>
            </div>
          ))}
        </div>

        {t.appointments.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border/60 space-y-1">
            {t.appointments
              .slice()
              .sort((a: any, b: any) => (a.booking_time || "").localeCompare(b.booking_time || ""))
              .slice(0, 6)
              .map((b: any) => (
                <Link
                  key={b.id}
                  to={`/bookings?highlight=${b.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs font-semibold tabular-nums w-12 shrink-0">
                    {(b.booking_time || "").slice(0, 5)}
                  </span>
                  <span className="text-sm truncate flex-1">
                    {b.customer_name}
                    {b.dog_name ? ` · ${b.dog_name}` : ""}
                    <span className="text-muted-foreground">
                      {b.staff?.name ? ` — ${b.staff.name}` : " — no groomer"}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {money(Number(b.total_price || 0))}
                  </span>
                </Link>
              ))}
            {t.appointments.length > 6 && (
              <Link to="/bookings" className="block text-xs font-semibold text-primary pt-1 hover:underline">
                See all {t.appointments.length} appointments
              </Link>
            )}
          </div>
        )}
      </Panel>
    </Section>
  );
}
