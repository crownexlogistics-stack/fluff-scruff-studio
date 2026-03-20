import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { PartyPopper } from "lucide-react";
import { useMigratedBookings } from "@/hooks/useMigratedBookings";

interface CustomerMilestoneCardProps {
  staffId: string;
}

const MILESTONES = [5, 10, 15, 20, 25, 50, 75, 100];

export function CustomerMilestoneCard({ staffId }: CustomerMilestoneCardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: migratedBookings = [] } = useMigratedBookings(staffId);

  const { data: milestones = [] } = useQuery({
    queryKey: ["groomer-milestones", staffId, today, migratedBookings.length],
    queryFn: async () => {
      // Get today's appointments
      const { data: todayAppts, error: e1 } = await supabase
        .from("bookings")
        .select("customer_name, customer_email, dog_name")
        .eq("staff_id", staffId)
        .eq("booking_date", today)
        .not("status", "in", '("Cancelled","No Show")');
      if (e1) throw e1;

      // Build migrated visit counts by email
      const migratedCounts = new Map<string, number>();
      const migratedFirstDates = new Map<string, string>();
      for (const mb of migratedBookings) {
        const email = ((mb as any).migrated_customers?.email || "").toLowerCase();
        if (!email) continue;
        migratedCounts.set(email, (migratedCounts.get(email) || 0) + 1);
        const existing = migratedFirstDates.get(email);
        if (!existing || mb.booking_date < existing) {
          migratedFirstDates.set(email, mb.booking_date);
        }
      }

      const results: { customerName: string; dogName: string; visitNumber: number; firstVisit: string }[] = [];

      for (const apt of todayAppts || []) {
        if (!apt.customer_email) continue;

        const { data: pastBookings } = await supabase
          .from("bookings")
          .select("booking_date")
          .eq("staff_id", staffId)
          .eq("customer_email", apt.customer_email)
          .eq("status", "Completed")
          .order("booking_date", { ascending: true });

        const completedCount = pastBookings?.length || 0;
        const migratedCount = migratedCounts.get(apt.customer_email.toLowerCase()) || 0;
        const visitNumber = completedCount + migratedCount + 1; // +1 for today

        if (MILESTONES.includes(visitNumber)) {
          const migratedFirst = migratedFirstDates.get(apt.customer_email.toLowerCase());
          const bookingFirst = pastBookings?.[0]?.booking_date;
          let firstVisit = today;
          if (migratedFirst && bookingFirst) {
            firstVisit = migratedFirst < bookingFirst ? migratedFirst : bookingFirst;
          } else {
            firstVisit = migratedFirst || bookingFirst || today;
          }

          results.push({
            customerName: apt.customer_name,
            dogName: apt.dog_name,
            visitNumber,
            firstVisit,
          });
        }
      }

      return results;
    },
  });

  if (milestones.length === 0) return null;

  return (
    <div className="space-y-3">
      {milestones.map((m, i) => (
        <Card key={i} className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border-amber-200/50 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <PartyPopper className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-heading font-bold text-base text-foreground">🎉 Milestone Alert!</p>
                <p className="text-sm text-foreground/80 mt-1">
                  <strong>{m.dogName}</strong> is visiting for their <strong>{m.visitNumber}th</strong> time with you today — <strong>{m.customerName}</strong> has been a loyal client since {format(new Date(m.firstVisit + "T00:00:00"), "d MMMM yyyy")}!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
