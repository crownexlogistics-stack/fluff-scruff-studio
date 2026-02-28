import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TrustData {
  rating: number;
  totalReviews: number;
}

export function TrustStrip() {
  const [data, setData] = useState<TrustData | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const { data: result, error } = await supabase.functions.invoke("google-reviews");
        if (error) throw error;
        if (result) setData({ rating: result.rating, totalReviews: result.totalReviews });
      } catch {
        // silently fail — strip just won't show
      }
    }
    fetch();
  }, []);

  if (!data) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-5 bg-background">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= Math.round(data.rating)
                ? "text-accent fill-accent"
                : "text-border"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-body text-foreground font-semibold">{data.rating}</span>
      <span className="text-sm font-body text-muted-foreground">
        · {data.totalReviews} reviews on Google
      </span>
    </div>
  );
}
