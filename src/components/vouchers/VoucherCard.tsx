import { forwardRef } from "react";
import logo from "@/assets/logo-transparent.png";
import { cn } from "@/lib/utils";

export type VoucherOccasion = "classic" | "birthday" | "halloween" | "christmas";

export const OCCASIONS: Record<VoucherOccasion, { label: string; tagline: string; emoji: string; className: string; accent: string }> = {
  classic: { label: "Gift Card", tagline: "Classic Fluff & Scruff", emoji: "🐾", className: "voucher-classic", accent: "text-primary" },
  birthday: { label: "Birthday Paws", tagline: "A pamper for the birthday pup", emoji: "🎂", className: "voucher-birthday", accent: "text-voucher-gold" },
  halloween: { label: "Halloween Special", tagline: "Spooky pamper treat", emoji: "🎃", className: "voucher-halloween", accent: "text-primary" },
  christmas: { label: "Festive Gift Card", tagline: "Merry Christmas & festive paws", emoji: "🎄", className: "voucher-christmas", accent: "text-voucher-gold" },
};

interface Props {
  occasion: VoucherOccasion;
  amount: number | null;
  code?: string | null;
  holder?: string | null;
  expiresAt?: string | null;
  className?: string;
  redeemed?: boolean;
}

const fmtExpiry = (iso?: string | null) => {
  if (!iso) return "12 MONTHS";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
};

/** Debit-card style gift voucher (ISO card ratio). */
export const VoucherCard = forwardRef<HTMLDivElement, Props>(({ occasion, amount, code, holder, expiresAt, className, redeemed }, ref) => {
  const o = OCCASIONS[occasion] ?? OCCASIONS.classic;
  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full max-w-[420px] aspect-[1.586/1] rounded-[22px] overflow-hidden text-voucher-ink shadow-[0_24px_50px_-18px_hsl(var(--voucher-shadow)/0.55)] select-none",
        o.className,
        className,
      )}
    >
      {/* sheen + paw watermark */}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,hsl(0_0%_100%/0.14)_45%,transparent_60%)]" />
      <div className="absolute -right-6 -bottom-8 text-[9rem] leading-none opacity-[0.07]">🐾</div>

      <div className="relative h-full flex flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-voucher-ink/95 grid place-items-center p-1">
              <img src={logo} alt="" className="max-h-full w-auto" crossOrigin="anonymous" />
            </div>
            <div>
              <p className="font-heading text-lg leading-none">Fluff &amp; Scruff</p>
              <p className={cn("text-[10px] uppercase tracking-[0.2em] mt-1", o.accent)}>{o.emoji} {o.label}</p>
            </div>
          </div>
          <p className={cn("font-heading text-2xl sm:text-3xl", o.accent)}>{amount != null ? `£${amount.toFixed(amount % 1 ? 2 : 0)}` : "£—"}</p>
        </div>

        {/* chip */}
        <div className="h-8 w-11 rounded-md bg-[linear-gradient(135deg,hsl(var(--voucher-gold)),hsl(var(--voucher-gold)/0.6))] opacity-90" />

        <div>
          <p className="font-mono text-lg sm:text-2xl tracking-[0.18em] font-bold">{code || "FS-•••• •••• ••••"}</p>
          <div className="mt-2 flex items-end justify-between text-[10px] uppercase tracking-widest opacity-80">
            <div>
              <p>For</p>
              <p className="text-sm tracking-wider opacity-100 truncate max-w-[200px]">{holder || "Your lucky pup"}</p>
            </div>
            <div className="text-right">
              <p>Valid thru</p>
              <p className="text-sm tracking-wider">{fmtExpiry(expiresAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {redeemed && (
        <div className="absolute inset-0 grid place-items-center bg-voucher-shadow/60">
          <span className="rotate-[-12deg] border-4 border-voucher-ink rounded-xl px-5 py-2 font-heading text-3xl tracking-widest">USED</span>
        </div>
      )}
    </div>
  );
});
VoucherCard.displayName = "VoucherCard";
