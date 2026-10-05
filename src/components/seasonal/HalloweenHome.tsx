import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

const SPOOKY_BG = "linear-gradient(90deg, hsl(270 45% 14%), hsl(18 100% 35%), hsl(270 45% 14%))";

export function HalloweenBanner() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/book?halloween=1")}
      className="relative w-full overflow-hidden text-primary-foreground font-heading text-sm sm:text-lg py-3 px-4 text-center hover:brightness-110 transition-all"
      style={{ background: SPOOKY_BG }}
    >
      <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl hidden sm:inline animate-bounce">🦇</span>
      <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl hidden sm:inline animate-bounce">🦇</span>
      🎃 Halloween is here! Spooky Special all October — just +£10 👻{" "}
      <span className="underline ml-1 font-body font-bold">Book your treat →</span>
    </button>
  );
}

/** Layers spooky decoration over the untouched original hero. */
export function HalloweenHeroWrap({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const floaters = [
    ["🦇", "top-[8%] left-[6%] text-4xl", "0s"],
    ["🦇", "top-[14%] right-[10%] text-3xl", "1.2s"],
    ["👻", "top-[40%] right-[4%] text-5xl", "0.6s"],
    ["🕷️", "top-[4%] left-[45%] text-3xl", "1.8s"],
    ["🎃", "bottom-[8%] left-[3%] text-6xl", "0.3s"],
    ["🎃", "bottom-[6%] right-[6%] text-5xl", "1.5s"],
  ];
  return (
    <div className="relative">
      <style>{`@keyframes hw-float{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-14px) rotate(6deg)}}`}</style>
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "linear-gradient(180deg, hsl(270 50% 10% / 0.35), transparent 45%, hsl(18 100% 30% / 0.25))" }}
      />
      <span aria-hidden className="pointer-events-none absolute top-0 left-0 z-10 text-7xl sm:text-9xl opacity-60 select-none">🕸️</span>
      <span aria-hidden className="pointer-events-none absolute top-0 right-0 z-10 text-7xl sm:text-9xl opacity-60 select-none -scale-x-100">🕸️</span>
      {floaters.map(([e, pos, d], i) => (
        <span
          key={i}
          aria-hidden
          className={`pointer-events-none absolute z-10 select-none drop-shadow-lg ${pos}`}
          style={{ animation: `hw-float 4s ease-in-out ${d} infinite` }}
        >
          {e}
        </span>
      ))}
      <button
        onClick={() => navigate("/book?halloween=1")}
        className="absolute z-20 left-1/2 -translate-x-1/2 bottom-4 sm:bottom-8 font-heading text-base sm:text-xl text-primary-foreground px-6 sm:px-10 py-3 shadow-2xl hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
        style={{ background: SPOOKY_BG, borderRadius: "30px", boxShadow: "0 0 30px hsl(18 100% 55% / 0.6)" }}
      >
        🎃 Book the Halloween Special · +£10
      </button>
    </div>
  );
}

export function HalloweenSpotlight() {
  const navigate = useNavigate();
  const items = [
    ["🧴", "Bath with Halloween scented shampoo"],
    ["🌸", "Halloween scented perfume"],
    ["🧣", "Halloween bandana to take home"],
    ["📸", "A Halloween picture of your pup"],
  ];
  return (
    <section className="px-4 sm:px-6 pt-10">
      <div
        className="relative max-w-4xl mx-auto overflow-hidden bg-foreground text-background p-6 sm:p-10"
        style={{ borderRadius: "28px" }}
      >
        <span aria-hidden className="absolute -top-4 -right-2 text-7xl sm:text-8xl opacity-20 select-none">🕸️</span>
        <span aria-hidden className="absolute -bottom-6 -left-3 text-7xl opacity-15 select-none">🎃</span>
        <p className="font-body text-xs uppercase tracking-[0.25em] text-primary mb-2">🎃 Seasonal treat · All October</p>
        <h2 className="font-heading text-2xl sm:text-4xl mb-2">The Halloween Special</h2>
        <p className="font-body text-sm sm:text-base opacity-80 mb-5">
          Add it to a Full Groom, Bath &amp; Brush or Puppy Special for just <strong className="text-primary">+£10</strong>.
        </p>
        <ul className="grid sm:grid-cols-2 gap-2 mb-6 font-body text-sm">
          {items.map(([icon, label]) => (
            <li key={label} className="flex items-center gap-2"><span>{icon}</span>{label}</li>
          ))}
        </ul>
        <button
          onClick={() => navigate("/book?halloween=1")}
          className="font-heading text-lg bg-primary text-primary-foreground px-8 py-3 hover:bg-primary/90 active:scale-[0.97] transition-all"
          style={{ borderRadius: "30px" }}
        >
          🎃 Book Halloween Treat
        </button>
      </div>
    </section>
  );
}
