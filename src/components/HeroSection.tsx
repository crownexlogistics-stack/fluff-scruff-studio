import { useEffect, useRef } from "react";
import heroDog from "@/assets/hero-shop.jpg";

interface HeroSectionProps {
  onBook: () => void;
}

export function HeroSection({ onBook }: HeroSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll<HTMLElement>("[data-hero-anim]");
    if (!els) return;
    // Trigger animations after mount
    requestAnimationFrame(() => {
      els.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    });
  }, []);

  const animStyle = (delay: string, y = "20px"): React.CSSProperties => ({
    opacity: 0,
    transform: `translateY(${y})`,
    transition: `opacity 0.6s ease ${delay}, transform 0.6s ease ${delay}`,
  });

  return (
    <section ref={sectionRef} className="relative">
      {/* Hero image — full width, no washed-out overlay */}
      <div className="relative w-full h-[60vh] sm:h-[70vh] overflow-hidden">
        <img
          src={heroDog}
          alt="Beautifully groomed dog at Fluff & Scruff studio"
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 40%" }}
        />
        {/* Subtle bottom gradient only — last 30% */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "30%",
            background: "linear-gradient(to bottom, transparent, #FFFAF4)",
          }}
        />
      </div>

      {/* Content below the image */}
      <div className="relative z-10 px-6 text-center pt-6 pb-4 space-y-5">
        {/* Trust pill */}
        <div data-hero-anim style={animStyle("0.2s")}>
          <span
            className="inline-block font-body text-[11px] uppercase tracking-[0.18em] text-white px-4 py-1.5"
            style={{
              background: "#2D1B0E",
              borderRadius: "30px",
            }}
          >
            ⭐ 4.9 · 69 REVIEWS · HORNCHURCH ESSEX
          </span>
        </div>

        {/* Headline */}
        <h1
          data-hero-anim
          style={animStyle("0.4s")}
          className="font-heading text-foreground leading-[1.15] text-[38px] sm:text-[52px] max-w-xl mx-auto"
        >
          Where every pup leaves
          <br />
          looking their absolute best
        </h1>

        {/* Subheading */}
        <p
          data-hero-anim
          style={animStyle("0.5s", "15px")}
          className="font-body text-base text-muted-foreground"
        >
          Professional dog grooming in Hornchurch since 2024
        </p>

        {/* Buttons */}
        <div
          data-hero-anim
          style={animStyle("0.6s", "15px")}
          className="flex flex-col sm:flex-row gap-3 max-w-[380px] sm:max-w-md mx-auto"
        >
          <button
            onClick={onBook}
            className="w-full font-heading text-lg text-white py-3.5 transition-all active:scale-[0.97]"
            style={{
              background: "#FF6B35",
              borderRadius: "30px",
              height: "56px",
              boxShadow: "0 4px 20px rgba(255,107,53,0.35)",
            }}
          >
            🐾 Book My Pup In
          </button>
          <a
            href="tel:01708606655"
            className="w-full flex items-center justify-center font-body font-bold text-base py-3 transition-all active:scale-[0.97]"
            style={{
              background: "transparent",
              border: "2px solid #2D1B0E",
              color: "#2D1B0E",
              borderRadius: "30px",
              height: "52px",
            }}
          >
            📞 Call Us
          </a>
        </div>

        {/* Trust icons */}
        <div
          data-hero-anim
          style={animStyle("0.8s", "10px")}
          className="flex items-center justify-center gap-6 pt-2"
        >
          {[
            { icon: "🏠", label: "Family Run" },
            { icon: "✂️", label: "All Breeds" },
            { icon: "💛", label: "Dogs First" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="text-sm">{item.icon}</span>
              <span
                className="font-body text-xs"
                style={{ color: "#8B6F5C" }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div
        className="mx-6"
        style={{ height: "1px", background: "#e8d8ca" }}
      />
    </section>
  );
}
