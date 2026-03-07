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
  placeId: string;
  reviews: Review[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "text-accent fill-accent" : "text-border"}`}
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
      <section className="py-12 sm:py-16" style={{ background: 'hsl(43 100% 50%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-white font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
              ❤️ What Our Customers Say ❤️
            </p>
            <h2 className="text-2xl sm:text-3xl font-heading text-foreground">Loading reviews...</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 bg-card animate-pulse shadow-[0_4px_20px_rgba(0,0,0,0.06)]" style={{ borderRadius: '20px' }}>
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

  if (!data || data.reviews.length === 0) return null;

  const fiveStarReviews = data.reviews.filter((r) => r.rating === 5);
  const googleMapsUrl = `https://search.google.com/local/reviews?placeid=${data.placeId}`;

  return (
    <section className="py-12 sm:py-16" style={{ background: 'hsl(43 100% 50%)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <p className="text-white font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
            ❤️ What Our Customers Say ❤️
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading text-foreground mb-3">
            We treat them like our own
          </h2>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`h-5 w-5 ${star <= Math.round(data.rating) ? "text-foreground fill-foreground" : "text-foreground/30"}`} />
              ))}
            </div>
            <span className="font-heading text-lg text-foreground">{data.rating}</span>
            <span className="text-foreground/80 font-body text-sm">· {data.totalReviews} reviews on Google</span>
          </a>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible md:pb-0">
          {fiveStarReviews.map((review, index) => (
            <a
              key={index}
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex-shrink-0 w-72 md:w-auto snap-start p-5 bg-card hover:shadow-lg transition-all group shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
              style={{ borderRadius: '20px' }}
            >
              <Quote className="h-7 w-7 text-accent/15 absolute top-4 right-4" />
              <StarRating rating={review.rating} />
              <p className="text-sm text-muted-foreground font-body leading-relaxed mt-3 mb-4 line-clamp-4">
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
                  <p className="font-bold font-body text-sm text-foreground">{review.authorName}</p>
                  <p className="text-xs text-muted-foreground font-body">{review.relativeTime}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
