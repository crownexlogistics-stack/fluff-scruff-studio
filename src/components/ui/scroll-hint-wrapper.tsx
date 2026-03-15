import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollHintWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollHintWrapper({ children, className }: ScrollHintWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Show hint if more than 20px of content is hidden below
    setCanScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 20);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [check]);

  return (
    <div className="relative">
      <div ref={ref} className={cn("overflow-y-auto", className)}>
        {children}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center transition-opacity duration-300",
          canScroll ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="h-10 w-full bg-gradient-to-t from-background to-transparent" />
        <div className="pointer-events-auto -mt-2 animate-bounce rounded-full bg-muted/90 p-1 shadow-sm border">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
