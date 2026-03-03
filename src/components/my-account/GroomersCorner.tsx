import { Scissors, MessageCircleHeart } from "lucide-react";
import { format } from "date-fns";

interface Recommendation {
  id: string;
  recommendation: string;
  staff: { name: string } | null;
  created_at: string;
}

interface GroomersCornerProps {
  recommendations: Recommendation[];
  petName: string;
}

export function GroomersCorner({ recommendations, petName }: GroomersCornerProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
        <MessageCircleHeart className="h-4 w-4 text-accent" />
        Groomer's Corner
      </h3>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-4 relative"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Scissors className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{rec.recommendation}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  — {(rec.staff as any)?.name || "Your Groomer"} • {format(new Date(rec.created_at), "d MMM yyyy")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
