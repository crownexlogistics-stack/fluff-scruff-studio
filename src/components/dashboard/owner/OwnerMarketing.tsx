import { Panel, Section } from "./primitives";
import type { OwnerDashboard } from "@/hooks/useOwnerDashboard";

export function OwnerMarketing({ d }: { d: OwnerDashboard }) {
  const mk = d.marketing;
  const items = [
    mk.visitors !== null ? { label: "Website visitors", value: mk.visitors.toLocaleString("en-GB") } : null,
    { label: "Booked online", value: mk.onlineBookings },
    mk.conversion !== null ? { label: "Visitors who booked", value: `${mk.conversion}%` } : null,
  ].filter(Boolean) as { label: string; value: string | number }[];

  return (
    <Section title="Marketing" hint={`${d.money.monthName} so far`} action={{ label: "Marketing", to: "/marketing" }}>
      <Panel className="p-5">
        <div className="grid grid-cols-3 gap-4">
          {items.map((i) => (
            <div key={i.label}>
              <p className="font-heading text-xl md:text-2xl leading-none">{i.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mt-1.5">
                {i.label}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </Section>
  );
}
