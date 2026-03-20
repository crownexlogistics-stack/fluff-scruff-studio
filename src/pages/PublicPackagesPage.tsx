import { Link, useNavigate } from "react-router-dom";
import { Phone, MessageCircle, ChevronRight, Check, Instagram, Facebook } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo-transparent.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const packages = [
  {
    title: "Grooming Package — 4 Sessions",
    shortTitle: "Book 4, Save 10%",
    description: "Pre-book 4 grooming sessions and pay upfront. Mix full grooms and bath & brush — whatever your dog needs. Dates can be rescheduled with notice.",
    badge: "Save 10% on every session",
    sessions: 4,
    discount: "10%",
    bg: "bg-accent",
    text: "text-white",
    badgeBg: "bg-white/20",
    terms: [
      "Mix of full groom and bath & brush welcome",
      "Dates can be rescheduled with 48 hours notice",
      "Unused sessions refundable at package rate",
      "Price locked in at time of purchase",
      "Non-transferable to another dog",
    ],
  },
  {
    title: "Grooming Package — 6 Sessions",
    shortTitle: "Book 6, Save 15%",
    description: "Our best grooming deal. Pre-book 6 sessions, mix services, and lock in your discount. The more you book, the more you save.",
    badge: "Save 15% on every session",
    sessions: 6,
    discount: "15%",
    bg: "",
    text: "text-white",
    badgeBg: "bg-white/20",
    popular: true,
    customBg: "hsl(20 60% 12%)",
    terms: [
      "Mix of full groom and bath & brush welcome",
      "Dates can be rescheduled with 48 hours notice",
      "Unused sessions refundable at package rate",
      "Price locked in at time of purchase",
      "Non-transferable to another dog",
    ],
  },
  {
    title: "Teeth Cleaning — 5 Sessions",
    shortTitle: "5 Teeth Cleans for £100",
    description: "Normally £25 per session — pre-book 5 ultrasonic teeth cleaning sessions and pay just £20 each. Save £25 in total.",
    badge: "Save £25 total",
    sessions: 5,
    discount: "£5 off each",
    bg: "",
    text: "text-foreground",
    badgeBg: "bg-white/40",
    customBg: "#FFB800",
    terms: [
      "Fixed price of £20 per session (normally £25)",
      "Dates can be rescheduled with 48 hours notice",
      "Unused sessions refundable at £20 each",
      "Price locked regardless of future increases",
      "Non-transferable to another dog",
    ],
  },
];

const steps = [
  { num: "1", title: "Choose your package", desc: "Pick the deal that suits your pup best." },
  { num: "2", title: "Pick your dates", desc: "We'll work with you to schedule all your sessions." },
  { num: "3", title: "Pay securely upfront", desc: "One simple payment — in salon, online, or via payment link." },
  { num: "4", title: "We take care of the rest", desc: "Just turn up! We'll send you reminders before each session." },
];

