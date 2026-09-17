import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "director" | "manager" | "groomer" | "customer" | "volunteer" | "work_placement";

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      setConnectionError(false);
      return;
    }

    const fetchRole = async () => {
      setLoading(true);
      setConnectionError(false);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (!error) {
          setRole((data?.role as AppRole) ?? "customer");
          setLoading(false);
          return;
        }
        console.error("Error fetching role:", error);
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)));
      }
      setConnectionError(true);
      setLoading(false);
    };

    fetchRole();
  }, [userId, retryKey]);

  return { role, loading, connectionError, retry: () => setRetryKey((key) => key + 1) };
}
