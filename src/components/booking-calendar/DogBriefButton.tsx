import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { BookingData } from "./BookingEvent";

interface DogBriefButtonProps {
  booking: BookingData;
}

export function DogBriefButton({ booking }: DogBriefButtonProps) {
  const [brief, setBrief] = useState<{ text: string; totalVisits: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const dogName = booking.dog_name || "this dog";

  const handleClick = async () => {
    if (brief) {
      setBrief(null);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("dog-brief", {
        body: {
          booking_id: booking.id,
          is_migrated: booking.is_migrated || false,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setBrief(data);
    } catch (e) {
      console.error("Dog brief error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? `Reading ${dogName}'s history... 🐾` : brief ? "Hide AI Dog Brief" : "🐾 AI Dog Brief"}
      </Button>

      {loading && (
        <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="p-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4 mt-2" />
            <Skeleton className="h-3 w-5/6 mt-2" />
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-xs text-muted-foreground px-1">
          AI briefing unavailable right now — please try again in a moment.
        </p>
      )}

      {brief && (
        <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold">🐾 About {dogName} today</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <p className="text-xs leading-relaxed">{brief.text}</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              {brief.totalVisits > 0
                ? `Based on ${brief.totalVisits} previous visit${brief.totalVisits !== 1 ? "s" : ""}`
                : "Based on today's booking details — first visit or no history found"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
