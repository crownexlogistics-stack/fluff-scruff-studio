import { cn } from "@/lib/utils";
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
        "w-full touch-target rounded-xl p-6 text-left transition-all duration-300",
        "active:scale-[0.97] hover:shadow-lg",
        "flex items-center gap-4",
        gradient === "rose"
          ? "gradient-rose text-accent-foreground shadow-md shadow-rose-gold/20"
          : "gradient-navy text-primary-foreground shadow-md shadow-navy/20"
      )}
    >
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
        gradient === "rose" ? "bg-white/25" : "bg-white/15"
      )}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-lg font-semibold font-body">{title}</h3>
        <p className="text-sm opacity-80 mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}
