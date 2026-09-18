import { formatDistanceToNow } from "date-fns";
import { money, Panel, Row, Section } from "./primitives";
import { cn } from "@/lib/utils";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

export function OwnerMoney({ d }: { d: OwnerDashboard }) {
  const m = d.money;

  const statusText =
    m.status === "green"
      ? `On track to finish ${m.monthName} ${money(m.projectedResult)} ahead.`
      : `Forecast ${money(Math.abs(m.projectedResult))} short of break-even in ${m.monthName}.`;

  const statusClass =
    m.status === "green"
      ? "text-success"
      : m.status === "amber"
      ? "text-warning"
      : "text-destructive";

  return (
    <Section title="Money" action={{ label: "View finance", to: "/finance" }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash position */}
        <Panel className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Cash in the bank
          </p>
          <p className="font-heading text-3xl mt-1.5">{money(m.bankBalance)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {m.bankNotedAt
              ? `Last entered ${formatDistanceToNow(m.bankNotedAt, { addSuffix: true })}`
              : "No balance recorded yet — add one in Finance"}
          </p>

          <div className="mt-4 pt-3 border-t border-border/60">
            <Row label="Bills due in the next 7 days" value={money(m.billsDueThisWeek)} />
            <Row
              label="Balance after those bills"
              value={money(m.balanceAfterBills)}
              strong
              tone={m.balanceAfterBills !== null && m.balanceAfterBills < 0 ? "bad" : "good"}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-border/60">
            <Row
              label="Cash received this month"
              hint="Money actually banked — online and card machine"
              value={money(m.cashReceived)}
            />
            <Row
              label="Still owed by customers"
              hint="Appointments finished but not fully paid"
              value={money(m.outstandingFromCompleted)}
              tone={m.outstandingFromCompleted > 0 ? "warn" : "neutral"}
            />
          </div>
        </Panel>

        {/* Month position */}
        <Panel className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {m.monthName} — how the month is shaping up
          </p>
          <div className="mt-2">
            <Row
              label="Revenue earned so far"
              hint="Appointments that have already happened"
              value={money(m.revenueEarned)}
            />
            <Row
              label="Confirmed still to come"
              hint="Booked appointments left this month"
              value={money(m.futureBookedRevenue)}
            />
            <Row label="Groomer pay earned" value={money(m.groomerPayEarned)} />
            <Row
              label="Groomer pay still to come"
              hint="Estimated from confirmed appointments"
              value={money(m.groomerPayProjected)}
            />
            <Row label="Bills paid" value={money(m.billsPaid)} />
            <Row label="Bills left to pay" value={money(m.billsRemaining)} />
            <Row
              label="Projected month-end result"
              value={`${m.projectedResult >= 0 ? "+" : "−"}${money(Math.abs(m.projectedResult))}`}
              strong
              tone={m.status === "green" ? "good" : m.status === "amber" ? "warn" : "bad"}
            />
          </div>
          <div className={cn("mt-3 flex items-center gap-2 text-sm font-semibold", statusClass)}>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                m.status === "green" ? "bg-success" : m.status === "amber" ? "bg-warning" : "bg-destructive",
              )}
            />
            {statusText}
          </div>
        </Panel>
      </div>
    </Section>
  );
}
