import { useEffect, useState } from "react";
import { Star, Heart, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhoto?: string;
}

interface ReviewsData {
  name: string;
  rating: number;
  totalReviews: number;
  reviews: Review[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "text-accent fill-accent"
              : "text-border"
          }`}
        />
      ))}
    </div>
  );
}

export function GoogleReviews() {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const { data: result, error } = await supabase.functions.invoke("google-reviews");
        if (error) throw error;
        setData(result);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, []);

  if (loading) {
    return (
      <section id="about" className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-accent font-body text-sm uppercase tracking-[0.25em] mb-3 flex items-center justify-center gap-2">
              <Heart className="h-4 w-4 fill-accent" />
              What Our Customers Say
              <Heart className="h-4 w-4 fill-accent" />
            </p>
            <h2 className="text-3xl sm:text-4xl font-heading text-foreground">Loading reviews...</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 rounded-3xl bg-warm-light/50 border border-accent/10 animate-pulse">
                <div className="h-4 bg-accent/10 rounded w-24 mb-4" />
                <div className="h-3 bg-accent/10 rounded w-full mb-2" />
                <div className="h-3 bg-accent/10 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data || data.reviews.length === 0) {
    return null;
  }

  // Show top 3 reviews (5-star first)
  const topReviews = data.reviews
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  return (
    <section id="about" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header with overall rating */}
        <div className="text-center mb-12">
          <p className="text-accent font-body text-sm uppercase tracking-[0.25em] mb-3 flex items-center justify-center gap-2">
            <Heart className="h-4 w-4 fill-accent" />
            What Our Customers Say
            <Heart className="h-4 w-4 fill-accent" />
          </p>
          <h2 className="text-3xl sm:text-4xl font-heading text-foreground mb-4">
            We treat them like our own
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-6 w-6 ${
                    star <= Math.round(data.rating)
                      ? "text-accent fill-accent"
                      : "text-border"
                  }`}
                />
              ))}
            </div>
            <span className="font-heading text-2xl text-foreground">{data.rating}</span>
            <span className="text-muted-foreground font-body text-sm">
              ({data.totalReviews} reviews on Google)
            </span>
          </div>
        </div>

        {/* Review cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {topReviews.map((review, index) => (
            <div
              key={index}
              className="relative p-6 rounded-3xl bg-warm-light/50 border border-accent/10 hover:shadow-lg hover:shadow-accent/5 transition-all"
            >
              <Quote className="h-8 w-8 text-accent/15 absolute top-5 right-5" />
              <StarRating rating={review.rating} />
              <p className="text-sm text-muted-foreground font-body leading-relaxed mt-4 mb-5 line-clamp-4">
                "{review.text}"
              </p>
              <div className="flex items-center gap-3">
                {review.profilePhoto && (
                  <img
                    src={review.profilePhoto}
                    alt={review.authorName}
                    className="h-9 w-9 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <p className="font-semibold font-body text-sm text-foreground">
                    {review.authorName}
                  </p>
                  <p className="text-xs text-muted-foreground">{review.relativeTime}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
