import { ChevronRight, PawPrint, Move } from "lucide-react";
import { useState, useRef, useCallback } from "react";

interface ServiceJourneyProps {
  services: {
    title: string;
    subtitle: string;
    image: string;
    imagePosition?: string;
  }[];
  onSelectService: (title: string) => void;
}

// ⚡ TEMPORARY: Set to true to enable image position adjustment mode
const ADJUST_MODE = true;

export function ServiceJourney({ services, onSelectService }: ServiceJourneyProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const initial: Record<string, { x: number; y: number }> = {};
    services.forEach((s) => {
      if (s.imagePosition) {
        const parts = s.imagePosition.split(/\s+/);
        initial[s.title] = {
          x: parseInt(parts[0]) || 50,
          y: parseInt(parts[1]) || 50,
        };
      } else {
        initial[s.title] = { x: 50, y: 50 };
      }
    });
    return initial;
  });

  const dragging = useRef<string | null>(null);
  const startPos = useRef({ clientY: 0, clientX: 0, startX: 50, startY: 50 });

  const handlePointerDown = useCallback((title: string, e: React.PointerEvent) => {
    if (!ADJUST_MODE) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = title;
    const pos = positions[title] || { x: 50, y: 50 };
    startPos.current = { clientX: e.clientX, clientY: e.clientY, startX: pos.x, startY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPos.current.clientX;
    const dy = e.clientY - startPos.current.clientY;
    // Invert: dragging right moves object-position left
    const newX = Math.max(0, Math.min(100, startPos.current.startX - dx * 0.3));
    const newY = Math.max(0, Math.min(100, startPos.current.startY - dy * 0.3));
    setPositions((prev) => ({ ...prev, [dragging.current!]: { x: Math.round(newX), y: Math.round(newY) } }));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragging.current) {
      // Log the final position so user can tell us
      const title = dragging.current;
      const pos = positions[title];
      console.log(`📍 "${title}" → objectPosition: "${pos?.x}% ${pos?.y}%"`);
    }
    dragging.current = null;
  }, [positions]);

  return (
    <section id="services" className="relative py-16 sm:py-24 lg:py-32 bg-background overflow-hidden">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16 lg:mb-20">
          <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
            <PawPrint className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            <p className="text-accent font-body text-xs sm:text-sm uppercase tracking-[0.25em]">
              Our Services
            </p>
            <PawPrint className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-heading text-foreground leading-tight">
            The Grooming Journey
          </h2>
          <p className="text-muted-foreground font-body mt-2 sm:mt-3 text-sm sm:text-base max-w-md mx-auto">
            From first bath to final bow-tie — every visit is an adventure.
          </p>
          <div className="w-10 sm:w-12 h-[2px] bg-accent/40 mx-auto mt-4 sm:mt-5 rounded-full" />
        </div>

        {/* Adjust mode banner */}
        {ADJUST_MODE && (
          <div className="mb-6 p-4 rounded-2xl bg-accent/10 border border-accent/30 text-center">
            <p className="text-sm font-body font-semibold text-foreground flex items-center justify-center gap-2">
              <Move className="h-4 w-4 text-accent" />
              Image Adjustment Mode — Drag images to reposition them
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Positions are logged to the console. Tell me when you're happy with each one!
            </p>
          </div>
        )}

        {/* Journey Items */}
        <div className="grid sm:grid-cols-2 gap-5 sm:gap-8 max-w-4xl mx-auto">
          {services.map((service) => {
            const pos = positions[service.title] || { x: 50, y: 50 };
            return (
              <div
                key={service.title}
                className="text-left group transition-colors duration-300"
              >
                <div className="relative bg-card rounded-3xl overflow-hidden border border-border/40 transition-[box-shadow,border-color,transform] duration-500 hover:shadow-xl hover:shadow-black/[0.06] hover:border-border/60 hover:-translate-y-1 active:scale-[0.98] shadow-md shadow-black/[0.03]">
                  {/* Image */}
                  <div
                    className="relative overflow-hidden bg-card select-none"
                    style={{ touchAction: ADJUST_MODE ? 'none' : 'auto', cursor: ADJUST_MODE ? 'grab' : 'pointer' }}
                    onPointerDown={(e) => handlePointerDown(service.title, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  >
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full aspect-[4/3] sm:aspect-[4/3] object-cover block pointer-events-none"
                      style={{
                        objectPosition: `${pos.x}% ${pos.y}%`,
                        maxHeight: '220px',
                      }}
                      draggable={false}
                    />
                    {/* Position indicator in adjust mode */}
                    {ADJUST_MODE && (
                      <div className="absolute top-3 right-3 bg-foreground/80 text-background text-xs font-mono px-2.5 py-1 rounded-full backdrop-blur-sm">
                        {pos.x}% {pos.y}%
                      </div>
                    )}
                    {/* Gradient fade into card */}
                    <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
                  </div>

                  {/* Text — clickable to book */}
                  <button
                    onClick={() => onSelectService(service.title)}
                    className="relative z-10 -mt-px bg-card px-5 pb-5 pt-1.5 sm:px-8 sm:pb-8 sm:pt-2 w-full text-left"
                  >
                    <h3 className="text-xl sm:text-2xl font-heading text-foreground mb-1.5 sm:mb-2 group-hover:text-accent transition-colors duration-300">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground font-body text-sm leading-relaxed mb-3 sm:mb-4">
                      {service.subtitle}
                    </p>
                    <div className="flex items-center gap-2 text-charcoal font-body text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                      Book this treat
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
