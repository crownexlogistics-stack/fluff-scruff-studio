import { useState } from "react";
import { Phone, MapPin, Clock, Instagram, Facebook, Star, Scissors, Sparkles, Heart, PawPrint } from "lucide-react";
import logo from "@/assets/logo-transparent.png";
import heroDog from "@/assets/hero-dog.jpg";
import serviceFullGroom from "@/assets/service-full-groom.jpg";
import servicePuppy from "@/assets/service-puppy.jpg";
import serviceTeeth from "@/assets/service-teeth.jpg";
import serviceNails from "@/assets/service-nails.jpg";
import { ServiceJourney } from "@/components/ServiceJourney";
import { BookingFlow } from "@/components/BookingFlow";

const CustomerHome = () => {
  const [activeService, setActiveService] = useState<string | null>(null);

  const services = [
    { title: "Full Groom", subtitle: "The ultimate pamper session — wash, dry, cut & style. Your pup leaves looking like a supermodel.", image: serviceFullGroom },
    { title: "Puppy Special", subtitle: "A gentle, fun first grooming experience. We go at their pace with loads of treats & cuddles.", image: servicePuppy, imagePosition: "center 55%" },
    { title: "Teeth Cleaning", subtitle: "Fresh gums and pearly whites for your best friend. Say goodbye to bad breath.", image: serviceTeeth },
    { title: "Nail Clipping", subtitle: "Quick, painless trim so those tippy-taps stay happy and healthy.", image: serviceNails },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <img src={logo} alt="Fluff & Scruff" className="h-12 w-auto" />
          <div className="hidden sm:flex items-center gap-8 text-sm font-medium font-body">
            <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
          <button
            onClick={() => setActiveService("Full Groom")}
            className="bg-accent text-accent-foreground font-semibold font-body text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-all shadow-md shadow-accent/20"
          >
            Book Now
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative w-full h-[55vh] sm:h-[65vh] md:h-[75vh]">
          <img
            src={heroDog}
            alt="Beautifully groomed dog at Fluff & Scruff studio"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background via-background/85 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background/30 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background/30 to-transparent" />
        </div>

        {/* Hero text */}
        <div className="relative -mt-44 z-10 max-w-2xl mx-auto px-6 text-center pb-14">
          <div className="flex items-center justify-center gap-2 mb-4">
            <PawPrint className="h-5 w-5 text-accent" />
            <span className="text-sm font-body font-medium text-accent tracking-wide uppercase">Hornchurch's Favourite Groomers</span>
            <PawPrint className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-heading text-foreground leading-[1.1] tracking-tight">
            Fluff &amp; Scruff Studio
          </h1>
          <div className="w-16 h-[2px] bg-accent/40 mx-auto mt-5 mb-4 rounded-full" />
          <p className="text-base sm:text-lg text-muted-foreground font-body max-w-sm mx-auto leading-relaxed">
            Where every pup leaves looking <em>and feeling</em> their absolute best.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <button
              onClick={() => setActiveService("Full Groom")}
              className="bg-accent text-accent-foreground font-semibold font-body text-base px-10 py-4 rounded-full hover:opacity-90 transition-all shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/25 hover:-translate-y-0.5"
            >
              Book an Appointment
            </button>
            <a
              href="tel:+441234567890"
              className="flex items-center justify-center gap-2 border-2 border-foreground/10 bg-white/60 backdrop-blur-sm text-foreground font-semibold font-body text-base px-10 py-4 rounded-full hover:border-foreground/20 hover:bg-white transition-all"
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

      {/* About / Trust Section */}
      <section id="about" className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-accent font-body text-sm uppercase tracking-[0.25em] mb-3 flex items-center justify-center gap-2">
              <Heart className="h-4 w-4 fill-accent" />
              Why Dog Parents Love Us
              <Heart className="h-4 w-4 fill-accent" />
            </p>
            <h2 className="text-3xl sm:text-4xl font-heading text-foreground">We treat them like our own</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-3xl bg-warm-light/50 border border-accent/10">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent/10 mb-4">
                <Star className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-heading text-xl text-foreground mb-2">5-Star Rated</h3>
              <p className="text-sm text-muted-foreground font-body">
                Trusted by hundreds of dog owners across Hornchurch. Our reviews speak for themselves!
              </p>
            </div>
            <div className="text-center p-6 rounded-3xl bg-warm-light/50 border border-accent/10">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent/10 mb-4">
                <Scissors className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-heading text-xl text-foreground mb-2">Expert Groomers</h3>
              <p className="text-sm text-muted-foreground font-body">
                Fully qualified pros who treat every dog with patience, love, and the perfect amount of treats.
              </p>
            </div>
            <div className="text-center p-6 rounded-3xl bg-warm-light/50 border border-accent/10">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent/10 mb-4">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-heading text-xl text-foreground mb-2">Premium Products</h3>
              <p className="text-sm text-muted-foreground font-body">
                Only the best shampoos, conditioners and tools. Because your fur baby deserves luxury!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Info */}
      <section id="contact" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <PawPrint className="h-6 w-6 text-accent mx-auto mb-3" />
            <h2 className="text-3xl sm:text-4xl font-heading text-foreground mb-3">Come Say Hello</h2>
            <p className="text-muted-foreground font-body">We'd love to meet you and your pup!</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            <div className="bg-card rounded-3xl border border-border p-6 flex items-start gap-4 hover:shadow-lg hover:shadow-accent/5 transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold font-body text-foreground mb-1">Find Us</h3>
                <p className="text-sm text-muted-foreground">138 Hillview Avenue, Hornchurch RM11 2DL</p>
              </div>
            </div>
            <div className="bg-card rounded-3xl border border-border p-6 flex items-start gap-4 hover:shadow-lg hover:shadow-accent/5 transition-all">
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
      <section className="py-16 sm:py-20 bg-gradient-to-br from-accent to-paw text-accent-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="flex justify-center gap-2">
            <PawPrint className="h-6 w-6 opacity-60" />
            <PawPrint className="h-5 w-5 opacity-40" />
            <PawPrint className="h-6 w-6 opacity-60" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading">Ready for a Pamper Day?</h2>
          <p className="text-accent-foreground/80 font-body text-lg">
            Give your dog the spa day they deserve. Book online in seconds.
          </p>
          <button
            onClick={() => setActiveService("Full Groom")}
            className="bg-white text-foreground font-semibold font-body text-base px-10 py-4 rounded-full hover:bg-white/90 transition-colors shadow-lg"
          >
            Book Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert" />
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/fluffandscruff_studio/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 hover:bg-accent/30 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.facebook.com/fluffandscruffstudio" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 hover:bg-accent/30 transition-colors">
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
