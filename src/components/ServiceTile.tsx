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
        "w-full touch-target rounded-2xl p-5 text-left transition-all duration-300",
        "active:scale-[0.97] hover:brightness-110",
        "flex items-center gap-4",
        "glass-dark"
      )}
    >
      <div className={cn(
        "flex h-13 w-13 shrink-0 items-center justify-center rounded-xl",
        gradient === "rose" ? "bg-rose-gold/15" : "bg-navy-light/30"
      )}>
        <Icon className={cn(
          "h-6 w-6",
          gradient === "rose" ? "text-rose-gold" : "text-navy-light"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold font-body text-white/90">{title}</h3>
        <p className="text-sm text-white/45 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
    </button>
  );
}
