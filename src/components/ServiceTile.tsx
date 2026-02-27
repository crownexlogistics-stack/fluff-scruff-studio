import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ServiceTileProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onClick: () => void;
  gradient?: "rose" | "navy";
}

export function ServiceTile({ title, subtitle, icon: Icon, onClick, gradient = "rose" }: ServiceTileProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl p-6 text-left transition-all duration-200",
        "bg-card border border-border hover:border-accent hover:shadow-lg hover:shadow-accent/10",
        "active:scale-[0.98] group"
      )}
    >
      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl mb-4",
        gradient === "rose" ? "bg-accent/10" : "bg-primary/10"
      )}>
        <Icon className={cn(
          "h-6 w-6",
          gradient === "rose" ? "text-accent" : "text-primary"
        )} />
      </div>
      <h3 className="text-base font-semibold font-body text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
        Book now <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}
