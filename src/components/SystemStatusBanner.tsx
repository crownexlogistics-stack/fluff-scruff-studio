import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SystemStatusBanner() {
  const status = useQuery({
    queryKey: ["studio-system-status"],
    queryFn: async () => {
      const { error } = await supabase.from("breeds").select("id", { head: true, count: "exact" });
      if (error) throw error;
      return true;
    },
    retry: 1,
    retryDelay: 1000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  if (!status.isError) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <span>The studio system is temporarily unavailable. Your information is safe.</span>
      <Button variant="outline" size="sm" className="h-7 gap-1" onClick={() => void status.refetch()}>
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}