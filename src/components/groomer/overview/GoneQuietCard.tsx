import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface GoneQuietCardProps {
  staffId: string;
}

export function GoneQuietCard({ staffId }: GoneQuietCardProps) {
  const navigate = useNavigate();

  const { data: quietCustomers = [] } = useQuery({
    queryKey: ["groomer-gone-quiet", staffId],
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

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const results: { name: string; email: string; dog: string; visits: number; lastVisit: string; daysSince: number }[] = [];

      for (const [, customer] of customerMap) {
        if (customer.dates.length < 3) continue;
        const lastDate = new Date(customer.dates[0] + "T00:00:00");
        if (lastDate >= ninetyDaysAgo) continue;

        // Check no recent booking with anyone
        const { count } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_email", customer.email)
          .gte("booking_date", format(ninetyDaysAgo, "yyyy-MM-dd"))
          .in("status", ["Confirmed", "Pending", "Completed"]);

        if ((count ?? 0) === 0) {
          results.push({
            name: customer.name,
            email: customer.email,
            dog: customer.dog,
            visits: customer.dates.length,
            lastVisit: customer.dates[0],
            daysSince: differenceInDays(new Date(), lastDate),
          });
        }
      }

      return results.sort((a, b) => b.daysSince - a.daysSince).slice(0, 5);
    },
  });

  if (quietCustomers.length === 0) return null;

  const getMessage = (c: { name: string; dog: string }) =>
    `Subject: Time for ${c.dog}'s next groom? 🐾\n\nHi ${c.name}, we noticed it's been a little while since ${c.dog}'s last visit and wanted to check in! We'd love to see you both again. Book online at fluffandscruff.co.uk or call 01708 606655. See you soon! Fluff & Scruff Studio`;

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
        <CardTitle className="text-base font-heading">🔔 Regulars Who've Gone Quiet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {quietCustomers.map((c) => (
          <div key={c.email} className="rounded-xl border border-border p-3 bg-card/50 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleOpenProfile(c.email, c.name)}
                  className="font-medium text-sm text-primary hover:underline text-left"
                >
                  {c.name}
                </button>
                <p className="text-xs text-muted-foreground">🐕 {c.dog} · {c.visits} visits with you</p>
                <p className="text-xs text-amber-600 font-medium">Last seen {c.daysSince} days ago</p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] shrink-0">
                Worth a check-in 💛
              </Badge>
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
        <p className="text-[10px] text-muted-foreground/60 italic">
          These customers were regulars with you — it might be worth a friendly email to check in and invite them back.
        </p>
      </CardContent>
    </Card>
  );
}
