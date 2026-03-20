import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Star } from "lucide-react";
import { format } from "date-fns";

interface MostLoyalCustomersProps {
  staffId: string;
}

export function MostLoyalCustomers({ staffId }: MostLoyalCustomersProps) {
  const { data: loyalCustomers = [] } = useQuery({
    queryKey: ["groomer-loyal-customers", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, dog_name, booking_date")
        .eq("staff_id", staffId)
        .eq("status", "Completed")
        .order("booking_date", { ascending: false });
      if (error) throw error;

      const customerMap = new Map<string, { name: string; dog: string; count: number; lastVisit: string }>();
      for (const b of data) {
        const key = b.customer_email || b.customer_name;
        const existing = customerMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          customerMap.set(key, {
            name: b.customer_name,
            dog: b.dog_name,
            count: 1,
            lastVisit: b.booking_date,
          });
        }
      }

      return [...customerMap.values()]
        .filter(c => c.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });

  if (loyalCustomers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">⭐ Your Most Loyal Customers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {loyalCustomers.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3 bg-card/50">
            <div className="h-9 w-9 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center shrink-0">
              {i === 0 ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <Heart className="h-4 w-4 text-[hsl(var(--primary))]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">🐕 {c.dog}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-[hsl(var(--primary))]">{c.count} visits</p>
              <p className="text-[10px] text-muted-foreground">Last: {format(new Date(c.lastVisit + "T00:00:00"), "d MMM")}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
