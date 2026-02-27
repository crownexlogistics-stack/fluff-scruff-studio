import { Scissors, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <section id="services" className="relative py-20 sm:py-28 bg-[hsl(220,30%,8%)] overflow-hidden">
      {/* Subtle radial glow behind the section */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(15,55%,65%,0.04)] blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16 sm:mb-20">
          <p className="text-[hsl(15,55%,65%)] font-body text-sm uppercase tracking-[0.25em] mb-4">
            Our Services
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-white leading-tight">
            The Grooming Journey
          </h2>
          <div className="w-12 h-[2px] gradient-rose mx-auto mt-5 rounded-full" />
        </div>

        {/* Journey Items */}
        <div className="relative">
          {/* The glowing vertical path */}
          <div className="absolute left-[28%] sm:left-[30%] top-0 bottom-0 w-px hidden md:block">
            <div className="w-full h-full bg-gradient-to-b from-transparent via-[hsl(15,55%,65%,0.3)] to-transparent" />
            <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent via-[hsl(15,55%,65%,0.15)] to-transparent blur-md" />
          </div>

          {services.map((service, index) => (
            <div key={service.title}>
              {/* Service Item */}
              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
                {/* Photo Side — Left */}
                <div className="w-full md:w-[55%] relative">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 group">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-700"
                      style={service.imagePosition ? { objectPosition: service.imagePosition } : undefined}
                    />
                    {/* Subtle gradient overlay on image */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/30" />
                  </div>
                </div>

                {/* Glassmorphism Text Card — Right */}
                <div className="w-full md:w-[45%]">
                  <button
                    onClick={() => onSelectService(service.title)}
                    className="w-full text-left group"
                  >
                    <div className="glass-dark rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:bg-white/[0.09] hover:border-[hsl(15,55%,65%,0.2)] hover:shadow-lg hover:shadow-[hsl(15,55%,65%,0.05)]">
                      {/* Service number */}
                      <span className="text-[hsl(15,55%,65%,0.4)] font-body text-xs tracking-[0.3em] uppercase mb-3 block">
                        0{index + 1}
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-heading text-white mb-3 group-hover:text-[hsl(15,55%,65%)] transition-colors duration-300">
                        {service.title}
                      </h3>
                      <p className="text-[hsl(220,10%,60%)] font-body text-sm sm:text-base leading-relaxed mb-5">
                        {service.subtitle}
                      </p>
                      <div className="flex items-center gap-2 text-[hsl(15,55%,65%)] font-body text-sm font-semibold group-hover:gap-3 transition-all duration-300">
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
                  <div className="h-px w-16 bg-gradient-to-r from-transparent to-[hsl(15,55%,65%,0.3)]" />
                  <div className="mx-4 flex items-center justify-center h-10 w-10 rounded-full border border-[hsl(15,55%,65%,0.2)] bg-[hsl(220,30%,8%)]">
                    <Scissors className="h-4 w-4 text-[hsl(15,55%,65%,0.5)] rotate-90" />
                  </div>
                  <div className="h-px w-16 bg-gradient-to-l from-transparent to-[hsl(15,55%,65%,0.3)]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
