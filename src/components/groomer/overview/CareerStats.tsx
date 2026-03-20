import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors, Dog, Heart } from "lucide-react";

interface CareerStatsProps {
  staffId: string;
}

function getMilestoneMessage(count: number) {
  if (count >= 500) return "Salon legend 🌟";
  if (count >= 200) return "Master groomer status 🏆";
  if (count >= 100) return "You're a seasoned groomer ✂️";
  if (count >= 50) return "You're finding your rhythm 🐾";
  return "You're building something great 🌱";
}

export function CareerStats({ staffId }: CareerStatsProps) {
  const { data: totalDogs = 0 } = useQuery({
    queryKey: ["groomer-career-dogs", staffId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("staff_id", staffId)
        .eq("status", "Completed");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: breedData = { count: 0, recent: [] as string[] } } = useQuery({
    queryKey: ["groomer-career-breeds", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("breeds(name)")
        .eq("staff_id", staffId)
        .eq("status", "Completed")
        .not("breed_id", "is", null);
      if (error) throw error;
      
      const breedNames = [...new Set((data as any[]).map(b => b.breeds?.name).filter(Boolean))];
      return {
        count: breedNames.length,
        recent: breedNames.slice(0, 5),
      };
    },
  });

  const { data: loyalCount = 0 } = useQuery({
    queryKey: ["groomer-career-loyal", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_email")
        .eq("staff_id", staffId)
        .eq("status", "Completed");
      if (error) throw error;
      
      const emailCounts = new Map<string, number>();
      for (const b of data) {
        if (b.customer_email) {
          emailCounts.set(b.customer_email, (emailCounts.get(b.customer_email) || 0) + 1);
        }
      }
      return [...emailCounts.values()].filter(c => c >= 3).length;
    },
  });

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-bold text-base text-foreground">🏅 Your Career</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Total Dogs */}
        <Card className="bg-gradient-to-br from-[hsl(var(--primary))]/5 to-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/15">
          <CardContent className="p-5 text-center">
            <Scissors className="h-8 w-8 mx-auto text-[hsl(var(--primary))] mb-2" />
            <p className="text-4xl font-bold text-foreground">{totalDogs}</p>
            <p className="text-xs text-muted-foreground mt-1">Dogs groomed in your career</p>
            <p className="text-xs font-medium text-[hsl(var(--primary))] mt-2">{getMilestoneMessage(totalDogs)}</p>
          </CardContent>
        </Card>

        {/* Breeds */}
        <Card className="bg-gradient-to-br from-[hsl(var(--primary))]/5 to-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/15">
          <CardContent className="p-5 text-center">
            <Dog className="h-8 w-8 mx-auto text-[hsl(var(--primary))] mb-2" />
            <p className="text-4xl font-bold text-foreground">{breedData.count}</p>
            <p className="text-xs text-muted-foreground mt-1">Different breeds groomed</p>
            {breedData.recent.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {breedData.recent.map((b) => (
                  <Badge key={b} variant="secondary" className="text-[10px] px-1.5 py-0">{b}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loyal Regulars */}
        <Card className="bg-gradient-to-br from-[hsl(var(--primary))]/5 to-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/15">
          <CardContent className="p-5 text-center">
            <Heart className="h-8 w-8 mx-auto text-[hsl(var(--primary))] mb-2" />
            <p className="text-4xl font-bold text-foreground">{loyalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Customers back 3+ times</p>
            <p className="text-xs font-medium text-[hsl(var(--primary))] mt-2">These are YOUR people 🐶</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
