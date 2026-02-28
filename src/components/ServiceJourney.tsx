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
    <section id="services" className="relative py-24 sm:py-32 bg-background overflow-hidden">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16 sm:mb-20">
          <div className="flex items-center justify-center gap-2 mb-4">
            <PawPrint className="h-5 w-5 text-accent" />
            <p className="text-accent font-body text-sm uppercase tracking-[0.25em]">
              Our Services
            </p>
            <PawPrint className="h-5 w-5 text-accent" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-foreground leading-tight">
            The Grooming Journey
          </h2>
          <p className="text-muted-foreground font-body mt-3 max-w-md mx-auto">
            From first bath to final bow-tie — every visit is an adventure.
          </p>
          <div className="w-12 h-[2px] bg-accent/40 mx-auto mt-5 rounded-full" />
        </div>

        {/* Journey Items */}
        <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {services.map((service) => (
            <button
              key={service.title}
              onClick={() => onSelectService(service.title)}
              className="text-left group active:scale-[0.98] transition-all duration-300"
            >
              <div className="relative bg-card rounded-3xl overflow-hidden border border-border/40 transition-all duration-500 hover:shadow-xl hover:shadow-black/[0.06] hover:border-border/60 hover:-translate-y-1 shadow-md shadow-black/[0.03]">
                {/* Image */}
                <div className="relative overflow-hidden bg-card">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full aspect-[4/3] object-cover transition-opacity duration-500 group-hover:opacity-95 block"
                    style={service.imagePosition ? { objectPosition: service.imagePosition } : undefined}
                  />
                  {/* Gradient fade into card */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-card via-card/70 to-transparent pointer-events-none" />
                </div>

                {/* Text */}
                <div className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
                  <h3 className="text-2xl font-heading text-foreground mb-2 group-hover:text-accent transition-colors duration-300">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground font-body text-sm leading-relaxed mb-4">
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
