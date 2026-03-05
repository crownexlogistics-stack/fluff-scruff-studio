import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, MapPin, Clock, Instagram, Facebook, PawPrint, LogIn, LogOut, Star, Menu, X } from "lucide-react";
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
import { TrustStrip } from "@/components/TrustStrip";

const CustomerHome = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { role } = useUserRole(user?.id);
  const navigate = useNavigate();
  const [activeService, setActiveService] = useState<string | null>(null);

  const isStaff = role === "manager" || role === "director" || role === "groomer";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getAccountLink = () => {
    if (!user) return null;
    if (role === "manager" || role === "director") return "/admin";
    if (role === "groomer") return "/portal";
    if (role === "customer") return "/my-pets";
    return null;
  };
  const accountLink = getAccountLink();

  const services = [
    { title: "Grooming", subtitle: "The ultimate pamper session — wash, dry, cut & style. Your pup leaves looking like a supermodel.", image: serviceFullGroom, imagePosition: "50% 43%" },
    { title: "Puppy Special", subtitle: "A gentle, fun first grooming experience. We go at their pace with loads of treats & cuddles.", image: servicePuppy, imagePosition: "50% 52%" },
    { title: "Ultrasonic Teeth Cleaning", subtitle: "Fresh gums and pearly whites for your best friend. Say goodbye to bad breath.", image: serviceTeeth },
    { title: "Nail Trim & Filing", subtitle: "Quick, painless trim so those tippy-taps stay happy and healthy.", image: serviceNails, imagePosition: "48% 63%" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-2xl border-b border-border/20 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between" style={{ height: '4rem' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="cursor-pointer">
            <img src={logo} alt="Fluff & Scruff" className="h-12 sm:h-14 w-auto" />
          </a>
          <div className="hidden sm:flex items-center gap-10 text-sm font-medium font-body">
            <a href="#services" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Services</a>
            <a href="#about" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">About</a>
            <a href="#contact" className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Contact</a>
            {accountLink && (
              <Link to={accountLink} className="relative text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:bottom-[-4px] after:h-[2px] after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">My Account</Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/book")}
              className="text-primary-foreground font-semibold font-body text-sm px-6 py-2.5 rounded-full transition-all duration-300 shadow-md shadow-charcoal/15 hover:shadow-lg hover:shadow-charcoal/20 active:scale-[0.96]"
              style={{ background: 'linear-gradient(135deg, hsl(220 10% 22%), hsl(220 10% 30%))' }}
            >
              Book Now
            </button>
            {user ? (
              isStaff || role === "customer" ? (
                <button
                  onClick={async () => { await signOut(); }}
                  className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 font-body"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              ) : null
            ) : (
              <Link
                to="/auth"
                className="hidden sm:block text-muted-foreground/40 hover:text-muted-foreground transition-colors duration-300"
                aria-label="Staff login"
              >
                <LogIn className="h-4 w-4" />
              </Link>
            )}
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden flex items-center justify-center h-10 w-10 rounded-lg text-foreground/70 hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border/30 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
            <a href="#services" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">Services</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">About</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">Contact</a>
            {accountLink && (
              <Link to={accountLink} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium font-body text-foreground/80 hover:bg-muted/50 transition-colors">My Account</Link>
            )}
            <div className="pt-2 border-t border-border/30">
              {user ? (
                <button
                  onClick={async () => { setMobileMenuOpen(false); await signOut(); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium font-body text-muted-foreground hover:bg-muted/50 transition-colors w-full"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              ) : (
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium font-body text-muted-foreground hover:bg-muted/50 transition-colors">
                  <LogIn className="h-4 w-4" /> Login
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative w-full h-[48vh] sm:h-[62vh] md:h-[78vh]">
          <img
            src={heroDog}
            alt="Beautifully groomed dog at Fluff & Scruff studio"
            className="w-full h-full object-cover object-center brightness-[1.08]"
          />
          {/* Overlays — reduced for richer image on mobile */}
          <div className="absolute inset-x-0 bottom-0 h-64 sm:h-80 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-background/10 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-background/10 to-transparent" />
        </div>

        {/* Hero text */}
        <div className="relative -mt-20 sm:-mt-36 z-10 max-w-2xl mx-auto px-5 sm:px-6 text-center pb-6 sm:pb-16">
          <h1 className="text-[2.75rem] sm:text-7xl lg:text-8xl font-heading text-foreground leading-[1.08] tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
            Fluff &amp; Scruff Studio
          </h1>
          <div className="w-16 sm:w-20 h-[2px] bg-accent/50 mx-auto mt-4 sm:mt-6 mb-3 sm:mb-5 rounded-full" />
          <p className="text-[0.9rem] sm:text-lg text-muted-foreground font-body max-w-sm mx-auto leading-relaxed">
            Where every pup leaves looking <em>and feeling</em> their absolute best.
          </p>
          {/* Inline trust line */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className="h-3.5 w-3.5 text-accent fill-accent" />
              ))}
            </div>
            <span className="text-xs font-body font-medium text-muted-foreground">
              4.9 from 69+ Google reviews
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-7 sm:mt-10">
            <button
              onClick={() => navigate("/book")}
              className="font-semibold font-body text-base px-12 rounded-full text-primary-foreground transition-all duration-300 shadow-lg shadow-charcoal/20 hover:shadow-xl hover:shadow-charcoal/25 hover:-translate-y-0.5 active:scale-[0.97] active:shadow-md"
              style={{
                paddingTop: '1.1rem',
                paddingBottom: '1.1rem',
                background: 'linear-gradient(135deg, hsl(220 10% 22%), hsl(220 10% 30%))',
              }}
            >
              Book an Appointment
            </button>
            <a
              href="tel:01708606655"
              className="flex items-center justify-center gap-2 border-2 border-foreground/8 bg-white/70 backdrop-blur-sm text-foreground font-semibold font-body text-base px-12 rounded-full hover:border-foreground/15 hover:bg-white/90 transition-all duration-300 active:scale-[0.97]"
              style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
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
        onSelectService={(title) => navigate(`/book?service=${encodeURIComponent(title)}`)}
      />

      {/* Divider */}
      <div className="max-w-xs mx-auto">
        <div className="h-px bg-border/60" />
      </div>

      {/* Google Reviews */}
      <GoogleReviews />

      {/* About Us */}
      <section id="about" className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <PawPrint className="h-6 w-6 text-accent mx-auto mb-3" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-foreground mb-4 leading-tight">
              At Fluff&amp;Scruff, we put our love for pets and their owners into all that we do.
            </h2>
          </div>

          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="bg-card rounded-3xl border border-border/50 p-8 sm:p-10 shadow-sm shadow-black/[0.02]">
              <h3 className="text-2xl sm:text-3xl font-heading text-foreground mb-5">Our Story</h3>
              <div className="space-y-5 text-muted-foreground font-body text-[0.95rem] sm:text-base leading-relaxed">
                <p>
                  F&amp;S Studio is a family-run business dedicated to providing top-notch dog grooming services. Our team is passionate about dogs and we take great care and pride in ensuring their safety, well-being and happiness. Our dog groomers have extensive experience and are trained to handle dogs of all breeds and sizes, from the tiniest teacup poodle to the largest Great Dane. We believe that every dog deserves the best and we are committed to delivering a top-quality service.
                </p>
                <p>
                  Your furry pal deserves the very best, and that's what we provide here at F&amp;S Studio. Our experienced groomers are passionate about what they do and take great care in making sure every dog leaves our salon looking and feeling their best. We are dedicated to staying up-to-date with the latest dog grooming techniques and trends, so you can trust us to provide only the best care for your furry friend. Come see us today and let us help your dog look and feel great.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-xs mx-auto">
        <div className="h-px bg-border/60" />
      </div>

      {/* Contact / Info */}
      <section id="contact" className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <PawPrint className="h-6 w-6 text-accent mx-auto mb-3" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-foreground mb-3">Come Say Hello</h2>
            <p className="text-muted-foreground font-body max-w-sm mx-auto">We'd love to meet you and your pup!</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
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
            <a
              href="tel:01708606655"
              className="bg-card rounded-3xl border border-border/50 p-7 flex items-start gap-4 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300 shadow-sm shadow-black/[0.02] no-underline"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/8">
                <Phone className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold font-body text-foreground mb-1">Call Us</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">01708 606655</p>
                <p className="text-xs text-muted-foreground mt-0.5">WhatsApp: +44 7476 452782</p>
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
      <section className="py-16 sm:py-24 lg:py-32 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(24 75% 55%), hsl(28 80% 58%), hsl(20 70% 52%))' }}>
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
            onClick={() => navigate("/book")}
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
            <div className="flex items-center gap-3 text-xs text-background/40 font-body">
              <p>© {new Date().getFullYear()} Fluff & Scruff Studio</p>
              <span>·</span>
              <Link to="/terms" className="hover:text-background/70 transition-colors underline underline-offset-2">T&amp;C's</Link>
            </div>
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
