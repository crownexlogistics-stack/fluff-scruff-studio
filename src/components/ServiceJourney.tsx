import { Scissors, ChevronRight } from "lucide-react";

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
          <p className="text-muted-foreground font-body text-sm uppercase tracking-[0.25em] mb-4">
            Our Services
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-foreground leading-tight">
            The Grooming Journey
          </h2>
          <div className="w-12 h-[2px] bg-foreground/20 mx-auto mt-5 rounded-full" />
        </div>

        {/* Journey Items */}
        <div className="relative">
          {/* The charcoal vertical path */}
          <div className="absolute left-[28%] sm:left-[30%] top-0 bottom-0 w-px hidden md:block">
            <div className="w-full h-full bg-gradient-to-b from-transparent via-foreground/15 to-transparent" />
          </div>

          {services.map((service, index) => (
            <div key={service.title}>
              {/* Service Item */}
              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
                {/* Photo Side — Left */}
                <div className="w-full md:w-[55%] relative">
                  <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-black/10 group">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-700"
                      style={service.imagePosition ? { objectPosition: service.imagePosition } : undefined}
                    />
                  </div>
                </div>

                {/* White Card — Right */}
                <div className="w-full md:w-[45%]">
                  <button
                    onClick={() => onSelectService(service.title)}
                    className="w-full text-left group"
                  >
                    <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:border-foreground/10">
                      {/* Service number */}
                      <span className="text-muted-foreground/40 font-body text-xs tracking-[0.3em] uppercase mb-3 block">
                        0{index + 1}
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-heading text-foreground mb-3 group-hover:text-primary transition-colors duration-300">
                        {service.title}
                      </h3>
                      <p className="text-muted-foreground font-body text-sm sm:text-base leading-relaxed mb-5">
                        {service.subtitle}
                      </p>
                      <div className="flex items-center gap-2 text-foreground font-body text-sm font-semibold group-hover:gap-3 transition-all duration-300">
                        Book now
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Scissors Divider */}
              {index < services.length - 1 && (
                <div className="flex items-center justify-center my-10 sm:my-14">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent to-foreground/10" />
                  <div className="mx-4 flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background">
                    <Scissors className="h-4 w-4 text-muted-foreground/50 rotate-90" />
                  </div>
                  <div className="h-px w-16 bg-gradient-to-l from-transparent to-foreground/10" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
