import { useNavigate } from "react-router-dom";

export function HalloweenBanner() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/book?halloween=1")}
      className="w-full bg-foreground text-background font-body text-xs sm:text-sm font-semibold py-2 px-4 text-center hover:opacity-90 transition-opacity"
    >
      🎃 Halloween Special all October — scented bath, perfume, bandana &amp; photo for just +£10 <span className="underline ml-1">Book now</span>
    </button>
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
