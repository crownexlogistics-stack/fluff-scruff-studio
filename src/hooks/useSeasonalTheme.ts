import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SeasonalTheme = "halloween" | null;

/** Reads the salon-wide seasonal theme switch (set from the admin dashboard). */
export function useSeasonalTheme() {
  return useQuery({
    queryKey: ["seasonal_theme"],
    queryFn: async (): Promise<SeasonalTheme> => {
      const { data } = await supabase.from("site_config").select("value").eq("key", "seasonal_theme").maybeSingle();
      const active = (data?.value as any)?.active;
      return active === "halloween" ? "halloween" : null;
    },
    staleTime: 60_000,
  });
}
