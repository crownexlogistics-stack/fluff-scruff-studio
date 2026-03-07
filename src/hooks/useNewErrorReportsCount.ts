import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useNewErrorReportsCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { count: c } = await supabase
        .from("error_reports" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "new");
      setCount(c || 0);
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
