import { ChevronRight, PawPrint } from "lucide-react";

interface ServiceJourneyProps {
  services: {
    title: string;
    subtitle: string;
    image: string;
    imagePosition?: string;
  }[];
  onSelectService: (title: string) => void;
}

export function ServiceJourney({ services, onSelectService }: ServiceJourneyProps) {
  return (
    <section id="services" className="relative py-10 sm:py-16 bg-background overflow-hidden">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
            🐾 Our Services 🐾
          </p>
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-heading text-foreground leading-tight">
            What does your pup need today?
          </h2>
          <p className="text-muted-foreground font-body mt-1 text-sm max-w-md mx-auto">
            From a full glam makeover to a quick tidy-up ✂️
          </p>
        </div>

        {/* Service Cards — horizontal layout */}
        <div className="space-y-4 max-w-lg mx-auto">
          {services.map((service) => (
            <button
              key={service.title}
              onClick={() => onSelectService(service.title)}
              className="w-full text-left group transition-all duration-300"
            >
              <div
                className="flex overflow-hidden bg-card hover:shadow-lg transition-all duration-300 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                style={{ borderRadius: '24px' }}
              >
                {/* Image LEFT */}
                <div className="relative w-[110px] shrink-0 overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover"
                    style={{
                      ...(service.imagePosition ? { objectPosition: service.imagePosition } : {}),
                      minHeight: '120px',
                    }}
                  />
                  {/* Curved white cutout */}
                  <div
                    className="absolute inset-y-0 right-0 w-6 bg-card"
                    style={{ borderRadius: '50% 0 0 50% / 100% 0 0 100%' }}
                  />
                </div>
                {/* Text RIGHT */}
                <div className="flex-1 py-3 pr-4 pl-1 flex flex-col justify-center min-w-0">
                  <h3 className="text-base sm:text-lg font-heading text-foreground mb-0.5 group-hover:text-accent transition-colors truncate">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground font-body text-xs leading-relaxed line-clamp-2 mb-1.5">
                    {service.subtitle}
                  </p>
                  <span className="text-accent font-body text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Book this treat <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
