import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnassignedInboxCount() {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    const { count: c } = await supabase
      .from("ai_inbox_cases")
      .select("id", { count: "exact", head: true })
      .eq("status", "unassigned");
    setCount(c || 0);
  };

  useEffect(() => {
    fetchCount();
    const channel = supabase
      .channel("ai_inbox_cases_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_inbox_cases" }, fetchCount)
      .subscribe();
    const interval = setInterval(fetchCount, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return count;
}