const faqs = [
  { q: "Can I change my dates?", a: "Yes — just give us 48 hours notice and we'll reschedule at no charge." },
  { q: "What if I need to cancel?", a: "We'll refund any unused sessions at the package price." },
  { q: "Can I mix services?", a: "Yes — for grooming packages you can mix full grooms and bath & brush sessions." },
  { q: "How do I book?", a: "Call us on 01708 606655, WhatsApp us on +44 7476 452782, or visit us in salon." },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, amount: 0.2 } as const,
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export default function PublicPackagesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="Fluff & Scruff" className="h-10 sm:h-12 w-auto" />
            <div className="hidden sm:block">
              <p className="font-heading text-base leading-tight text-foreground">Fluff &amp; Scruff</p>
              <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Grooming Studio</p>
            </div>
          </Link>
          <button
            onClick={() => navigate("/book")}
            className="text-primary-foreground font-bold font-body text-sm px-6 py-2.5 bg-accent hover:bg-accent/90 transition-all active:scale-[0.96]"
            style={{ borderRadius: '30px' }}
          >
            Book Now
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div {...fadeUp}>
            <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-3 flex items-center justify-center gap-2">
              📦 Package Deals
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-foreground leading-tight mb-4">
              Save More When You Book Ahead
            </h1>
            <p className="text-muted-foreground font-body text-base sm:text-lg max-w-lg mx-auto">
              Pre-book multiple sessions, pay upfront, and enjoy a discount on every visit.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Package Cards */}
      <section className="pb-16 sm:pb-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`relative p-6 sm:p-7 flex flex-col ${pkg.bg} ${pkg.text} shadow-[0_4px_24px_rgba(0,0,0,0.08)]`}
                style={{
                  borderRadius: '24px',
                  ...(pkg.customBg ? { backgroundColor: pkg.customBg } : {}),
                }}
              >
                {pkg.popular && (
                  <span
                    className="absolute top-3 right-3 bg-accent text-white font-body text-[10px] font-bold uppercase tracking-wider px-3 py-1"
                    style={{ borderRadius: '30px' }}
                  >
                    Most Popular
                  </span>
                )}
                <h3 className="font-heading text-lg sm:text-xl mb-2 mt-1">{pkg.shortTitle}</h3>
                <p className="font-body text-sm opacity-90 leading-relaxed mb-4">{pkg.description}</p>
                <span
                  className={`inline-block self-start font-body text-xs font-bold px-3 py-1.5 mb-5 ${pkg.badgeBg}`}
                  style={{ borderRadius: '30px' }}
                >
                  {pkg.badge}
                </span>
                <div className="mt-auto space-y-2">
                  {pkg.terms.map((t, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />
                      <span className="font-body text-xs opacity-80 leading-snug">{t}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-heading text-foreground">How It Works</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="bg-background p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                style={{ borderRadius: '20px' }}
              >
                <span
                  className="inline-flex items-center justify-center w-9 h-9 bg-accent text-white font-heading text-sm mb-3"
                  style={{ borderRadius: '12px' }}
                >
                  {s.num}
                </span>
                <h3 className="font-heading text-sm text-foreground mb-1">{s.title}</h3>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeUp} className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-heading text-foreground">Common Questions</h2>
          </motion.div>
          <motion.div {...fadeUp}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border bg-card px-5 shadow-sm overflow-hidden"
                  style={{ borderRadius: '16px' }}
                >
                  <AccordionTrigger className="font-body font-bold text-sm text-foreground hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="font-body text-sm text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 sm:py-20 relative overflow-hidden bg-accent">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 2C7.58 2 4 5.58 4 10c0 2.24.92 4.27 2.4 5.72L12 22l5.6-6.28A7.96 7.96 0 0020 10c0-4.42-3.58-8-8-8z'/%3E%3C/svg%3E\")" }} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-white">
            Ready to save? Get in touch today.
          </h2>
          <p className="text-white/90 font-body text-base">
            Book online or contact us — we'll help you get started.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate("/book-package")}
              className="inline-flex items-center gap-2 bg-white text-accent font-bold font-body text-sm px-8 py-3.5 hover:bg-white/95 transition-all active:scale-[0.97] shadow-xl"
              style={{ borderRadius: '30px' }}
            >
              <Package className="h-4 w-4" /> Book a Package Online
            </button>
            <a
              href="tel:01708606655"
              className="inline-flex items-center gap-2 bg-white/20 text-white font-bold font-body text-sm px-8 py-3.5 hover:bg-white/30 transition-all active:scale-[0.97] border border-white/30"
              style={{ borderRadius: '30px' }}
            >
              <Phone className="h-4 w-4" /> Call Us
            </a>
            <a
              href="https://wa.me/447476452782"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/20 text-white font-bold font-body text-sm px-8 py-3.5 hover:bg-white/30 transition-all active:scale-[0.97] border border-white/30"
              style={{ borderRadius: '30px' }}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
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
    </div>
  );
}
