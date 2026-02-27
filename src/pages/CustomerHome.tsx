import { useState } from "react";
import { Scissors, Sparkles, SmilePlus, Dog, Phone, MapPin, Clock } from "lucide-react";
import logo from "@/assets/logo-transparent.png";
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
    <div className="min-h-screen bg-background">
      {/* Glass Nav */}
      <nav className="glass sticky top-0 z-40 px-4 py-2 flex items-center justify-between border-b border-border/30">
        <img src={logo} alt="Fluff & Scruff Grooming Studio" className="h-12 w-auto" />
        <a
          href="tel:+441234567890"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted active:scale-95 transition-transform"
        >
          <Phone className="h-5 w-5 text-foreground" />
        </a>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-3 py-4">
          <img src={logo} alt="Fluff & Scruff" className="h-28 w-auto mx-auto" />
          <p className="text-muted-foreground text-sm font-body max-w-xs mx-auto">
            Professional dog grooming with love. Book your pup's next pamper session.
          </p>
        </section>

        {/* Services */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-body">
            Our Services
          </h3>
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
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-body">
            Visit Us
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold font-body text-sm">Location</p>
                <p className="text-sm text-muted-foreground mt-0.5">138 Hillview Avenue, Hornchurch RM11 2DL</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold font-body text-sm">Opening Hours</p>
                <p className="text-sm text-muted-foreground mt-0.5">Mon–Sat · 9:00am – 5:00pm</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-xs text-muted-foreground font-body">
            © {new Date().getFullYear()} Fluff & Scruff Studio. All rights reserved.
          </p>
        </footer>
      </div>

      {/* Booking Flow Overlay */}
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
