import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { money, Panel, Section } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

export function OwnerTeam({ d }: { d: OwnerDashboard }) {
  const team = d.team;

  return (
    <Section title="Team" hint={`${d.money.monthName} so far`} action={{ label: "Staff", to: "/staff" }}>
      <Panel className="overflow-hidden">
        {team.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No groomer activity recorded this month yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {team.map((t) => (
              <Link
                key={t.id}
                to={`/staff/${t.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    t.workingToday ? "bg-success" : "bg-muted-foreground/30",
                  )}
                  title={t.workingToday ? "Working today" : "Not in today"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.workingToday ? `${t.todayCount} in today` : "Not in today"}
                    {t.cancellationRate !== null && ` · ${t.cancellationRate}% cancelled`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{money(t.revenue)}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {t.completed} done · {money(t.groomerPay)} pay
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </Section>
  );
}
