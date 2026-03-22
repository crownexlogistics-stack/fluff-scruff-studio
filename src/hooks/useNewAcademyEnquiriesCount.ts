import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useNewAcademyEnquiriesCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("academy_enquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");
      setCount(c || 0);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
