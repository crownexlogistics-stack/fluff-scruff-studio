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
  const sessionStartKey = "lovable_idle_session_start";
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    let cancelled = false;

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      try {
        localStorage.setItem(lastActivityKey, String(Date.now()));
      } catch {}
      timerRef.current = window.setTimeout(async () => {
        toast.message("Signed out due to 5 hours of inactivity.");
        await supabase.auth.signOut();
        onLogoutRef.current?.();
      }, timeoutMs);
    };

    // Only apply the stale-session check when there's an active Supabase
    // session AND the last-activity timestamp was recorded during THIS
    // session (i.e. after the current session's issued_at). Without this
    // guard a stale timestamp from a previous day would sign the user out
    // the instant the layout mounts after a fresh login.
    const runStaleCheck = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          // No session — nothing to protect. Clear any stale marker.
          try { localStorage.removeItem(lastActivityKey); } catch {}
          return;
        }

        // Session start (seconds → ms). Fall back to a stored session-start
        // marker so we still have a lower bound if the token lacks iat.
        const sessionIssuedAtMs = ((session as any).issued_at
          ? Number((session as any).issued_at) * 1000
          : 0);
        let sessionStart = sessionIssuedAtMs;
        try {
          const stored = Number(localStorage.getItem(sessionStartKey) || 0);
          const currentUserId = session.user?.id ?? "";
          const storedUserId = localStorage.getItem(sessionStartKey + ":uid");
          if (stored && storedUserId === currentUserId) {
            sessionStart = Math.max(sessionStart, stored);
          } else {
            // First time we see this session in this tab — anchor it now
            // and treat any prior last-activity value as invalid.
            localStorage.setItem(sessionStartKey, String(Date.now()));
            localStorage.setItem(sessionStartKey + ":uid", currentUserId);
            localStorage.removeItem(lastActivityKey);
            sessionStart = Date.now();
          }
        } catch {}

        const last = Number(localStorage.getItem(lastActivityKey) || 0);
        // Only sign out if we have a last-activity value that belongs to
        // the CURRENT session and it's older than the timeout.
        if (last && last >= sessionStart && Date.now() - last > timeoutMs) {
          await supabase.auth.signOut();
          if (!cancelled) onLogoutRef.current?.();
          return;
        }

        // Healthy session — refresh the marker and start the idle timer.
        if (!cancelled) reset();
      } catch {
        if (!cancelled) reset();
      }
    };

    // Clear stale markers whenever auth state changes (sign in / sign out)
    // so a new session never inherits the previous session's idle clock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          try {
            localStorage.setItem(sessionStartKey, String(Date.now()));
            localStorage.setItem(sessionStartKey + ":uid", session?.user?.id ?? "");
            localStorage.setItem(lastActivityKey, String(Date.now()));
          } catch {}
        }
        if (event === "SIGNED_OUT") {
          try {
            localStorage.removeItem(lastActivityKey);
            localStorage.removeItem(sessionStartKey);
            localStorage.removeItem(sessionStartKey + ":uid");
          } catch {}
        }
      }
    );

    runStaleCheck();

    const events: string[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
      subscription.unsubscribe();
    };
  }, [timeoutMs]);
}
