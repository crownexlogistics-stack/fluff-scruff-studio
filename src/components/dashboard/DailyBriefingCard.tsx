import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour >= 18) return `Good evening, ${name}! 🌙`;
  if (hour >= 14) return `Good afternoon, ${name}! ☀️`;
  return `Good morning, ${name}! ☀️`;
}

export function DailyBriefingCard() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: profile } = useQuery({
    queryKey: ["briefing-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["daily-briefing", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("daily-briefing", {
        body: { force: refreshKey > 0 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { text: string; generatedAt: string };
    },
  });

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  if (isLoading) {
    return (
      <Card className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-semibold">{getGreeting(firstName)}</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <p className="text-sm text-muted-foreground animate-pulse">Preparing your briefing... ☀️</p>
          <Skeleton className="h-4 w-full mt-3" />
          <Skeleton className="h-4 w-3/4 mt-2" />
          <Skeleton className="h-4 w-5/6 mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{getGreeting(firstName)}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <p className="text-sm text-muted-foreground">AI briefing unavailable right now — please try again in a moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{getGreeting(firstName)}</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Refresh briefing">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="text-sm leading-relaxed">{data.text}</p>
        {data.generatedAt && (
          <p className="text-[10px] text-muted-foreground mt-3">
            Generated {format(new Date(data.generatedAt), "HH:mm")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
