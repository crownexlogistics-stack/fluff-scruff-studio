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
        // silently fail
      }
    }
    fetch();
  }, []);

  const rating = data?.rating ?? 4.9;
  const reviews = data?.totalReviews ?? 69;

  return (
    <div className="mx-5 sm:mx-6 mt-3 mb-2" style={{ borderRadius: '20px', background: 'hsl(var(--warm-dark))' }}>
      <div className="flex items-center justify-center gap-0 py-3 px-2">
        {[
          { value: `${rating}★`, label: "GOOGLE" },
          { value: `${reviews}+`, label: "REVIEWS" },
          { value: "3yrs", label: "EST." },
          { value: "ALL", label: "BREEDS" },
        ].map((stat, i) => (
          <div key={stat.label} className="flex items-center">
            {i > 0 && <div className="w-px h-6 bg-white/20 mx-2 sm:mx-3" />}
            <div className="text-center">
              <p className="font-heading text-sm sm:text-base text-gold leading-none">{stat.value}</p>
              <p className="font-body text-[8px] sm:text-[9px] uppercase tracking-wider text-white/70 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
