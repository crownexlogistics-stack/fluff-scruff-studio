import { format, isToday } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money, Panel, Row, Section } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";
import { BankBalanceDialog, BankBalanceHistory } from "./BankBalanceDialog";

export function OwnerMoney({ d }: { d: OwnerDashboard }) {
  const m = d.money;
  const [updateOpen, setUpdateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <Section title="Current cash position" action={{ label: "View finance", to: "/finance" }}>
      <div>
        {/* Cash position */}
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Cash in the bank</p>
              {m.bankBalance === null ? (
                <><p className="font-heading text-xl mt-2">Bank balance not entered</p><p className="text-xs text-muted-foreground mt-1">Enter your current bank balance to see your real cash position.</p></>
              ) : (
                <><p className="font-heading text-3xl mt-1.5">{money(m.bankBalance)}</p><p className="text-[11px] text-muted-foreground mt-1">Last updated: {m.bankNotedAt ? `${isToday(m.bankNotedAt) ? "Today" : format(m.bankNotedAt, "d MMM yyyy")} at ${format(m.bankNotedAt, "HH:mm")}${m.bankNotedBy ? ` by ${m.bankNotedBy}` : ""}` : "Unknown"}</p></>
              )}
            </div>
            <Button size="sm" onClick={() => setUpdateOpen(true)}>Update bank balance</Button>
          </div>

          {m.bankBalance !== null && <div className="mt-4 pt-3 border-t border-border/60">
            <Row label="Bills due in the next 7 days" value={money(m.billsDueThisWeek)} />
            <Row
              label="Balance after those bills"
              value={money(m.balanceAfterBills)}
              strong
              tone={m.balanceAfterBills !== null && m.balanceAfterBills < 0 ? "bad" : "good"}
            />
          </div>}

          <Button variant="link" size="sm" className="px-0 mt-2" onClick={() => setHistoryOpen(true)}>View balance history</Button>

        </Panel>
      </div>
      <BankBalanceDialog open={updateOpen} onOpenChange={setUpdateOpen} ownerName={d.ownerName} />
      <BankBalanceHistory open={historyOpen} onOpenChange={setHistoryOpen} />
    </Section>
  );
}
