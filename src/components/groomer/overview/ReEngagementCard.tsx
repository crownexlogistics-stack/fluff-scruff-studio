import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface ReEngagementCardProps {
  staffId: string;
}

export function ReEngagementCard({ staffId }: ReEngagementCardProps) {
  const { data: lapsedCustomers = [] } = useQuery({
    queryKey: ["groomer-reengagement", staffId],
    queryFn: async () => {
      // Get all completed bookings for this groomer
      const { data: allBookings, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, dog_name, booking_date")
        .eq("staff_id", staffId)
        .eq("status", "Completed")
        .order("booking_date", { ascending: false });
      if (error) throw error;

      // Group by customer email
      const customerMap = new Map<string, { name: string; email: string; dog: string; dates: string[] }>();
      for (const b of allBookings) {
        if (!b.customer_email) continue;
        const existing = customerMap.get(b.customer_email);
        if (existing) {
          existing.dates.push(b.booking_date);
        } else {
          customerMap.set(b.customer_email, {
            name: b.customer_name,
            email: b.customer_email,
            dog: b.dog_name,
            dates: [b.booking_date],
          });
        }
      }

      // Filter: exactly 1 visit with this groomer, more than 60 days ago
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const results: { name: string; email: string; dog: string; visitDate: string; daysSince: number }[] = [];

      for (const [, customer] of customerMap) {
        if (customer.dates.length !== 1) continue;
        const visitDate = new Date(customer.dates[0] + "T00:00:00");
        if (visitDate >= sixtyDaysAgo) continue;

        // Check if they rebooked with anyone
        const { count } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_email", customer.email)
          .gt("booking_date", customer.dates[0])
          .in("status", ["Confirmed", "Pending", "Completed"]);

        if ((count ?? 0) === 0) {
          results.push({
            name: customer.name,
            email: customer.email,
            dog: customer.dog,
            visitDate: customer.dates[0],
            daysSince: differenceInDays(new Date(), visitDate),
          });
        }
      }

      return results.sort((a, b) => b.daysSince - a.daysSince).slice(0, 5);
    },
  });

  if (lapsedCustomers.length === 0) return null;

  const handleOpenProfile = (email: string) => {
    window.open(`/admin/customers/${encodeURIComponent(email)}`, "_blank");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">💌 Customers You Haven't Seen in a While</CardTitle>
        <p className="text-xs text-muted-foreground">These customers visited once but never came back. A friendly message could bring them back!</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {lapsedCustomers.map((c) => (
          <div key={c.email} className="flex items-center gap-3 rounded-xl border border-border p-3 bg-card/50">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">🐕 {c.dog} · Visited {format(new Date(c.visitDate + "T00:00:00"), "d MMM yyyy")}</p>
              <p className="text-[10px] text-muted-foreground/70">{c.daysSince} days ago</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs gap-1.5"
              onClick={() => handleOpenProfile(c.email)}
            >
              <Mail className="h-3.5 w-3.5" />
              View Profile
            </Button>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground/60 italic">Open their profile to send a re-engagement email.</p>
      </CardContent>
    </Card>
  );
}
