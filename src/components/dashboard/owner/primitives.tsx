import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `£${Math.round(Number(n)).toLocaleString("en-GB")}`;

/** Section wrapper — hierarchy comes from typography and space, not boxes. */
export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: string;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground/80 mt-0.5">{hint}</p>}
        </div>
        {action && (
          <Link
            to={action.to}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
          >
            {action.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Flat panel — subtle surface, no heavy borders. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-card border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  to,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  to?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-success"
      : tone === "warn"
      ? "text-warning"
      : tone === "bad"
      ? "text-destructive"
      : "text-foreground";

  const body = (
    <>
      <p className={cn("font-heading text-2xl md:text-[28px] leading-none", toneClass)}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mt-2">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="block rounded-xl -m-1 p-1 transition-colors hover:bg-muted/50">
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}

export function Row({
  label,
  value,
  strong,
  tone = "neutral",
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  tone?: "neutral" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-success"
      : tone === "warn"
      ? "text-warning"
      : tone === "bad"
      ? "text-destructive"
      : "";
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "border-t border-border/60 pt-2.5 mt-1")}>
      <span className={cn("text-sm text-muted-foreground", strong && "font-semibold text-foreground")}>
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground/70 font-normal">{hint}</span>}
      </span>
      <span className={cn("text-sm tabular-nums shrink-0", strong ? "font-bold text-base" : "font-semibold", toneClass)}>
        {value}
      </span>
    </div>
  );
}
