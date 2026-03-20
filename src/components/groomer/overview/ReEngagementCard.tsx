import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { useMigratedBookings } from "@/hooks/useMigratedBookings";

interface ReEngagementCardProps {
  staffId: string;
}

export function ReEngagementCard({ staffId }: ReEngagementCardProps) {
  const { data: migratedBookings = [] } = useMigratedBookings(staffId);

  const { data: lapsedCustomers = [] } = useQuery({
    queryKey: ["groomer-reengagement", staffId, migratedBookings.length],
    queryFn: async () => {
      const { data: allBookings, error } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, dog_name, booking_date")
        .eq("staff_id", staffId)
        .eq("status", "Completed")
        .order("booking_date", { ascending: false });
      if (error) throw error;

      const customerMap = new Map<string, { name: string; email: string; dog: string; dates: string[] }>();

      for (const b of allBookings) {
        if (!b.customer_email) continue;
        const key = b.customer_email.toLowerCase();
        const existing = customerMap.get(key);
        if (existing) {
          existing.dates.push(b.booking_date);
        } else {
          customerMap.set(key, {
            name: b.customer_name,
            email: b.customer_email,
            dog: b.dog_name,
            dates: [b.booking_date],
          });
        }
      }

      // Merge migrated bookings
      for (const mb of migratedBookings) {
        const mc = (mb as any).migrated_customers;
        const email = mc?.email?.toLowerCase();
        if (!email) continue;
        const existing = customerMap.get(email);
        if (existing) {
          existing.dates.push(mb.booking_date);
        } else {
          customerMap.set(email, {
            name: mc.full_name || "Wix Customer",
            email: mc.email,
            dog: mb.dog_name || "Unknown",
            dates: [mb.booking_date],
          });
        }
      }

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const results: { name: string; email: string; dog: string; visitDate: string; daysSince: number }[] = [];

      for (const [, customer] of customerMap) {
        if (customer.dates.length !== 1) continue;
        const visitDate = new Date(customer.dates[0] + "T00:00:00");
        if (visitDate >= sixtyDaysAgo) continue;

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

  if (lapsedCustomers.length === 0) return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">💌 Visited Once — Never Came Back</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground text-center py-4">No one-time customers to follow up with yet — keep grooming! 🐾</p>
      </CardContent>
    </Card>
  );

  const getMessage = (c: { name: string; dog: string }) =>
    `Subject: We miss ${c.dog} at Fluff & Scruff! 🐾\n\nHi ${c.name}, it's been a while since we last saw ${c.dog} and we miss them! Is it time for another groom? Book online at fluffandscruff.co.uk or call 01708 606655. Hope to see you soon! Fluff & Scruff Studio`;

  const handleCopy = (c: { name: string; dog: string }) => {
    navigator.clipboard.writeText(getMessage(c));
    toast.success("Message copied to clipboard");
  };

  const handleOpenProfile = (email: string, name: string) => {
    window.open(`/admin/customers/${encodeURIComponent(email)}`, "_blank");
    toast.info(`Opening ${name}'s profile — go to the Email tab and send them a re-engagement message 🐾`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">💌 Visited Once — Never Came Back</CardTitle>
        <p className="text-xs text-muted-foreground">These customers visited once but never returned. A friendly message could bring them back!</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {lapsedCustomers.map((c) => (
          <div key={c.email} className="rounded-xl border border-border p-3 bg-card/50 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleOpenProfile(c.email, c.name)}
                  className="font-medium text-sm text-primary hover:underline text-left"
                >
                  {c.name}
                </button>
                <p className="text-xs text-muted-foreground">🐕 {c.dog} · Visited {format(new Date(c.visitDate + "T00:00:00"), "d MMM yyyy")}</p>
                <p className="text-[10px] text-muted-foreground/70">{c.daysSince} days ago</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleCopy(c)}>
                <Copy className="h-3 w-3" /> Copy Message
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleOpenProfile(c.email, c.name)}>
                <ExternalLink className="h-3 w-3" /> Send Email
              </Button>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground/60 italic">Open their profile to send a re-engagement email.</p>
      </CardContent>
    </Card>
  );
}
