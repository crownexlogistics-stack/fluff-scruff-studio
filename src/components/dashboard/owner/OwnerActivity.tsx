import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Panel, Section } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

const dotFor = (kind: string) =>
  kind === "cancelled" || kind === "noshow"
    ? "bg-destructive"
    : kind === "completed"
    ? "bg-success"
    : kind === "payment"
    ? "bg-primary"
    : "bg-muted-foreground/40";

export function OwnerActivity({ d }: { d: OwnerDashboard }) {
  return (
    <Section title="Recent activity" action={{ label: "All bookings", to: "/bookings" }}>
      <Panel className="p-2">
        {d.activity.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing has happened yet today.</p>
        ) : (
          d.activity.map((a) => (
            <Link
              key={a.id}
              to={a.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotFor(a.kind))} />
              <span className="text-sm truncate flex-1">{a.text}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {formatDistanceToNow(a.at, { addSuffix: true })}
              </span>
            </Link>
          ))
        )}
      </Panel>
    </Section>
  );
}
