import { Scissors, ChevronRight, PawPrint } from "lucide-react";

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
    <section id="services" className="relative py-20 sm:py-28 bg-background overflow-hidden">
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
        <div className="relative">
          {/* Warm vertical path */}
          <div className="absolute left-[28%] sm:left-[30%] top-0 bottom-0 w-px hidden md:block">
            <div className="w-full h-full bg-gradient-to-b from-transparent via-accent/25 to-transparent" />
          </div>

          {services.map((service, index) => (
            <div key={service.title}>
              {/* Service Item */}
              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
                {/* Photo Side — Left */}
                <div className="w-full md:w-[55%] relative">
                  <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-accent/10 group">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-700"
                      style={service.imagePosition ? { objectPosition: service.imagePosition } : undefined}
                    />
                    {/* Warm overlay on hover */}
                    <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/5 transition-colors duration-500" />
                  </div>
                </div>

                {/* Card — Right */}
                <div className="w-full md:w-[45%]">
                  <button
                    onClick={() => onSelectService(service.title)}
                    className="w-full text-left group"
                  >
                    <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10 hover:border-accent/20">
                      <h3 className="text-2xl sm:text-3xl font-heading text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                        {service.title}
                      </h3>
                      <p className="text-muted-foreground font-body text-sm sm:text-base leading-relaxed mb-5">
                        {service.subtitle}
                      </p>
                      <div className="flex items-center gap-2 text-accent font-body text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                        Book this treat
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Scissors Divider with paw prints */}
              {index < services.length - 1 && (
                <div className="flex items-center justify-center my-10 sm:my-14">
                  <div className="h-px w-10 bg-gradient-to-r from-transparent to-accent/20" />
                  <PawPrint className="h-3 w-3 text-accent/30 mx-1" />
                  <div className="mx-3 flex items-center justify-center h-10 w-10 rounded-full border border-accent/20 bg-warm-light/50">
                    <Scissors className="h-4 w-4 text-accent/60 rotate-90" />
                  </div>
                  <PawPrint className="h-3 w-3 text-accent/30 mx-1" />
                  <div className="h-px w-10 bg-gradient-to-l from-transparent to-accent/20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
