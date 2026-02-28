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

        {/* Journey Items */}
        <div className="grid sm:grid-cols-2 gap-5 sm:gap-8 max-w-4xl mx-auto">
          {services.map((service) => (
            <button
              key={service.title}
              onClick={() => onSelectService(service.title)}
              className="text-left group transition-colors duration-300"
            >
              <div className="relative bg-card rounded-3xl overflow-hidden border border-border/40 transition-[box-shadow,border-color,transform] duration-500 hover:shadow-xl hover:shadow-black/[0.06] hover:border-border/60 hover:-translate-y-1 active:scale-[0.98] shadow-md shadow-black/[0.03]">
                {/* Image */}
                <div className="relative overflow-hidden bg-card">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full aspect-[4/3] sm:aspect-[4/3] object-cover block"
                    style={{
                      ...(service.imagePosition ? { objectPosition: service.imagePosition } : {}),
                      maxHeight: '220px',
                    }}
                  />
                  {/* Gradient fade into card */}
                  <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
                </div>

                {/* Text */}
                <div className="relative z-10 -mt-px bg-card px-5 pb-5 pt-1.5 sm:px-8 sm:pb-8 sm:pt-2">
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
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
