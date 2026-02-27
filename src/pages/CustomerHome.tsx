import { useState } from "react";
import { Scissors, Sparkles, SmilePlus, Dog, Phone, MapPin, Clock, Instagram, Facebook, Star } from "lucide-react";
import logo from "@/assets/logo-transparent.png";
import heroDog from "@/assets/hero-dog.jpg";
import { ServiceTile } from "@/components/ServiceTile";
import { BookingFlow } from "@/components/BookingFlow";

const CustomerHome = () => {
  const [activeService, setActiveService] = useState<string | null>(null);

  const services = [
    { title: "Full Groom", subtitle: "Complete wash, dry, cut & style", icon: Scissors, gradient: "rose" as const },
    { title: "Puppy Special", subtitle: "Gentle first-time groom experience", icon: Sparkles, gradient: "navy" as const },
    { title: "Teeth Cleaning", subtitle: "Fresh breath & healthy gums", icon: SmilePlus, gradient: "rose" as const },
    { title: "Nail Clipping", subtitle: "Quick & painless trim", icon: Dog, gradient: "navy" as const },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <img src={logo} alt="Fluff & Scruff" className="h-12 w-auto" />
          <div className="hidden sm:flex items-center gap-8 text-sm font-medium font-body">
            <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
          <button
            onClick={() => setActiveService("Full Groom")}
            className="gradient-rose text-white font-semibold font-body text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
          >
            Book Now
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-muted">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 items-center min-h-[480px] md:min-h-[540px]">
            {/* Text side */}
            <div className="py-12 md:py-16 space-y-6 text-center md:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading text-primary leading-tight">
                Fluff and Scruff
              </h1>
              <p className="text-lg text-muted-foreground font-body max-w-md mx-auto md:mx-0">
                Dog Grooming Studio — where every pup leaves looking and feeling their best.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button
                  onClick={() => setActiveService("Full Groom")}
                  className="gradient-rose text-white font-semibold font-body text-base px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-accent/20"
                >
                  Book an Appointment
                </button>
                <a
                  href="tel:+441234567890"
                  className="flex items-center justify-center gap-2 border border-border text-foreground font-semibold font-body text-base px-8 py-3.5 rounded-full hover:bg-muted transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Call Us
                </a>
              </div>
            </div>
            {/* Image side */}
            <div className="relative hidden md:block h-full">
              <img
                src={heroDog}
                alt="Beautifully groomed dog at Fluff & Scruff studio"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              {/* Left edge fade into the background */}
              <div className="absolute inset-0 bg-gradient-to-r from-muted via-transparent to-transparent w-32" />
            </div>
          </div>
        </div>
        {/* Mobile hero image */}
        <div className="md:hidden relative h-72 -mt-4">
          <img
            src={heroDog}
            alt="Beautifully groomed dog"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-muted via-transparent to-transparent h-20" />
        </div>
      </section>


      {/* Services */}
      <section id="services" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-heading text-primary mb-3">Our Services</h2>
            <p className="text-muted-foreground font-body max-w-lg mx-auto">
              From full grooms to puppy specials, we keep your furry friends looking fabulous.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
        </div>
      </section>

      {/* About / Trust Section */}
      <section id="about" className="py-16 sm:py-20 bg-muted/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent/10 mb-4">
                <Star className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-heading text-xl text-primary mb-2">5-Star Rated</h3>
              <p className="text-sm text-muted-foreground font-body">
                Trusted by hundreds of dog owners across Hornchurch and surrounding areas.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent/10 mb-4">
                <Scissors className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-heading text-xl text-primary mb-2">Experienced Groomers</h3>
              <p className="text-sm text-muted-foreground font-body">
                Qualified professionals who treat every dog with patience and care.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent/10 mb-4">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-heading text-xl text-primary mb-2">Premium Products</h3>
              <p className="text-sm text-muted-foreground font-body">
                We use only top-quality shampoos, conditioners and grooming tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Info */}
      <section id="contact" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-heading text-primary mb-3">Visit Us</h2>
            <p className="text-muted-foreground font-body">We'd love to see you and your pup!</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            <div className="bg-card rounded-2xl border border-border p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold font-body text-foreground mb-1">Location</h3>
                <p className="text-sm text-muted-foreground">138 Hillview Avenue, Hornchurch RM11 2DL</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold font-body text-foreground mb-1">Opening Hours</h3>
                <p className="text-sm text-muted-foreground">Mon – Sat · 9:00am – 5:00pm</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 sm:py-20 gradient-navy text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-heading">Ready to Book?</h2>
          <p className="text-white/70 font-body text-lg">
            Give your dog the pamper session they deserve. Book online in seconds.
          </p>
          <button
            onClick={() => setActiveService("Full Groom")}
            className="gradient-rose text-white font-semibold font-body text-base px-10 py-4 rounded-full hover:opacity-90 transition-opacity shadow-lg"
          >
            Book Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert" />
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/fluffandscruff_studio/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.facebook.com/fluffandscruffstudio" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
            </div>
            <p className="text-xs text-white/50 font-body">
              © {new Date().getFullYear()} Fluff & Scruff Studio. All rights reserved.
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
