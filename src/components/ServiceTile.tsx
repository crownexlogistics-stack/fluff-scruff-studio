import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface ServiceTileProps {
  title: string;
  subtitle: string;
  image: string;
  onClick: () => void;
  reverse?: boolean;
}

export function ServiceTile({ title, subtitle, image, onClick, reverse = false }: ServiceTileProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl overflow-hidden transition-all duration-300",
        "bg-card border border-border hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10",
        "active:scale-[0.99] group flex",
        reverse ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Image half */}
      <div className="w-1/2 relative overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      {/* Text half */}
      <div className="w-1/2 p-5 sm:p-6 flex flex-col justify-center">
        <h3 className="text-lg sm:text-xl font-heading text-primary mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground font-body leading-relaxed">{subtitle}</p>
        <div className="mt-4 flex items-center gap-1 text-sm font-semibold font-body text-accent group-hover:gap-2 transition-all">
          Book now <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}
