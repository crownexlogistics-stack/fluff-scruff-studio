import { useState } from "react";
import { Phone, MapPin, Clock, Instagram, Facebook, PawPrint, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-transparent.png";
import heroDog from "@/assets/hero-shop.jpg";
import serviceFullGroom from "@/assets/service-full-groom.jpg";
import servicePuppy from "@/assets/service-puppy.jpg";
import serviceTeeth from "@/assets/service-teeth.jpg";
import serviceNails from "@/assets/service-nails.jpg";
import { ServiceJourney } from "@/components/ServiceJourney";
import { GoogleReviews } from "@/components/GoogleReviews";
import { BookingFlow } from "@/components/BookingFlow";

const CustomerHome = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { role } = useUserRole(user?.id);
  const [activeService, setActiveService] = useState<string | null>(null);

  const isStaff = role === "manager" || role === "director" || role === "groomer";

  const services = [
    { title: "Grooming", subtitle: "The ultimate pamper session — wash, dry, cut & style. Your pup leaves looking like a supermodel.", image: serviceFullGroom },
    { title: "Puppy Special", subtitle: "A gentle, fun first grooming experience. We go at their pace with loads of treats & cuddles.", image: servicePuppy, imagePosition: "center 55%" },
    { title: "Teeth Cleaning", subtitle: "Fresh gums and pearly whites for your best friend. Say goodbye to bad breath.", image: serviceTeeth },
    { title: "Nail Clipping", subtitle: "Quick, painless trim so those tippy-taps stay happy and healthy.", image: serviceNails },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between" style={{ height: '4.5rem' }}>
          <img src={logo} alt="Fluff & Scruff" className="h-14 w-auto" />
          <div className="hidden sm:flex items-center gap-10 text-sm font-medium font-body">
            <a href="#services" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Services</a>
            <a href="#about" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">About</a>
            <a href="#contact" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Contact</a>
            {user && role === "customer" && (
              <Link to="/my-pets" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">My Pets</Link>
            )}
            {user && (role === "manager" || role === "director") && (
              <Link to="/admin" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Dashboard</Link>
            )}
            {user && role === "groomer" && (
              <Link to="/portal" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">My Schedule</Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveService("Full Groom")}
              className="bg-charcoal text-primary-foreground font-semibold font-body text-sm px-6 py-2.5 rounded-full hover:opacity-90 transition-all duration-300 shadow-md shadow-charcoal/15 hover:shadow-lg hover:shadow-charcoal/20"
            >
              Book Now
            </button>
            {/* Only show auth controls for staff or logged-in customers */}
            {user ? (
              isStaff || role === "customer" ? (
                <button
                  onClick={async () => { await signOut(); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 font-body"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              ) : null
            ) : (
              /* Hide sign-in from public — only show a subtle link */
              <Link
                to="/auth"
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors duration-300"
                aria-label="Staff login"
              >
                <LogIn className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative w-full h-[58vh] sm:h-[68vh] md:h-[78vh]">
          <img
            src={heroDog}
            alt="Beautifully groomed dog at Fluff & Scruff studio"
            className="w-full h-full object-cover object-center brightness-[1.08]"
          />
          {/* Softer overlays — reduced opacity for richer image */}
          <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background/15 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background/15 to-transparent" />
        </div>

        {/* Hero text — larger, more dominant */}
        <div className="relative -mt-52 z-10 max-w-2xl mx-auto px-6 text-center pb-16">
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-heading text-foreground leading-[1.05] tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
            Fluff &amp; Scruff Studio
          </h1>
          <div className="w-20 h-[2px] bg-accent/50 mx-auto mt-6 mb-5 rounded-full" />
          <p className="text-base sm:text-lg text-muted-foreground font-body max-w-sm mx-auto leading-relaxed">
            Where every pup leaves looking <em>and feeling</em> their absolute best.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <button
              onClick={() => setActiveService("Full Groom")}
              className="bg-charcoal text-primary-foreground font-semibold font-body text-base px-12 py-4.5 rounded-full hover:opacity-90 transition-all duration-300 shadow-lg shadow-charcoal/15 hover:shadow-xl hover:shadow-charcoal/20 hover:-translate-y-0.5"
              style={{ paddingTop: '1.125rem', paddingBottom: '1.125rem' }}
            >
              Book an Appointment
            </button>
            <a
              href="tel:+441234567890"
              className="flex items-center justify-center gap-2 border-2 border-foreground/8 bg-white/70 backdrop-blur-sm text-foreground font-semibold font-body text-base px-12 rounded-full hover:border-foreground/15 hover:bg-white/90 transition-all duration-300"
              style={{ paddingTop: '1.125rem', paddingBottom: '1.125rem' }}
            >
              <Phone className="h-4 w-4" />
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* Services Journey */}
      <ServiceJourney
        services={services}
        onSelectService={(title) => setActiveService(title)}
      />

      {/* Google Reviews */}
      <GoogleReviews />

      {/* Contact / Info */}
      <section id="contact" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <PawPrint className="h-6 w-6 text-accent mx-auto mb-3" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-foreground mb-3">Come Say Hello</h2>
            <p className="text-muted-foreground font-body">We'd love to meet you and your pup!</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <a
              href="https://www.google.com/maps/place/138+Hillview+Ave,+Hornchurch+RM11+2DL"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card rounded-3xl border border-border/50 p-7 flex items-start gap-4 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer no-underline shadow-sm shadow-black/[0.02]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/8">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold font-body text-foreground mb-1">Find Us</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">138 Hillview Avenue, Hornchurch RM11 2DL</p>
              </div>
            </a>
            <div className="bg-card rounded-3xl border border-border/50 p-7 flex items-start gap-4 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300 shadow-sm shadow-black/[0.02]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/8">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold font-body text-foreground mb-1">Opening Hours</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Tue – Sat · 10:00am – 5:00pm</p>
              </div>
            </div>
          </div>
          {/* Embedded Google Map */}
          <div className="max-w-2xl mx-auto mt-8 rounded-3xl overflow-hidden border border-border/50 shadow-sm shadow-black/[0.02]">
            <iframe
              title="Fluff & Scruff Studio location"
              src="https://maps.google.com/maps?q=138+Hillview+Ave,+Hornchurch+RM11+2DL,+UK&output=embed"
              width="100%"
              height="280"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* CTA Banner — refined gradient with texture */}
      <section className="py-20 sm:py-28 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(24 75% 55%), hsl(28 80% 58%), hsl(20 70% 52%))' }}>
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(0,0,0,0.1) 0%, transparent 50%)' }} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-8">
          <div className="flex justify-center gap-3">
            <PawPrint className="h-6 w-6 opacity-50" />
            <PawPrint className="h-5 w-5 opacity-30" />
            <PawPrint className="h-6 w-6 opacity-50" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-white">Ready for a Pamper Day?</h2>
          <p className="text-white/85 font-body text-lg max-w-md mx-auto leading-relaxed">
            Give your dog the spa day they deserve. Book online in seconds.
          </p>
          <button
            onClick={() => setActiveService("Full Groom")}
            className="bg-white text-charcoal font-semibold font-body text-base px-12 py-5 rounded-full hover:bg-white/95 transition-all duration-300 shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/15 hover:-translate-y-0.5"
          >
            Book Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert" />
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/fluffandscruff.studio/?hl=en" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 hover:bg-accent/30 transition-colors duration-300">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.facebook.com/p/FluffScruff-studio-61553637233998/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 hover:bg-accent/30 transition-colors duration-300">
                <Facebook className="h-5 w-5" />
              </a>
            </div>
            <p className="text-xs text-background/40 font-body">
              © {new Date().getFullYear()} Fluff & Scruff Studio
            </p>
          </div>
        </div>
      </footer>

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
