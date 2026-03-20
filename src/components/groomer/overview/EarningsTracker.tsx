import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { PoundSterling } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface EarningsTrackerProps {
  staffId: string;
}

export function EarningsTracker({ staffId }: EarningsTrackerProps) {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: allCommissions = [] } = useQuery({
    queryKey: ["groomer-all-commissions", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_records")
        .select("groomer_pay, created_at")
        .eq("staff_id", staffId);
      if (error) throw error;
      return data;
    },
  });

  const { weekEarnings, weekCount, monthEarnings, monthCount, allTimeEarnings, allTimeCount } = useMemo(() => {
    let we = 0, wc = 0, me = 0, mc = 0, ae = 0, ac = 0;
    for (const c of allCommissions) {
      const d = c.created_at.slice(0, 10);
      const pay = Number(c.groomer_pay);
      ae += pay;
      ac++;
      if (d >= weekStart && d <= weekEnd) { we += pay; wc++; }
      if (d >= monthStart && d <= monthEnd) { me += pay; mc++; }
    }
    return { weekEarnings: we, weekCount: wc, monthEarnings: me, monthCount: mc, allTimeEarnings: ae, allTimeCount: ac };
  }, [allCommissions, weekStart, weekEnd, monthStart, monthEnd]);

  const cards = [
    { label: "This Week", amount: weekEarnings, count: weekCount },
    { label: "This Month", amount: monthEarnings, count: monthCount },
    { label: "All Time", amount: allTimeEarnings, count: allTimeCount },
  ];

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-bold text-base text-foreground">💰 Your Earnings</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/40">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <PoundSterling className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">£{c.amount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.count} appointment{c.count !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
