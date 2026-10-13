import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectionStateProps {
  onRetry: () => void;
  message?: string;
  compact?: boolean;
  retrying?: boolean;
}

function SadPup() {
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 mx-auto" aria-hidden="true">
      <ellipse cx="60" cy="66" rx="38" ry="34" className="fill-primary/15" />
      <ellipse cx="28" cy="58" rx="12" ry="24" transform="rotate(18 28 58)" className="fill-primary/60" />
      <ellipse cx="92" cy="58" rx="12" ry="24" transform="rotate(-18 92 58)" className="fill-primary/60" />
      <circle cx="47" cy="62" r="4" className="fill-foreground" />
      <circle cx="73" cy="62" r="4" className="fill-foreground" />
      <path d="M41 54 L52 57 M79 54 L68 57" strokeWidth="2.5" strokeLinecap="round" className="stroke-foreground" />
      <ellipse cx="60" cy="76" rx="6" ry="4.5" className="fill-foreground" />
      <path d="M50 90 Q60 82 70 90" strokeWidth="2.5" fill="none" strokeLinecap="round" className="stroke-foreground" />
      <path d="M78 70 q2 6 0 9 q-3 -3 0 -9z" className="fill-primary" />
      <circle cx="104" cy="100" r="9" className="fill-accent stroke-foreground/40" strokeWidth="1.5" />
      <path d="M96 96 Q104 101 112 96" fill="none" strokeWidth="1.5" className="stroke-foreground/40" />
    </svg>
  );
}

export function ConnectionState({
  onRetry,
  message = "Our studio system is having a little hiccup and taking a quick paws. Your account and details are safe — please give it a minute and try again.",
  compact = false,
  retrying = false,
}: ConnectionStateProps) {
  return (
    <div className={compact ? "py-10 text-center" : "min-h-screen flex items-center justify-center p-6 bg-background"}>
      <div className="mx-auto max-w-md text-center space-y-5 rounded-3xl bg-card border border-border p-8 shadow-sm">
        <SadPup />
        <div className="space-y-2">
          <h2 className="font-heading text-2xl text-foreground">We're having trouble fetching the ball!</h2>
          <p className="text-sm text-muted-foreground font-body">{message}</p>
        </div>
        <Button onClick={onRetry} disabled={retrying} size="lg" className="gap-2 rounded-full">
          🎾 {retrying ? "Fetching…" : "Try again"}
        </Button>
        <p className="text-xs text-muted-foreground font-body">
          Need us urgently?{" "}
          <a href="tel:01708606655" className="inline-flex items-center gap-1 underline">
            <Phone className="h-3 w-3" /> 01708 606655
          </a>
        </p>
      </div>
    </div>
  );
}
