import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CurrentStaff {
  id: string;
  name: string;
}

export function useCurrentStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<CurrentStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setStaff(null);
      setLoading(false);
      setConnectionError(false);
      return;
    }
    let cancelled = false;
    const fetchStaff = async () => {
      setLoading(true);
      setConnectionError(false);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("staff")
          .select("id, name")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!error) {
          setStaff(data ? { id: data.id, name: data.name } : null);
          setLoading(false);
          return;
        }
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 800 * (attempt + 1)));
      }
      if (!cancelled) {
        setConnectionError(true);
        setLoading(false);
      }
    };
    void fetchStaff();
    return () => {
      cancelled = true;
    };
  }, [user?.id, retryKey]);

  return { staff, loading, connectionError, retry: () => setRetryKey((key) => key + 1) };
}