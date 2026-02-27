import { useState } from "react";
import { Scissors, Sparkles, SmilePlus, Dog, Phone, MapPin, Clock, ChevronRight } from "lucide-react";
import logo from "@/assets/logo-transparent.png";
import heroDog from "@/assets/hero-dog.jpg";
import { ServiceTile } from "@/components/ServiceTile";
import { BookingFlow } from "@/components/BookingFlow";

const CustomerHome = () => {
  const [activeService, setActiveService] = useState<string | null>(null);

  const services = [
    { title: "Grooming", subtitle: "Full groom or bath & brush", icon: Scissors, gradient: "rose" as const },
    { title: "Puppy Special", subtitle: "Gentle first-time groom", icon: Sparkles, gradient: "navy" as const },
    { title: "Teeth Cleaning", subtitle: "Fresh breath & healthy gums", icon: SmilePlus, gradient: "rose" as const },
    { title: "Nail Clipping", subtitle: "Quick & painless trim", icon: Dog, gradient: "navy" as const },
  ];

  return (
    <div className="min-h-screen bg-[hsl(0,0%,7%)] text-white">
      {/* Floating Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-5 pt-3">
        <div className="glass-dark rounded-2xl px-4 py-2.5 flex items-center justify-between max-w-lg mx-auto">
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert opacity-90" />
          <a
            href="tel:+441234567890"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 active:scale-95 transition-transform"
          >
            <Phone className="h-4.5 w-4.5 text-white/80" />
          </a>
        </div>
      </nav>

      {/* Hero with gradient mask */}
      <section className="relative h-[75vh] overflow-hidden">
        <img
          src={heroDog}
          alt="Beautiful dog"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* Gradient mask fading into background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-40% to-[hsl(0,0%,7%)]" />
        
        {/* Text overlay on the shadowed bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 max-w-lg mx-auto">
          <img src={logo} alt="Fluff & Scruff" className="h-16 w-auto brightness-0 invert mb-3" />
          <p className="text-white/60 text-sm font-body leading-relaxed max-w-xs">
            Professional dog grooming with love. Book your pup's next pamper session.
          </p>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-5 pb-12 space-y-10 -mt-2">
        {/* Services */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 font-body">
            Our Services
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {services.map((s) => (
              <ServiceTile
                key={s.title}
                title={s.title}
                subtitle={s.subtitle}
                icon={s.icon}
                gradient={s.gradient}
                onClick={() => setActiveService(s.title)}
              />
            ))}
          </div>
        </section>

        {/* Info Cards */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 font-body">
            Visit Us
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <div className="glass-dark rounded-2xl p-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <MapPin className="h-5 w-5 text-rose-gold" />
              </div>
              <div>
                <p className="font-semibold font-body text-sm text-white/90">Location</p>
                <p className="text-sm text-white/50 mt-0.5">138 Hillview Avenue, Hornchurch RM11 2DL</p>
              </div>
            </div>
            <div className="glass-dark rounded-2xl p-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Clock className="h-5 w-5 text-rose-gold" />
              </div>
              <div>
                <p className="font-semibold font-body text-sm text-white/90">Opening Hours</p>
                <p className="text-sm text-white/50 mt-0.5">Mon–Sat · 9:00am – 5:00pm</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pt-2">
          <button
            onClick={() => setActiveService("Grooming")}
            className="w-full touch-target gradient-rose text-white font-semibold font-body rounded-2xl py-4 text-base active:scale-[0.97] transition-transform shadow-lg shadow-rose-gold/25"
          >
            Book Now
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center pt-4 pb-2">
          <p className="text-xs text-white/25 font-body">
            © {new Date().getFullYear()} Fluff & Scruff Studio. All rights reserved.
          </p>
        </footer>
      </div>

      {/* Booking Flow */}
      {activeService && (
        <BookingFlow
          service={activeService}
          onClose={() => setActiveService(null)}
        />
      )}
    </div>
  );
};

export default CustomerHome;
