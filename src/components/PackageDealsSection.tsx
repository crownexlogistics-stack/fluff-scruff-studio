import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const packages = [
  {
    title: "Book 4, Save 10%",
    description: "Pre-book 4 grooming sessions and pay upfront. Mix full grooms and bath & brush — whatever your dog needs.",
    badge: "Save 10% on every session",
    bg: "bg-accent",
    text: "text-white",
    badgeBg: "bg-white/20",
    sessions: 4,
  },
  {
    title: "Book 6, Save 15%",
    description: "Our best grooming deal. Pre-book 6 sessions, mix services, and lock in your discount.",
    badge: "Save 15% on every session",
    bg: "",
    text: "text-white",
    badgeBg: "bg-white/20",
    sessions: 6,
    popular: true,
    customBg: "hsl(20 60% 12%)",
  },
  {
    title: "5 Teeth Cleans for £100",
    description: "Normally £25 per session — pre-book 5 ultrasonic teeth cleaning sessions and pay just £20 each.",
    badge: "Save £25 in total",
    bg: "",
    text: "text-foreground",
    badgeBg: "bg-white/40",
    sessions: 5,
    customBg: "#FFB800",
  },
];

export function PackageDealsSection() {
  const navigate = useNavigate();

  return (
    <section className="py-12 sm:py-20 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
            📦 Package Deals 📦
          </p>
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-heading text-foreground leading-tight">
            Save more when you book ahead
          </h2>
          <p className="text-muted-foreground font-body mt-2 text-sm max-w-md mx-auto">
            Pre-pay for multiple sessions and enjoy a discount on every visit
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative p-5 sm:p-6 flex flex-col ${pkg.bg} ${pkg.text} shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden`}
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
              <h3 className="font-heading text-lg sm:text-xl mb-2 mt-1">{pkg.title}</h3>
              <p className="font-body text-sm opacity-90 leading-relaxed mb-4 flex-1">{pkg.description}</p>
              <span
                className={`inline-block self-start font-body text-xs font-bold px-3 py-1.5 ${pkg.badgeBg}`}
                style={{ borderRadius: '30px' }}
              >
                {pkg.badge}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8 space-y-4">
          <p className="text-muted-foreground font-body text-sm">
            Dates can be rescheduled. Cancel anytime with a refund on unused sessions.
          </p>
          <button
            onClick={() => navigate("/packages")}
            className="bg-accent text-white font-bold font-body text-sm px-8 py-3 hover:bg-accent/90 transition-all active:scale-[0.97] shadow-lg"
            style={{ borderRadius: '30px' }}
          >
            Find Out More & Book a Package
          </button>
        </div>
      </div>
    </section>
  );
}
