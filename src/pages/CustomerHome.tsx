import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
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
import { HeroSection } from "@/components/HeroSection";
import { GoogleReviews } from "@/components/GoogleReviews";
import { BookingFlow } from "@/components/BookingFlow";

import { TrustStrip } from "@/components/TrustStrip";
import { AIChatWidget } from "@/components/AIChatWidget";
import { PackageDealsSection } from "@/components/PackageDealsSection";
import InstagramFeed from "@/components/InstagramFeed";

const CustomerHome = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();
  const [activeService, setActiveService] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = role === "manager" || role === "director" || role === "groomer";

  if (!authLoading && !roleLoading && user && isStaff) {
    if (role === "manager" || role === "director") return <Navigate to="/admin" replace />;
    if (role === "groomer") return <Navigate to="/portal" replace />;
  }

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
    { title: "Nail Trim & Filing", subtitle: "Quick, painless trim so those tippy-taps stay happy and healthy.", image: serviceNails, imagePosition: "48% 63%" },
    { title: "Ultrasonic Teeth Cleaning", subtitle: "Fresh gums and pearly whites for your best friend. Say goodbye to bad breath.", image: serviceTeeth },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ══════ NAVBAR ══════ */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5 cursor-pointer">
            <img src={logo} alt="Fluff & Scruff" className="h-10 sm:h-12 w-auto" />
            <div className="hidden sm:block">
              <p className="font-heading text-base leading-tight text-foreground">Fluff &amp; Scruff</p>
              <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Grooming Studio</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/book")}
              className="text-primary-foreground font-bold font-body text-sm px-6 py-2.5 bg-accent hover:bg-accent/90 transition-all duration-300 active:scale-[0.96]"
              style={{ borderRadius: '30px' }}
            >
              Book Now
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center h-10 w-10 rounded-full text-foreground/70 hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border/30 bg-background px-4 py-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
            <a href="#services" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">Services</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">About</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">Contact</a>
            <Link to="/packages" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-accent hover:bg-accent/10 transition-colors">📦 Package Deals</Link>
            <Link to="/academy" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">🎓 Academy</Link>
            {accountLink && (
              <Link to={accountLink} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-foreground/80 hover:bg-muted/50 transition-colors">My Account</Link>
            )}
            <div className="pt-2 border-t border-border/30">
              {user ? (
                <button onClick={async () => { setMobileMenuOpen(false); await signOut(); }} className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-muted-foreground hover:bg-muted/50 transition-colors w-full">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              ) : (
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold font-body text-muted-foreground hover:bg-muted/50 transition-colors">
                  <LogIn className="h-4 w-4" /> Login
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ══════ HERO ══════ */}
      <HeroSection onBook={() => navigate("/book")} />


      {/* ══════ SERVICES ══════ */}
      <div className="pt-10 sm:pt-16" />
      <ServiceJourney
        services={services}
        onSelectService={(title) => navigate(`/book?service=${encodeURIComponent(title)}`)}
      />

      {/* ══════ PACKAGE DEALS ══════ */}
      <PackageDealsSection />

      {/* ══════ REVIEWS ══════ */}
      <GoogleReviews />

      {/* ══════ INSTAGRAM ══════ */}
      <InstagramFeed />

      {/* ══════ ABOUT ══════ */}
      <section id="about" className="py-12 sm:py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
              🐾 Our Story 🐾
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-foreground">
              We're obsessed with dogs. Genuinely.
            </h2>
          </div>

          <div className="bg-card p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.06)]" style={{ borderRadius: '28px' }}>
            <span className="inline-block bg-accent/10 text-accent font-body font-bold text-xs px-4 py-1.5 mb-4" style={{ borderRadius: '30px' }}>
              🏡 Family-Run Business
            </span>
            <h3 className="font-heading text-lg text-foreground mb-3">Every dog deserves the very best care</h3>
            <div className="space-y-4 text-muted-foreground font-body text-sm leading-relaxed">
              <p>
                F&amp;S Studio is a family-run business dedicated to providing top-notch dog grooming services. Our team is passionate about dogs and we take great care and pride in ensuring their safety, well-being and happiness. Our dog groomers have extensive experience and are trained to handle dogs of all breeds and sizes.
              </p>
              <p>
                Your furry pal deserves the very best, and that's what we provide here at F&amp;S Studio. Our experienced groomers are passionate about what they do and take great care in making sure every dog leaves our salon looking and feeling their best.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {["✂️ All Breeds", "🌟 Expert Groomers", "💛 Dog Lovers", "📍 Hornchurch"].map(tag => (
                <span key={tag} className="bg-warm-light text-accent font-body font-semibold text-xs px-4 py-2" style={{ borderRadius: '30px' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ ACADEMY BANNER ══════ */}
      <section className="py-12 sm:py-16" style={{ background: "#FFFAF4" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-2xl font-heading text-foreground mb-3">
            🎓 Thinking About a Career in Dog Grooming?
          </h2>
          <p className="text-muted-foreground font-body text-sm sm:text-base mb-6 max-w-xl mx-auto leading-relaxed">
            We offer hands-on professional training inside our working salon. Small groups, real dogs, real skills.
          </p>
          <Link
            to="/academy"
            className="inline-flex items-center gap-1 bg-accent text-primary-foreground font-bold font-body text-sm px-8 py-3 hover:bg-accent/90 transition-all active:scale-[0.97]"
            style={{ borderRadius: '30px' }}
          >
            Find Out More →
          </Link>
        </div>
      </section>

      {/* ══════ CONTACT ══════ */}
      <section id="contact" className="py-12 sm:py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
              📍 Come Say Hello 📍
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-foreground">We'd love to meet you and your pup!</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <a
              href="https://www.google.com/maps/place/138+Hillview+Ave,+Hornchurch+RM11+2DL"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card p-5 flex items-start gap-4 hover:shadow-lg transition-all duration-300 no-underline shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
              style={{ borderRadius: '20px' }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-accent/10" style={{ borderRadius: '12px' }}>
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-heading text-sm text-foreground mb-1">📍 Find Us</h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">138 Hillview Avenue, Hornchurch RM11 2DL</p>
              </div>
            </a>
            <a
              href="tel:01708606655"
              className="bg-card p-5 flex items-start gap-4 hover:shadow-lg transition-all duration-300 no-underline shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
              style={{ borderRadius: '20px' }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-accent/10" style={{ borderRadius: '12px' }}>
                <Phone className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-heading text-sm text-foreground mb-1">📞 Call Us</h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">01708 606655</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-body">WhatsApp: +44 7476 452782</p>
              </div>
            </a>
            <div
              className="bg-card p-5 flex items-start gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
              style={{ borderRadius: '20px' }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-accent/10" style={{ borderRadius: '12px' }}>
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-heading text-sm text-foreground mb-1">🕐 Opening Hours</h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">Tue – Sat · 10:00am – 5:00pm</p>
              </div>
            </div>
          </div>
          <div className="max-w-2xl mx-auto mt-6 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]" style={{ borderRadius: '20px' }}>
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

      {/* ══════ CTA BANNER ══════ */}
      <section className="py-12 sm:py-20 relative overflow-hidden bg-accent">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 2C7.58 2 4 5.58 4 10c0 2.24.92 4.27 2.4 5.72L12 22l5.6-6.28A7.96 7.96 0 0020 10c0-4.42-3.58-8-8-8z'/%3E%3C/svg%3E\")" }} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-white">
            Your dog called. They want a spa day. 📞
          </h2>
          <p className="text-white/90 font-body text-base">Book online in 60 seconds.</p>
          <button
            onClick={() => navigate("/book")}
            className="bg-white text-accent font-bold font-body text-base px-10 py-4 hover:bg-white/95 transition-all active:scale-[0.97] shadow-xl"
            style={{ borderRadius: '30px' }}
          >
            Let's Get Fluffy! 🐶
          </button>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-10" style={{ background: 'hsl(20 60% 12%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert" />
            <p className="font-heading text-base text-white">Fluff &amp; Scruff Studio</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <a href="https://www.instagram.com/fluffandscruff.studio/?hl=en" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-accent/30 transition-colors">
              <Instagram className="h-5 w-5 text-white" />
            </a>
            <a href="https://www.facebook.com/p/FluffScruff-studio-61553637233998/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-accent/30 transition-colors">
              <Facebook className="h-5 w-5 text-white" />
            </a>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-white/40 font-body">
            <Link to="/terms" className="hover:text-white/70 transition-colors underline underline-offset-2">T&amp;C's</Link>
            <span>·</span>
            <p>© {new Date().getFullYear()} Fluff &amp; Scruff Studio</p>
          </div>
        </div>
      </footer>

      {activeService && (
        <BookingFlow service={activeService} onClose={() => setActiveService(null)} />
      )}
      
      <AIChatWidget />
    </div>
  );
};

export default CustomerHome;
