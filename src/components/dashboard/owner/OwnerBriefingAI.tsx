import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "./primitives";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Briefing {
  summary?: string;
  text?: string;
  bullets?: string[];
  generatedAt?: string;
}

export function OwnerBriefingAI() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["owner-ai-briefing"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("daily-briefing", { body: { force: false } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as Briefing;
    },
    staleTime: 30 * 60_000,
    retry: false,
  });

  const summary = data?.summary || data?.text;
  if (!isLoading && !summary) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("daily-briefing", { body: { force: true } });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Panel className="p-5 bg-warm-light/60 border-primary/15">
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Putting your briefing together…</p>
          ) : (
            <>
              <p className="text-sm font-semibold leading-relaxed">{summary}</p>
              {data?.bullets && data.bullets.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {data.bullets.slice(0, 3).map((b, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2 leading-relaxed">
                      <span className="text-primary">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data?.generatedAt && (
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  Written {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}
                </p>
              )}
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          aria-label="Refresh briefing"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </Panel>
  );
}
