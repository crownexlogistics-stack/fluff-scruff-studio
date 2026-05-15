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

  useEffect(() => {
    if (!user?.id) {
      setStaff(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("staff")
      .select("id, name")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setStaff(data ? { id: data.id, name: data.name } : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { staff, loading };
}