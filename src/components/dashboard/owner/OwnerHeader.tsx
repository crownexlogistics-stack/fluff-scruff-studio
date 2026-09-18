import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { money } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

function greeting() {
  const h = new Date().getHours();
  if (h >= 18) return "Good evening";
  if (h >= 12) return "Good afternoon";
  return "Good morning";
}

export function OwnerHeader({ d }: { d: OwnerDashboard }) {
  const { today, ownerName } = d;

  const summary = (() => {
    if (today.count === 0) {
      return today.groomersWorking > 0
        ? `No appointments booked today, with ${today.groomersWorking} groomer${today.groomersWorking > 1 ? "s" : ""} on the schedule.`
        : "Nothing booked today and nobody scheduled in.";
    }
    const groomerPart =
      today.groomersWorking > 0
        ? ` across ${today.groomersWorking} groomer${today.groomersWorking > 1 ? "s" : ""}`
        : "";
    return `Today you have ${today.count} appointment${today.count === 1 ? "" : "s"}${groomerPart}, worth ${money(today.scheduledRevenue)} in scheduled work.`;
  })();

  const tiles = [
    { label: "Appointments today", value: today.count, to: "/bookings" },
    { label: "Scheduled today", value: money(today.scheduledRevenue), to: "/bookings" },
    { label: "Groomers working", value: today.groomersWorking, to: "/staff/schedule" },
    { label: "Still to collect today", value: money(today.expectedCollections), to: "/bookings" },
  ];

  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="font-heading text-[26px] md:text-4xl leading-tight">
            {greeting()}, {ownerName}.
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{summary}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{format(today.date, "EEEE d MMMM")}</p>
          <p className="text-[11px] text-muted-foreground">
            {d.lastUpdatedAt
              ? `Updated ${formatDistanceToNow(new Date(d.lastUpdatedAt), { addSuffix: true })}`
              : "Updating…"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/60 rounded-2xl overflow-hidden">
        {tiles.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className="bg-card px-4 py-4 md:px-5 md:py-5 transition-colors hover:bg-muted/40"
          >
            <p className="font-heading text-2xl md:text-3xl leading-none">{t.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mt-2">
              {t.label}
            </p>
          </Link>
        ))}
      </div>
    </header>
  );
}
