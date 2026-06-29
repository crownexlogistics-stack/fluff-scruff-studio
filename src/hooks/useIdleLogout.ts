import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Logs the user out after `timeoutMs` of inactivity (no mouse, keyboard,
 * touch, or scroll events). Designed for the staff/groomer portal so an
 * unattended device doesn't stay signed in indefinitely.
 */
export function useIdleLogout(timeoutMs: number, onLogout?: () => void) {
  const timerRef = useRef<number | null>(null);
  const lastActivityKey = "lovable_last_activity_ts";

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      try {
        localStorage.setItem(lastActivityKey, String(Date.now()));
      } catch {}
      timerRef.current = window.setTimeout(async () => {
        toast.message("Signed out due to 5 hours of inactivity.");
        await supabase.auth.signOut();
        onLogout?.();
      }, timeoutMs);
    };

    // Check on mount: if last activity was longer than timeout ago, sign out now
    try {
      const last = Number(localStorage.getItem(lastActivityKey) || 0);
      if (last && Date.now() - last > timeoutMs) {
        supabase.auth.signOut().then(() => onLogout?.());
        return;
      }
    } catch {}

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, onLogout]);
}
