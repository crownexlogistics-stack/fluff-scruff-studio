import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, Section } from "./primitives";
import type { Alert } from "@/hooks/useOwnerDashboard";

const toneFor = (severity: Alert["severity"]) =>
  severity === "urgent"
    ? { dot: "bg-destructive", text: "text-destructive", ring: "bg-destructive/5" }
    : severity === "attention"
    ? { dot: "bg-warning", text: "text-warning", ring: "bg-warning/5" }
    : { dot: "bg-muted-foreground", text: "text-muted-foreground", ring: "bg-muted/40" };

export function OwnerAttention({ alerts }: { alerts: Alert[] }) {
  const urgent = alerts.filter((a) => a.severity === "urgent").length;

  return (
    <Section
      title="Needs your attention"
      hint={
        alerts.length === 0
          ? undefined
          : `${alerts.length} item${alerts.length > 1 ? "s" : ""}${urgent > 0 ? ` · ${urgent} urgent` : ""}`
      }
    >
      {alerts.length === 0 ? (
        <Panel className="p-5 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Everything looks good</p>
            <p className="text-sm text-muted-foreground">No urgent actions right now.</p>
          </div>
        </Panel>
      ) : (
        <Panel className="divide-y divide-border/60 overflow-hidden">
          {alerts.map((a) => {
            const tone = toneFor(a.severity);
            return (
              <div key={a.id} className={cn("flex items-start gap-3 p-4 md:p-5", a.severity === "urgent" && tone.ring)}>
                <span className="mt-1.5 shrink-0">
                  {a.severity === "info" ? (
                    <Info className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <AlertTriangle className={cn("h-4 w-4", tone.text)} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.detail}</p>
                </div>
                <Link
                  to={a.href}
                  className="shrink-0 self-center text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  {a.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </Panel>
      )}
    </Section>
  );
}
