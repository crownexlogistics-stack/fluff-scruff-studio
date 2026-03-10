import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Track session expiry / sign out events
        if (_event === "SIGNED_OUT" && user) {
          const maskedEmail = user.email
            ? `${user.email[0]}${"*".repeat(Math.max((user.email.split("@")[0]?.length || 2) - 2, 1))}${(user.email.split("@")[0]?.length || 0) > 1 ? user.email.split("@")[0]?.slice(-1) : ""}@${user.email.split("@")[1]}`
            : "unknown";
          supabase.from("error_reports" as any).insert({
            error_description: "[SESSION_EXPIRED] Customer session expired and was logged out",
            steps_to_reproduce: `Email: ${maskedEmail}`,
            page_url: window.location.href,
            browser_info: `${navigator.userAgent.includes("Chrome") ? "Chrome" : "Other"} — ${navigator.userAgent}`,
            device_info: `${window.innerWidth < 768 ? "Mobile" : "Desktop"} — ${window.innerWidth}x${window.innerHeight}`,
            status: "new",
            severity: "low",
            customer_email: maskedEmail,
          } as any).then(() => {});
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
